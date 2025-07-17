import { GameState, Player, Bomb, Explosion, PowerUp } from '../types/game'

export const GRID_WIDTH = 13
export const GRID_HEIGHT = 11

export function createInitialGrid(): ('wall' | 'block' | 'empty')[][] {
  const grid: ('wall' | 'block' | 'empty')[][] = []
  
  for (let y = 0; y < GRID_HEIGHT; y++) {
    grid[y] = []
    for (let x = 0; x < GRID_WIDTH; x++) {
      // Border walls
      if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
        grid[y][x] = 'wall'
      }
      // Internal walls (every other position)
      else if (x % 2 === 0 && y % 2 === 0) {
        grid[y][x] = 'wall'
      }
      // Player spawn areas (corners) - keep empty
      else if (
        (x <= 2 && y <= 2) ||
        (x >= GRID_WIDTH - 3 && y <= 2) ||
        (x <= 2 && y >= GRID_HEIGHT - 3) ||
        (x >= GRID_WIDTH - 3 && y >= GRID_HEIGHT - 3)
      ) {
        grid[y][x] = 'empty'
      }
      // Random destructible blocks
      else {
        grid[y][x] = Math.random() < 0.7 ? 'block' : 'empty'
      }
    }
  }
  
  return grid
}

export function getPlayerSpawnPositions(): { x: number; y: number }[] {
  return [
    { x: 1, y: 1 }, // Top-left
    { x: GRID_WIDTH - 2, y: 1 }, // Top-right
    { x: 1, y: GRID_HEIGHT - 2 }, // Bottom-left
    { x: GRID_WIDTH - 2, y: GRID_HEIGHT - 2 }, // Bottom-right
  ]
}

export function canMoveTo(
  x: number,
  y: number,
  grid: ('wall' | 'block' | 'empty')[][],
  bombs: Bomb[]
): boolean {
  // Check bounds
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
    return false
  }
  
  // Check grid obstacles
  if (grid[y][x] !== 'empty') {
    return false
  }
  
  // Check bombs
  if (bombs.some(bomb => bomb.x === x && bomb.y === y)) {
    return false
  }
  
  return true
}

export function createExplosions(bomb: Bomb, grid: ('wall' | 'block' | 'empty')[][]): Explosion[] {
  const explosions: Explosion[] = []
  const { x, y, power } = bomb
  
  // Center explosion
  explosions.push({
    id: `explosion-${bomb.id}-center`,
    x,
    y,
    direction: 'center',
    timer: 30
  })
  
  // Directional explosions
  const directions = [
    { dx: 0, dy: -1, direction: 'up' as const },
    { dx: 0, dy: 1, direction: 'down' as const },
    { dx: -1, dy: 0, direction: 'left' as const },
    { dx: 1, dy: 0, direction: 'right' as const }
  ]
  
  directions.forEach(({ dx, dy, direction }) => {
    for (let i = 1; i <= power; i++) {
      const newX = x + dx * i
      const newY = y + dy * i
      
      // Check bounds
      if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
        break
      }
      
      // Check for walls (stops explosion)
      if (grid[newY][newX] === 'wall') {
        break
      }
      
      explosions.push({
        id: `explosion-${bomb.id}-${direction}-${i}`,
        x: newX,
        y: newY,
        direction,
        timer: 30
      })
      
      // Blocks stop explosion after being destroyed
      if (grid[newY][newX] === 'block') {
        break
      }
    }
  })
  
  return explosions
}

export function checkPlayerCollisions(
  players: Player[],
  explosions: Explosion[]
): Player[] {
  return players.map(player => {
    if (!player.isAlive) return player
    
    const isHit = explosions.some(explosion => 
      explosion.x === player.x && explosion.y === player.y
    )
    
    return {
      ...player,
      isAlive: !isHit
    }
  })
}

export function destroyBlocks(
  grid: ('wall' | 'block' | 'empty')[][],
  explosions: Explosion[]
): {
  newGrid: ('wall' | 'block' | 'empty')[][]
  powerUps: PowerUp[]
} {
  const newGrid = grid.map(row => [...row])
  const powerUps: PowerUp[] = []
  
  explosions.forEach(explosion => {
    const { x, y } = explosion
    if (newGrid[y][x] === 'block') {
      newGrid[y][x] = 'empty'
      
      // Chance to spawn power-up
      if (Math.random() < 0.3) {
        const types: ('speed' | 'bomb' | 'power')[] = ['speed', 'bomb', 'power']
        powerUps.push({
          id: `powerup-${Date.now()}-${x}-${y}`,
          x,
          y,
          type: types[Math.floor(Math.random() * types.length)]
        })
      }
    }
  })
  
  return { newGrid, powerUps }
}