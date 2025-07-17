import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Users, Play, Plus } from 'lucide-react'
import { GameRoom } from '../types/game'
import { blink } from '../blink/client'

interface GameLobbyProps {
  onJoinGame: (roomId: string) => void
}

export function GameLobby({ onJoinGame }: GameLobbyProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [playerName, setPlayerName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      if (state.user) {
        setPlayerName(state.user.email?.split('@')[0] || 'Player')
        loadRooms()
        setupLobbyRealtime()
      }
    })
    return unsubscribe
  }, [])

  const setupLobbyRealtime = async () => {
    try {
      const channel = blink.realtime.channel('bomberman-lobby')
      await channel.subscribe({ userId: user?.id || 'anonymous' })
      
      channel.onMessage((message: any) => {
        if (message.type === 'room-created' || message.type === 'room-updated') {
          loadRooms()
        }
      })
    } catch (error) {
      console.error('Failed to setup lobby realtime:', error)
    }
  }

  const loadRooms = async () => {
    try {
      // For now, use local storage to simulate room persistence
      const savedRooms = localStorage.getItem('bomberman-rooms')
      if (savedRooms) {
        const parsedRooms = JSON.parse(savedRooms)
        setRooms(parsedRooms.filter((room: GameRoom) => room.status === 'waiting'))
      }
    } catch (error) {
      console.error('Failed to load rooms:', error)
    }
  }

  const createRoom = async () => {
    if (!user || !playerName.trim()) return
    
    setIsCreating(true)
    try {
      const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const room: GameRoom = {
        id: roomId,
        name: `${playerName}'s Game`,
        maxPlayers: 4,
        status: 'waiting',
        createdAt: Date.now(),
        players: [{
          id: user.id,
          name: playerName,
          x: 1,
          y: 1,
          color: 'red',
          isAlive: true,
          bombCount: 0,
          maxBombs: 1,
          bombPower: 1,
          speed: 1
        }]
      }
      
      // Save to local storage
      const savedRooms = localStorage.getItem('bomberman-rooms')
      const existingRooms = savedRooms ? JSON.parse(savedRooms) : []
      existingRooms.push(room)
      localStorage.setItem('bomberman-rooms', JSON.stringify(existingRooms))
      
      // Broadcast room creation
      await blink.realtime.publish('bomberman-lobby', 'room-created', room)
      
      onJoinGame(room.id)
    } catch (error) {
      console.error('Failed to create room:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const joinRoom = async (roomId: string) => {
    if (!user || !playerName.trim()) return
    
    try {
      const savedRooms = localStorage.getItem('bomberman-rooms')
      if (!savedRooms) return
      
      const existingRooms = JSON.parse(savedRooms)
      const roomIndex = existingRooms.findIndex((r: GameRoom) => r.id === roomId)
      
      if (roomIndex === -1) return
      
      const currentRoom = existingRooms[roomIndex]
      const players = currentRoom.players
      
      if (players.length >= currentRoom.maxPlayers) return
      
      const colors = ['red', 'blue', 'green', 'yellow']
      const usedColors = players.map((p: any) => p.color)
      const availableColor = colors.find(color => !usedColors.includes(color)) || 'red'
      
      const spawnPositions = [
        { x: 1, y: 1 },
        { x: 11, y: 1 },
        { x: 1, y: 9 },
        { x: 11, y: 9 }
      ]
      
      players.push({
        id: user.id,
        name: playerName,
        x: spawnPositions[players.length].x,
        y: spawnPositions[players.length].y,
        color: availableColor,
        isAlive: true,
        bombCount: 0,
        maxBombs: 1,
        bombPower: 1,
        speed: 1
      })
      
      existingRooms[roomIndex] = { ...currentRoom, players }
      localStorage.setItem('bomberman-rooms', JSON.stringify(existingRooms))
      
      // Broadcast room update
      await blink.realtime.publish('bomberman-lobby', 'room-updated', existingRooms[roomIndex])
      
      onJoinGame(roomId)
    } catch (error) {
      console.error('Failed to join room:', error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center">Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">💣 Bomberman</h1>
          <p className="text-muted-foreground">Join or create a multiplayer game</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Create Game */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create Game
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Your Name</label>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1"
                />
              </div>
              <Button 
                onClick={createRoom}
                disabled={!playerName.trim() || isCreating}
                className="w-full"
              >
                {isCreating ? 'Creating...' : 'Create Room'}
              </Button>
            </CardContent>
          </Card>

          {/* Join Game */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Available Games
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {rooms.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No games available. Create one!
                  </p>
                ) : (
                  rooms.map((room) => {
                    const players = room.players || []
                    return (
                      <div
                        key={room.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{room.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {players.length}/{room.maxPlayers} players
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {room.status}
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => joinRoom(room.id)}
                            disabled={players.length >= room.maxPlayers}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Join
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <Button
                variant="outline"
                onClick={loadRooms}
                className="w-full mt-4"
              >
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}