import { useEffect, useRef } from 'react'
import { GameState, Player, Bomb, Explosion, PowerUp } from '../types/game'
import { GRID_WIDTH, GRID_HEIGHT } from '../utils/gameLogic'

interface GameBoardProps {
  gameState: GameState
  currentPlayerId: string
}

export function GameBoard({ gameState, currentPlayerId }: GameBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const cellSize = 40
    canvas.width = GRID_WIDTH * cellSize
    canvas.height = GRID_HEIGHT * cellSize

    // Draw grid
    drawGrid(ctx, gameState.grid, cellSize)
    
    // Draw power-ups
    gameState.powerUps.forEach(powerUp => {
      drawPowerUp(ctx, powerUp, cellSize)
    })
    
    // Draw bombs
    gameState.bombs.forEach(bomb => {
      drawBomb(ctx, bomb, cellSize)
    })
    
    // Draw explosions
    gameState.explosions.forEach(explosion => {
      drawExplosion(ctx, explosion, cellSize)
    })
    
    // Draw players
    gameState.players.forEach(player => {
      drawPlayer(ctx, player, cellSize, player.id === currentPlayerId)
    })

  }, [gameState, currentPlayerId])

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    grid: ('wall' | 'block' | 'empty')[][],
    cellSize: number
  ) => {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const cellType = grid[y][x]
        const pixelX = x * cellSize
        const pixelY = y * cellSize

        // Background
        ctx.fillStyle = '#2a2a3e'
        ctx.fillRect(pixelX, pixelY, cellSize, cellSize)

        // Cell content
        switch (cellType) {
          case 'wall':
            ctx.fillStyle = '#4a4a5e'
            ctx.fillRect(pixelX + 2, pixelY + 2, cellSize - 4, cellSize - 4)
            break
          case 'block':
            ctx.fillStyle = '#8b4513'
            ctx.fillRect(pixelX + 4, pixelY + 4, cellSize - 8, cellSize - 8)
            // Add some texture
            ctx.fillStyle = '#a0522d'
            ctx.fillRect(pixelX + 6, pixelY + 6, cellSize - 12, 4)
            ctx.fillRect(pixelX + 6, pixelY + cellSize - 10, cellSize - 12, 4)
            break
          case 'empty':
            // Grid lines
            ctx.strokeStyle = '#3a3a4e'
            ctx.lineWidth = 1
            ctx.strokeRect(pixelX, pixelY, cellSize, cellSize)
            break
        }
      }
    }
  }

  const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    player: Player,
    cellSize: number,
    isCurrentPlayer: boolean
  ) => {
    if (!player.isAlive) return

    const pixelX = player.x * cellSize + cellSize / 2
    const pixelY = player.y * cellSize + cellSize / 2
    const radius = cellSize * 0.3

    // Player colors
    const colors = {
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      yellow: '#ffff44'
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.arc(pixelX + 2, pixelY + 2, radius, 0, Math.PI * 2)
    ctx.fill()

    // Player body
    ctx.fillStyle = colors[player.color]
    ctx.beginPath()
    ctx.arc(pixelX, pixelY, radius, 0, Math.PI * 2)
    ctx.fill()

    // Player outline
    ctx.strokeStyle = isCurrentPlayer ? '#ffffff' : '#000000'
    ctx.lineWidth = isCurrentPlayer ? 3 : 2
    ctx.stroke()

    // Eyes
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(pixelX - radius * 0.3, pixelY - radius * 0.2, radius * 0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(pixelX + radius * 0.3, pixelY - radius * 0.2, radius * 0.15, 0, Math.PI * 2)
    ctx.fill()

    // Name tag
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px Inter'
    ctx.textAlign = 'center'
    ctx.fillText(player.name, pixelX, pixelY + radius + 15)
  }

  const drawBomb = (
    ctx: CanvasRenderingContext2D,
    bomb: Bomb,
    cellSize: number
  ) => {
    const pixelX = bomb.x * cellSize + cellSize / 2
    const pixelY = bomb.y * cellSize + cellSize / 2
    const radius = cellSize * 0.25

    // Bomb shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.arc(pixelX + 2, pixelY + 2, radius, 0, Math.PI * 2)
    ctx.fill()

    // Bomb body
    ctx.fillStyle = '#333333'
    ctx.beginPath()
    ctx.arc(pixelX, pixelY, radius, 0, Math.PI * 2)
    ctx.fill()

    // Bomb highlight
    ctx.fillStyle = '#555555'
    ctx.beginPath()
    ctx.arc(pixelX - radius * 0.3, pixelY - radius * 0.3, radius * 0.3, 0, Math.PI * 2)
    ctx.fill()

    // Fuse
    ctx.strokeStyle = '#ff6b35'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(pixelX, pixelY - radius)
    ctx.lineTo(pixelX - 5, pixelY - radius - 8)
    ctx.stroke()

    // Timer indicator
    const timerRatio = bomb.timer / 180 // 3 seconds
    ctx.fillStyle = timerRatio > 0.5 ? '#ffff00' : '#ff0000'
    ctx.font = '10px Inter'
    ctx.textAlign = 'center'
    ctx.fillText(Math.ceil(bomb.timer / 60).toString(), pixelX, pixelY + radius + 12)
  }

  const drawExplosion = (
    ctx: CanvasRenderingContext2D,
    explosion: Explosion,
    cellSize: number
  ) => {
    const pixelX = explosion.x * cellSize
    const pixelY = explosion.y * cellSize

    // Explosion colors based on timer
    const intensity = explosion.timer / 30
    const red = Math.floor(255 * intensity)
    const yellow = Math.floor(255 * intensity * 0.8)

    ctx.fillStyle = `rgba(${red}, ${yellow}, 0, ${intensity * 0.8})`
    ctx.fillRect(pixelX + 2, pixelY + 2, cellSize - 4, cellSize - 4)

    // Explosion center glow
    if (explosion.direction === 'center') {
      ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.6})`
      ctx.fillRect(pixelX + cellSize * 0.25, pixelY + cellSize * 0.25, cellSize * 0.5, cellSize * 0.5)
    }
  }

  const drawPowerUp = (
    ctx: CanvasRenderingContext2D,
    powerUp: PowerUp,
    cellSize: number
  ) => {
    const pixelX = powerUp.x * cellSize + cellSize / 2
    const pixelY = powerUp.y * cellSize + cellSize / 2
    const size = cellSize * 0.4

    // Power-up colors
    const colors = {
      speed: '#00ff00',
      bomb: '#ff6b35',
      power: '#ff0000'
    }

    // Glow effect
    ctx.fillStyle = colors[powerUp.type] + '40'
    ctx.beginPath()
    ctx.arc(pixelX, pixelY, size * 1.2, 0, Math.PI * 2)
    ctx.fill()

    // Power-up body
    ctx.fillStyle = colors[powerUp.type]
    ctx.fillRect(pixelX - size / 2, pixelY - size / 2, size, size)

    // Power-up icon
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px Inter'
    ctx.textAlign = 'center'
    const icons = { speed: '⚡', bomb: '💣', power: '🔥' }
    ctx.fillText(icons[powerUp.type], pixelX, pixelY + 5)
  }

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        className="border-2 border-primary rounded-lg bg-muted"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}