import { createContext, useContext, useEffect, useState } from 'react'

const SoundContext = createContext()

export const SoundProvider = ({ children }) => {
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.5)

  const playSound = (soundName) => {
    if (isMuted) return
    
    const sounds = {
      click: 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3',
      join: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
      win: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3',
      card: 'https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3',
      start: 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-intro-331.mp3',
    }
    
    const audio = new Audio(sounds[soundName])
    audio.volume = volume
    audio.play()
  }

  return (
    <SoundContext.Provider value={{ isMuted, setIsMuted, volume, setVolume, playSound }}>
      {children}
    </SoundContext.Provider>
  )
}

export const useSound = () => useContext(SoundContext)