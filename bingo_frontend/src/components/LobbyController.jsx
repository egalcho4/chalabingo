import { useState, useEffect } from 'react'

export const useLobbyController = (gameId, isAdmin) => {
  const [countdown, setCountdown] = useState(null)
  const [autoStartTimer, setAutoStartTimer] = useState(null)

  // Auto-start when enough players
  useEffect(() => {
    if (!isAdmin) return
    
    // Check every 5 seconds if we should auto-start
    const interval = setInterval(() => {
      // API call to check player count
      // If players >= minPlayers, start countdown
    }, 5000)
    
    return () => clearInterval(interval)
  }, [gameId, isAdmin])

  return { countdown, autoStartTimer }
}