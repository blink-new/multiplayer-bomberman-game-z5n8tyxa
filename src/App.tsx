import { useState, useEffect } from 'react'
import { GameLobby } from './components/GameLobby'
import { GameArena } from './components/GameArena'
import { blink } from './blink/client'

function App() {
  const [currentView, setCurrentView] = useState<'lobby' | 'game'>('lobby')
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setIsLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  const handleJoinGame = (roomId: string) => {
    setCurrentRoomId(roomId)
    setCurrentView('game')
  }

  const handleLeaveGame = () => {
    setCurrentRoomId(null)
    setCurrentView('lobby')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">💣</div>
          <div className="text-xl font-semibold">Loading Bomberman...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">💣</div>
          <h1 className="text-4xl font-bold text-primary mb-4">Bomberman</h1>
          <p className="text-muted-foreground mb-6">
            A real-time multiplayer game where you navigate mazes, place bombs, and compete to be the last player standing!
          </p>
          <div className="text-sm text-muted-foreground">
            Please sign in to start playing
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {currentView === 'lobby' ? (
        <GameLobby onJoinGame={handleJoinGame} />
      ) : currentRoomId ? (
        <GameArena roomId={currentRoomId} onLeaveGame={handleLeaveGame} />
      ) : (
        <GameLobby onJoinGame={handleJoinGame} />
      )}
    </div>
  )
}

export default App