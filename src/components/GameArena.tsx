import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { ArrowLeft, Users, Clock, Trophy } from 'lucide-react'
import { GameBoard } from './GameBoard'
import { GameState, Player } from '../types/game'
import { blink } from '../blink/client'
import { createInitialGrid, getPlayerSpawnPositions, canMoveTo, createExplosions, checkPlayerCollisions, destroyBlocks } from '../utils/gameLogic'

interface GameArenaProps {
  roomId: string
  onLeaveGame: () => void
}

export function GameArena({ roomId, onLeaveGame }: GameArenaProps) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [user, setUser] = useState<any>(null)
  const [gameStarted, setGameStarted] = useState(false)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  // Initialize game state
  useEffect(() => {
    if (!user) return
    
    const initializeGame = async () => {
      try {
        const savedRooms = localStorage.getItem('bomberman-rooms')
        if (!savedRooms) return
        
        const existingRooms = JSON.parse(savedRooms)
        const currentRoom = existingRooms.find((r: any) => r.id === roomId)
        
        if (!currentRoom) return
        
        const players = currentRoom.players || []
        const playerData = players.find((p: Player) => p.id === user.id)
        
        if (playerData) {
          setCurrentPlayer(playerData)
        }

        // Create initial game state
        const initialState: GameState = {
          id: roomId,
          players: players,
          bombs: [],
          explosions: [],
          powerUps: [],
          grid: createInitialGrid(),
          gameStatus: players.length >= 2 ? 'playing' : 'waiting',
          timeLeft: 180 // 3 minutes
        }

        setGameState(initialState)
        
        if (players.length >= 2) {
          setGameStarted(true)
          // Update room status in local storage
          const roomIndex = existingRooms.findIndex((r: any) => r.id === roomId)
          if (roomIndex !== -1) {
            existingRooms[roomIndex] = { ...currentRoom, status: 'playing' }
            localStorage.setItem('bomberman-rooms', JSON.stringify(existingRooms))
          }
        }
      } catch (error) {
        console.error('Failed to initialize game:', error)
      }
    }

    initializeGame()
  }, [roomId, user])

  // Real-time game updates
  useEffect(() => {
    if (!user) return

    let channel: any = null
    
    const setupRealtime = async () => {
      channel = blink.realtime.channel(`game-${roomId}`)
      await channel.subscribe({
        userId: user.id,
        metadata: { playerName: currentPlayer?.name || 'Player' }
      })

      channel.onMessage((message: any) => {
        if (message.type === 'game-update') {
          setGameState(message.data)
          // Update current player reference from the new game state
          const updatedPlayer = message.data.players.find((p: Player) => p.id === user.id)
          if (updatedPlayer) {
            setCurrentPlayer(updatedPlayer)
          }
        } else if (message.type === 'player-action') {
          // Only handle actions from other players to avoid conflicts
          if (message.data.playerId !== user.id) {
            handlePlayerAction(message.data)
          }
        }
      })
    }

    setupRealtime().catch(console.error)

    return () => {
      channel?.unsubscribe()
    }
  }, [user, currentPlayer?.name, roomId, handlePlayerAction])

  // Game loop
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== 'playing') return

    const gameLoop = setInterval(() => {
      setGameState(prevState => {
        if (!prevState) return prevState

        const newState = { ...prevState }

        // Update bomb timers
        newState.bombs = newState.bombs.map(bomb => ({
          ...bomb,
          timer: bomb.timer - 1
        }))

        // Explode bombs
        const explodingBombs = newState.bombs.filter(bomb => bomb.timer <= 0)
        explodingBombs.forEach(bomb => {
          const explosions = createExplosions(bomb, newState.grid)
          newState.explosions.push(...explosions)
          
          // Decrease bomb count for the player who placed the bomb
          const playerIndex = newState.players.findIndex(p => p.id === bomb.playerId)
          if (playerIndex !== -1) {
            newState.players[playerIndex] = {
              ...newState.players[playerIndex],
              bombCount: Math.max(0, newState.players[playerIndex].bombCount - 1)
            }
          }
        })

        // Remove exploded bombs
        newState.bombs = newState.bombs.filter(bomb => bomb.timer > 0)

        // Update explosion timers
        newState.explosions = newState.explosions.map(explosion => ({
          ...explosion,
          timer: explosion.timer - 1
        })).filter(explosion => explosion.timer > 0)

        // Check player collisions with explosions
        newState.players = checkPlayerCollisions(newState.players, newState.explosions)

        // Destroy blocks and create power-ups
        if (explodingBombs.length > 0) {
          const { newGrid, powerUps } = destroyBlocks(newState.grid, newState.explosions)
          newState.grid = newGrid
          newState.powerUps.push(...powerUps)
        }

        // Update game timer
        newState.timeLeft = Math.max(0, newState.timeLeft - 1/60)

        // Check win condition
        const alivePlayers = newState.players.filter(p => p.isAlive)
        if (alivePlayers.length <= 1 || newState.timeLeft <= 0) {
          newState.gameStatus = 'finished'
          newState.winner = alivePlayers.length === 1 ? alivePlayers[0].id : undefined
        }

        // Broadcast game state (all players can broadcast to ensure sync)
        broadcastGameState(newState)

        return newState
      })
    }, 1000/60) // 60 FPS

    return () => clearInterval(gameLoop)
  }, [gameState, user, broadcastGameState])

  const broadcastGameState = useCallback(async (state: GameState) => {
    try {
      await blink.realtime.publish(`game-${roomId}`, 'game-update', state)
    } catch (error) {
      console.error('Failed to broadcast game state:', error)
    }
  }, [roomId])

  const handlePlayerAction = useCallback((action: any) => {
    setGameState(prevState => {
      if (!prevState) return prevState

      const newState = { ...prevState }
      const playerIndex = newState.players.findIndex(p => p.id === action.playerId)
      
      if (playerIndex === -1) return prevState

      const player = newState.players[playerIndex]

      switch (action.type) {
        case 'move':
          if (canMoveTo(action.x, action.y, newState.grid, newState.bombs)) {
            newState.players[playerIndex] = {
              ...player,
              x: action.x,
              y: action.y
            }
            
            // Update current player if this is our player
            if (action.playerId === user?.id) {
              setCurrentPlayer(newState.players[playerIndex])
            }
          }
          break

        case 'place-bomb':
          if (player.bombCount < player.maxBombs) {
            const bombExists = newState.bombs.some(b => b.x === player.x && b.y === player.y)
            if (!bombExists) {
              newState.bombs.push({
                id: `bomb-${Date.now()}-${player.id}`,
                x: player.x,
                y: player.y,
                playerId: player.id,
                timer: 180, // 3 seconds
                power: player.bombPower
              })
              newState.players[playerIndex] = {
                ...player,
                bombCount: player.bombCount + 1
              }
              
              // Update current player if this is our player
              if (action.playerId === user?.id) {
                setCurrentPlayer(newState.players[playerIndex])
              }
            }
          }
          break

        case 'collect-powerup': {
          const powerUpIndex = newState.powerUps.findIndex(p => p.x === action.x && p.y === action.y)
          if (powerUpIndex !== -1) {
            const powerUp = newState.powerUps[powerUpIndex]
            newState.powerUps.splice(powerUpIndex, 1)

            switch (powerUp.type) {
              case 'speed':
                newState.players[playerIndex] = {
                  ...player,
                  speed: Math.min(player.speed + 0.5, 3)
                }
                break
              case 'bomb':
                newState.players[playerIndex] = {
                  ...player,
                  maxBombs: Math.min(player.maxBombs + 1, 5)
                }
                break
              case 'power':
                newState.players[playerIndex] = {
                  ...player,
                  bombPower: Math.min(player.bombPower + 1, 5)
                }
                break
            }
            
            // Update current player if this is our player
            if (action.playerId === user?.id) {
              setCurrentPlayer(newState.players[playerIndex])
            }
          }
          break
        }
      }

      return newState
    })
  }, [user?.id])

  // Keyboard controls
  useEffect(() => {
    if (!gameState || !currentPlayer || gameState.gameStatus !== 'playing') return

    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!currentPlayer.isAlive) return

      let newX = currentPlayer.x
      let newY = currentPlayer.y
      let shouldMove = false
      let shouldPlaceBomb = false

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          newY = currentPlayer.y - 1
          shouldMove = true
          break
        case 's':
        case 'arrowdown':
          newY = currentPlayer.y + 1
          shouldMove = true
          break
        case 'a':
        case 'arrowleft':
          newX = currentPlayer.x - 1
          shouldMove = true
          break
        case 'd':
        case 'arrowright':
          newX = currentPlayer.x + 1
          shouldMove = true
          break
        case ' ':
          e.preventDefault()
          shouldPlaceBomb = true
          break
      }

      // Handle movement
      if (shouldMove && canMoveTo(newX, newY, gameState.grid, gameState.bombs)) {
        const moveAction = {
          type: 'move',
          playerId: currentPlayer.id,
          x: newX,
          y: newY
        }
        
        // Update local state immediately for responsiveness
        setCurrentPlayer(prev => prev ? { ...prev, x: newX, y: newY } : prev)
        handlePlayerAction(moveAction)
        
        try {
          await blink.realtime.publish(`game-${roomId}`, 'player-action', moveAction)
        } catch (error) {
          console.error('Failed to broadcast move:', error)
        }

        // Check for power-up collection at new position
        const powerUp = gameState.powerUps.find(p => p.x === newX && p.y === newY)
        if (powerUp) {
          const collectAction = {
            type: 'collect-powerup',
            playerId: currentPlayer.id,
            x: powerUp.x,
            y: powerUp.y
          }
          handlePlayerAction(collectAction)
          try {
            await blink.realtime.publish(`game-${roomId}`, 'player-action', collectAction)
          } catch (error) {
            console.error('Failed to broadcast power-up collection:', error)
          }
        }
      }

      // Handle bomb placement
      if (shouldPlaceBomb) {
        const bombAction = {
          type: 'place-bomb',
          playerId: currentPlayer.id
        }
        handlePlayerAction(bombAction)
        try {
          await blink.realtime.publish(`game-${roomId}`, 'player-action', bombAction)
        } catch (error) {
          console.error('Failed to broadcast bomb placement:', error)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameState, currentPlayer, roomId, handlePlayerAction])

  if (!gameState || !currentPlayer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center">Loading Game...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const alivePlayers = gameState.players.filter(p => p.isAlive)
  const isGameFinished = gameState.gameStatus === 'finished'
  const winner = gameState.winner ? gameState.players.find(p => p.id === gameState.winner) : null

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={onLeaveGame}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave Game
          </Button>
          
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {alivePlayers.length} alive
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {Math.ceil(gameState.timeLeft)}s
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                {!gameStarted ? (
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold mb-4">Waiting for Players...</h2>
                    <p className="text-muted-foreground mb-6">
                      Need at least 2 players to start the game
                    </p>
                    <div className="space-y-2">
                      {gameState.players.map((player, index) => (
                        <div key={player.id} className="flex items-center justify-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: {
                              red: '#ff4444',
                              blue: '#4444ff', 
                              green: '#44ff44',
                              yellow: '#ffff44'
                            }[player.color] }}
                          />
                          <span>{player.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : isGameFinished ? (
                  <div className="text-center py-12">
                    <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
                    <h2 className="text-3xl font-bold mb-2">
                      {winner ? `${winner.name} Wins!` : 'Time\'s Up!'}
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {winner ? 'Congratulations!' : 'No winner this round'}
                    </p>
                    <Button onClick={onLeaveGame}>
                      Back to Lobby
                    </Button>
                  </div>
                ) : (
                  <GameBoard gameState={gameState} currentPlayerId={currentPlayer.id} />
                )}
              </CardContent>
            </Card>

            {/* Controls */}
            {gameStarted && !isGameFinished && (
              <Card className="mt-4">
                <CardContent className="p-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Controls</h3>
                    <div className="flex justify-center gap-8 text-sm text-muted-foreground">
                      <div>
                        <strong>Move:</strong> WASD or Arrow Keys
                      </div>
                      <div>
                        <strong>Bomb:</strong> Spacebar
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Players Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Players
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 rounded-lg border ${
                      player.id === currentPlayer.id ? 'border-primary bg-primary/10' : 'border-border'
                    } ${!player.isAlive ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: {
                          red: '#ff4444',
                          blue: '#4444ff',
                          green: '#44ff44', 
                          yellow: '#ffff44'
                        }[player.color] }}
                      />
                      <span className="font-medium">{player.name}</span>
                      {!player.isAlive && (
                        <Badge variant="destructive" className="text-xs">
                          Eliminated
                        </Badge>
                      )}
                    </div>
                    
                    {player.isAlive && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>💣 Bombs: {player.bombCount}/{player.maxBombs}</div>
                        <div>🔥 Power: {player.bombPower}</div>
                        <div>⚡ Speed: {player.speed.toFixed(1)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Power-ups Info */}
            <Card>
              <CardHeader>
                <CardTitle>Power-ups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Speed Boost</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💣</span>
                  <span>Extra Bomb</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔥</span>
                  <span>Bigger Explosion</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}