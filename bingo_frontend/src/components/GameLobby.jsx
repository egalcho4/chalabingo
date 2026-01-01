import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {  transactionsAPI } from '../api/transactions'
import {gamesAPI} from '../api/games'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { 
  Users, 
  Trophy, 
  Clock, 
  DollarSign, 
  Gamepad2, 
  Crown,
  ChevronRight,
  Volume2,
  VolumeX,
  MessageCircle,
  Send,
  UserPlus,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles
} from 'lucide-react'

const GameLobby = () => {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const messagesEndRef = useRef(null)
  
  // Chat messages state
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: 'ስርዓት', message: 'ወደ ቢንጎ ጨዋታ እንኳን በደህና መጡ!', time: 'አሁን', type: 'system' },
    { id: 2, user: 'ተጫዋች1', message: 'ሰላም ሁላችሁ! ማን ሁሉ አሉ?', time: '5ሰ', type: 'player' },
    { id: 3, user: 'ተጫዋች2', message: 'እዚህ ነኝ! ጨዋታው መቼ ይጀምራል?', time: '3ሰ', type: 'player' },
  ])

  // Game data query
  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => gamesAPI.getGame(gameId),
    refetchInterval: 3000, // Poll every 3 seconds
  })

  // Game state query
  const { data: gameState } = useQuery({
    queryKey: ['game-state', gameId],
    queryFn: () => gamesAPI.getGameState(gameId),
    refetchInterval: 3000,
  })

  // My cards query
  const { data: myCards } = useQuery({
    queryKey: ['my-cards', gameId],
    queryFn: () => gamesAPI.getMyCards(gameId),
  })

  // Wallet query
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => transactionsAPI.getWallet(),
  })

  // Purchase card mutation
  const purchaseCardMutation = useMutation({
    mutationFn: () => gamesAPI.purchaseCard(gameId),
    onSuccess: (response) => {
      toast.success('ካርድ በተሳካ ሁኔታ ተገዛ!')
      queryClient.invalidateQueries(['my-cards', gameId])
      queryClient.invalidateQueries(['game', gameId])
      queryClient.invalidateQueries(['wallet'])
      
      // Add system message
      addSystemMessage(`🎉 ${user?.username} ካርድ ገዛ!`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'ስህተት ተከስቷል')
    },
  })

  // Start game mutation (admin only)
  const startGameMutation = useMutation({
    mutationFn: () => gamesAPI.startGame(gameId),
    onSuccess: () => {
      toast.success('ጨዋታው ተጀምሯል!')
      queryClient.invalidateQueries(['game', gameId])
      addSystemMessage('🚀 ጨዋታው ጀምሯል! ቁጥሮች መጥራት ይጀምራል...')
      
      // Navigate to game room after 3 seconds
      setTimeout(() => {
        navigate(`/games/${gameId}`)
      }, 3000)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'ስህተት ተከስቷል')
    },
  })

  // Add system message function
  const addSystemMessage = (text) => {
    const newMessage = {
      id: chatMessages.length + 1,
      user: 'ስርዓት',
      message: text,
      time: 'አሁን',
      type: 'system'
    }
    setChatMessages(prev => [...prev, newMessage])
  }

  // Send chat message
  const sendMessage = () => {
    if (!message.trim()) return
    
    const newMessage = {
      id: chatMessages.length + 1,
      user: user?.username,
      message: message.trim(),
      time: 'አሁን',
      type: 'player'
    }
    
    setChatMessages(prev => [...prev, newMessage])
    setMessage('')
    
    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  // Handle purchase card
  const handlePurchaseCard = () => {
    if (!wallet?.data?.[0]) {
      toast.error('የቦርሳ ሒሳብ አልተገኘም')
      return
    }

    if (wallet.data[0].balance < game?.data?.entry_fee_per_card) {
      toast.error('በቂ ሒሳብ የለዎትም')
      return
    }

    purchaseCardMutation.mutate()
  }

  // Handle start game
  const handleStartGame = () => {
    if (!isAdmin) {
      toast.error('የአስተዳዳሪ መዳረሻ ብቻ')
      return
    }

    startGameMutation.mutate()
  }

  // Play sound
  const playSound = (soundType = 'click') => {
    if (!soundEnabled || isMuted) return
    
    const audio = new Audio()
    switch(soundType) {
      case 'click':
        audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3'
        break
      case 'join':
        audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3'
        break
      case 'start':
        audio.src = 'https://assets.mixkit.co/sfx/preview/mixkit-game-show-intro-331.mp3'
        break
      default:
        return
    }
    audio.volume = 0.3
    audio.play().catch(e => console.log('Audio play failed:', e))
  }

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  if (gameLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-amharic">ጨዋታ በመጫን ላይ...</p>
        </div>
      </div>
    )
  }

  if (!game?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">ጨዋታ አልተገኘም</h2>
          <button
            onClick={() => navigate('/games')}
            className="btn-primary mt-4"
          >
            ወደ ጨዋታዎች ተመለስ
          </button>
        </div>
      </div>
    )
  }

  const gameData = game.data
  const canJoin = gameData.can_join
  const myCardsCount = myCards?.data?.length || 0
  const playerCount = gameData.player_count || 0
  const minPlayers = gameData.min_players || 2

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 bg-bingo-pattern font-amharic">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/games')}
                className="flex items-center text-gray-600 hover:text-primary-600 transition-colors"
              >
                <ChevronRight className="h-5 w-5 rotate-180" />
                <span className="ml-1">ተመለስ</span>
              </button>
              
              <div className="h-6 w-px bg-gray-300"></div>
              
              <h1 className="text-xl font-bold text-gray-900">{gameData.name}</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title={isMuted ? 'ድምጽ አብራ' : 'ድምጽ አጥፋ'}
              >
                {isMuted ? (
                  <VolumeX className="h-5 w-5 text-gray-600" />
                ) : (
                  <Volume2 className="h-5 w-5 text-gray-600" />
                )}
              </button>
              
              {isAdmin && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  አስተዳዳሪ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Game Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Game Stats Card */}
            <div className="bg-white rounded-2xl shadow-ethiopia p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Gamepad2 className="h-6 w-6 text-primary-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">የጨዋታ መረጃ</h2>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600 font-medium">
                    {playerCount} ተጫዋቾች ተገኝተዋል
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 p-4 rounded-xl border border-primary-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-primary-700">የካርድ ዋጋ</p>
                      <p className="text-2xl font-bold text-primary-900">
                        {gameData.entry_fee_per_card} ብር
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary-500 opacity-50" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-yellow-700">ሽልማት</p>
                      <p className="text-2xl font-bold text-yellow-900">
                        {gameData.prize_pool} ብር
                      </p>
                    </div>
                    <Trophy className="h-8 w-8 text-yellow-500 opacity-50" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">ተጫዋቾች</p>
                      <p className="text-2xl font-bold text-green-900">
                        {playerCount}/{minPlayers}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-green-500 opacity-50" />
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-700">የእርስዎ ካርዶች</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {myCardsCount}
                      </p>
                    </div>
                    <Gamepad2 className="h-8 w-8 text-purple-500 opacity-50" />
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>የተጫዋች ሂደት</span>
                  <span>{playerCount}/{minPlayers}</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, (playerCount / minPlayers) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {playerCount >= minPlayers 
                    ? 'ጨዋታው ለመጀመር ዝግጁ ነው! 🎉'
                    : `በጥቂት ${minPlayers - playerCount} ተጫዋቾች ያስፈልጋል`
                  }
                </p>
              </div>
            </div>

            {/* Game Rules Card */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Sparkles className="h-5 w-5 text-yellow-500 mr-2" />
                የጨዋታ ደንቦች
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="h-6 w-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-600 text-sm font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">ካርድ ግዛ</h4>
                    <p className="text-gray-600">እያንዳንዱ ተጫዋች ከ{gameData.max_cards_per_player} ካርድ ድረስ መግዛት ይችላል</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="h-6 w-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">ሽልማት ስርጭት</h4>
                    <p className="text-gray-600">80% ለአሸናፊ፣ 20% ለአስተዳዳሪ</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="h-6 w-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-yellow-600 text-sm font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">የድል ንድፍ</h4>
                    <p className="text-gray-600">
                      {gameData.win_pattern === 'full_house' && 'ሙሉ ቤት (ሁሉም ቁጥሮች)'}
                      {gameData.win_pattern === 'one_line' && 'አንድ መስመር'}
                      {gameData.win_pattern === 'two_lines' && 'ሁለት መስመሮች'}
                      {gameData.win_pattern === 'four_corners' && 'አራት ጥጎች'}
                      {gameData.win_pattern === 'diagonal' && 'ዲያግናል'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="h-6 w-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 text-sm font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">ራስ-ሰር አርትዕ</h4>
                    <p className="text-gray-600">ቁጥሮች ሲጠሩ ካርድዎ በራስ-ሰር ይመሰረታል</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Card Section */}
            {canJoin && (
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl shadow-xl p-6 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">ካርድ ግዛ እና ጨዋታ ጀምር</h3>
                    <p className="text-primary-100">ብዙ ካርዶች = ብዙ ዕድሎች!</p>
                  </div>
                  <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Crown className="h-6 w-6" />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">የአንድ ካርድ ዋጋ</span>
                      <span className="text-2xl font-bold">{gameData.entry_fee_per_card} ብር</span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">የእርስዎ ሒሳብ</span>
                      <span className="text-xl font-bold text-green-300">
                        {wallet?.data?.[0]?.balance || 0} ብር
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        handlePurchaseCard()
                        playSound('click')
                      }}
                      disabled={purchaseCardMutation.isPending}
                      className="w-full bg-white text-primary-600 py-3 px-4 rounded-lg font-bold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <DollarSign className="h-5 w-5" />
                      <span>
                        {purchaseCardMutation.isPending
                          ? 'በመግዛት ላይ...'
                          : `ካርድ ግዛ (${gameData.entry_fee_per_card} ብር)`}
                      </span>
                    </button>
                    
                    {myCardsCount > 0 && (
                      <p className="text-center text-sm text-primary-100 mt-3">
                        {myCardsCount}/{gameData.max_cards_per_player} ካርዶች ገዝተዋል
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">የጨዋታ ሁኔታ</span>
                      <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
                        በጥበቃ ላይ
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">የቀሩ ተጫዋቾች</span>
                      <span className="text-xl font-bold">
                        {Math.max(0, minPlayers - playerCount)}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        handleStartGame()
                        playSound('start')
                      }}
                      disabled={startGameMutation.isPending || playerCount < minPlayers || !isAdmin}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-bold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                      <Gamepad2 className="h-5 w-5" />
                      <span>
                        {startGameMutation.isPending
                          ? 'በመጀመር ላይ...'
                          : 'ጨዋታ ጀምር'}
                      </span>
                    </button>
                    
                    {playerCount < minPlayers && (
                      <p className="text-center text-sm text-yellow-300 mt-3">
                        ጨዋታ ለመጀመር {minPlayers - playerCount} ተጫዋቾች ያስፈልጋል
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Players & Chat */}
          <div className="space-y-8">
            {/* Players List */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">ተጫዋቾች ({playerCount})</h2>
                </div>
                
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>ከ{gameData.entry_fee_per_card} ብር</span>
                </div>
              </div>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {/* Sample Players - Replace with real data */}
                {Array.from({ length: Math.max(5, playerCount) }).map((_, index) => {
                  const isMe = index === 0
                  const hasCards = index < myCardsCount
                  const isAdminPlayer = index === 0 && isAdmin
                  
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                        isMe ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            isMe ? 'bg-primary-100 text-primary-600' :
                            hasCards ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            <UserPlus className="h-5 w-5" />
                          </div>
                          {isAdminPlayer && (
                            <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
                              <Crown className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {isMe ? user?.username : `ተጫዋች${index + 1}`}
                            </span>
                            {isMe && (
                              <span className="text-xs bg-primary-100 text-primary-600 px-2 py-1 rounded-full">
                                እርስዎ
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            {hasCards ? (
                              <>
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span>ካርዶች: {index + 1}</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 text-yellow-500" />
                                <span>በጥበቃ...</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {hasCards ? `${gameData.entry_fee_per_card * (index + 1)} ብር` : '-'}
                        </div>
                        <div className="text-xs text-gray-500">የገዛው</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">ጠቅላላ ሽልማት ማከማቻ</span>
                  <span className="font-bold text-green-600">{gameData.prize_pool} ብር</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">አሸናፊ ይወስዳል (80%)</span>
                  <span className="font-bold text-green-600">
                    {(gameData.prize_pool * 0.8).toFixed(2)} ብር
                  </span>
                </div>
              </div>
            </div>

            {/* Chat Section */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-purple-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">የጨዋታ ውይይት</h2>
                </div>
                
                <div className="text-sm text-gray-500">
                  {chatMessages.length} መልዕክቶች
                </div>
              </div>
              
              {/* Chat Messages */}
              <div className="h-64 overflow-y-auto mb-4 space-y-3 p-2">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.type === 'system'
                        ? 'bg-blue-50 border border-blue-100'
                        : msg.user === user?.username
                        ? 'bg-primary-50 border border-primary-100 ml-8'
                        : 'bg-gray-50 border border-gray-100 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${
                          msg.type === 'system' ? 'text-blue-700' :
                          msg.user === user?.username ? 'text-primary-700' : 'text-gray-700'
                        }`}>
                          {msg.user}
                        </span>
                        {msg.type === 'system' && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                            ስርዓት
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{msg.time}</span>
                    </div>
                    <p className={`${
                      msg.type === 'system' ? 'text-blue-600' :
                      msg.user === user?.username ? 'text-primary-600' : 'text-gray-600'
                    }`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Chat Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="መልዕክት ይጻፉ..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                <button
                  onClick={() => {
                    sendMessage()
                    playSound('click')
                  }}
                  disabled={!message.trim()}
                  className="bg-primary-600 text-white p-3 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-500 flex items-center space-x-2">
                <AlertCircle className="h-3 w-3" />
                <span>ጨዋታ ከጀመረ በኋላ መልዕክት መላክ አይችሉም</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Footer */}
        <div className="mt-8 bg-white rounded-2xl shadow-md p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">ፈጣን ድርጊቶች</h3>
              <p className="text-sm text-gray-600">የጨዋታውን ሁኔታ በተጨማሪ ለመቆጣጠር</p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/games/${gameId}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
              >
                <Gamepad2 className="h-4 w-4" />
                <span>ወደ ጨዋታ ቀጥል</span>
              </button>
              
              <button
                onClick={() => navigate('/wallet')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <DollarSign className="h-4 w-4" />
                <span>ቦርሳ አስገባ</span>
              </button>
              
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  toast.success('መገናኛው ተገልብጧል!')
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>ጓደኞች ይጥራ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameLobby