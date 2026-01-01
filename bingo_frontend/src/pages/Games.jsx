import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { gamesAPI } from '../api/games'
import { useAuth } from '../context/AuthContext'
import { 
  Gamepad2, 
  Users, 
  Trophy, 
  Clock, 
  Plus, 
  Search, 
  Filter,
  TrendingUp,
  Zap
} from 'lucide-react'

const Games = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all') // all, waiting, active, completed
  
  const { isAdmin } = useAuth()

  // Games query
  const { data: games, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => gamesAPI.getGames(),
  })

  // Filter games based on search and filter
  const filteredGames = games?.data?.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.admin_username?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filter === 'all' || game.status === filter
    
    return matchesSearch && matchesFilter
  })

  // Stats
  const stats = [
    {
      label: 'ሁሉም ጨዋታዎች',
      value: games?.data?.length || 0,
      icon: Gamepad2,
      color: 'bg-blue-500',
    },
    {
      label: 'በጥበቃ ላይ',
      value: games?.data?.filter(g => g.status === 'waiting').length || 0,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      label: 'በመጫወት ላይ',
      value: games?.data?.filter(g => g.status === 'active').length || 0,
      icon: Zap,
      color: 'bg-green-500',
    },
    {
      label: 'አማካኝ ሽልማት',
      value: `${Math.round(games?.data?.reduce((acc, g) => acc + parseFloat(g.prize_pool), 0) / (games?.data?.length || 1)) || 0} ብር`,
      icon: Trophy,
      color: 'bg-purple-500',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ጨዋታዎች</h1>
          <p className="text-gray-600">ተጫውቱ እና ተሸንፉ</p>
        </div>
        
        {isAdmin && (
          <Link
            to="/admin"
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>አዲስ ጨዋታ ፍጠር</span>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card flex items-center space-x-4 hover:shadow-lg transition-shadow"
          >
            <div className={`p-3 rounded-full ${stat.color} text-white`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ጨዋታ ይፈልጉ..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">ሁሉም ጨዋታዎች</option>
              <option value="waiting">በጥበቃ ላይ</option>
              <option value="active">በመጫወት ላይ</option>
              <option value="completed">የተጠናቀቀ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      {filteredGames?.length === 0 ? (
        <div className="card text-center py-12">
          <Gamepad2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">ጨዋታ አልተገኘም</h3>
          <p className="text-gray-600 mb-6">ከፍለጋዎ ጋር የሚስማማ ጨዋታ የለም</p>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilter('all')
            }}
            className="btn-primary"
          >
            ሁሉንም ጨዋታዎች አሳይ
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames?.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* How to Play */}
      <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200">
        <h3 className="text-xl font-bold text-primary-900 mb-4 flex items-center">
          <TrendingUp className="h-6 w-6 mr-2" />
          እንዴት መጫወት እንደሚቻል
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center">
                <span className="font-bold">1</span>
              </div>
              <h4 className="font-bold text-primary-800">ካርድ ግዛ</h4>
            </div>
            <p className="text-primary-700">
              ከጨዋታ ውስጥ ቢንጎ ካርድ ይግዙ። እያንዳንዱ ካርድ የተለየ ቁጥሮች ይኖሩታል።
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center">
                <span className="font-bold">2</span>
              </div>
              <h4 className="font-bold text-primary-800">ቁጥሮችን ይከታተሉ</h4>
            </div>
            <p className="text-primary-700">
              ቁጥሮች ሲጠሩ ካርድዎ በራስ-ሰር ይመሰረታል። የድል ንድፍ ይፈጥራሉ።
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary-600 text-white rounded-full flex items-center justify-center">
                <span className="font-bold">3</span>
              </div>
              <h4 className="font-bold text-primary-800">ሽልማት ያሸንፉ</h4>
            </div>
            <p className="text-primary-700">
              የድል ንድፍ ከፈጠሩ 80% የሽልማት ገንዘብ ያሸንፋሉ!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Game Card Component
const GameCard = ({ game }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'በመጫወት ላይ'
      case 'waiting': return 'በጥበቃ ላይ'
      case 'completed': return 'የተጠናቀቀ'
      default: return status
    }
  }

  return (
    <Link to={`/games/${game.id}`}>
      <div className="card hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer h-full">
        {/* Game Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{game.name}</h3>
            <p className="text-sm text-gray-600">አስተዳዳሪ: {game.admin_username}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(game.status)}`}>
            {getStatusText(game.status)}
          </span>
        </div>

        {/* Game Details */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Users className="h-4 w-4 mr-2" />
              <span>ተጫዋቾች</span>
            </div>
            <span className="font-bold">
              {game.player_count}/{game.min_players}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Trophy className="h-4 w-4 mr-2" />
              <span>ሽልማት</span>
            </div>
            <span className="font-bold text-green-600">
              {game.prize_pool} ብር
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-600">
              <Gamepad2 className="h-4 w-4 mr-2" />
              <span>የካርድ ዋጋ</span>
            </div>
            <span className="font-bold">
              {game.entry_fee_per_card} ብር
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            game.status === 'waiting' && game.can_join
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : game.status === 'active'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-700 cursor-not-allowed'
          }`}
          onClick={(e) => {
            if (game.status === 'completed') e.preventDefault()
          }}
        >
          {game.status === 'waiting' 
            ? (game.can_join ? 'ጨዋታ ግባ' : 'ጨዋታ አልተሞላም')
            : game.status === 'active'
            ? 'ጨዋታን ቀጥል'
            : 'ጨዋታ አልቋል'
          }
        </button>

        {/* My Cards Info */}
        {game.my_cards_count > 0 && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              <span className="font-bold">{game.my_cards_count}</span> ካርዶች ገዝተዋል
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}

export default Games