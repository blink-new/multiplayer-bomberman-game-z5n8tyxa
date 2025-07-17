export interface Player {
  id: string
  name: string
  x: number
  y: number
  color: 'red' | 'blue' | 'green' | 'yellow'
  isAlive: boolean
  bombCount: number
  maxBombs: number
  bombPower: number
  speed: number
}

export interface Bomb {
  id: string
  x: number
  y: number
  playerId: string
  timer: number
  power: number
}

export interface Explosion {
  id: string
  x: number
  y: number
  direction: 'center' | 'up' | 'down' | 'left' | 'right'
  timer: number
}

export interface PowerUp {
  id: string
  x: number
  y: number
  type: 'speed' | 'bomb' | 'power'
}

export interface GameState {
  id: string
  players: Player[]
  bombs: Bomb[]
  explosions: Explosion[]
  powerUps: PowerUp[]
  grid: ('wall' | 'block' | 'empty')[][]
  gameStatus: 'waiting' | 'playing' | 'finished'
  winner?: string
  timeLeft: number
}

export interface GameRoom {
  id: string
  name: string
  players: Player[]
  maxPlayers: number
  status: 'waiting' | 'playing' | 'finished'
  createdAt: number
}