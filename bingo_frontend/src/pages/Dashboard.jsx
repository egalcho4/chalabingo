import { useQuery } from '@tanstack/react-query'
import {  transactionsAPI } from '../api/transactions'
import {gamesAPI} from '../api/games'
import { Link } from 'react-router-dom'
import { Gamepad2, Users, Trophy, Clock } from 'lucide-react'
import GameCard from '../components/BingoCard'

const Dashboard = () => {
  const { data: games } = useQuery({
    queryKey: ['active-games'],
    queryFn: () => gamesAPI.getActiveGames(),
  })

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => transactionsAPI.getWallet(),
  })

  const stats = [
    {
      label: 'ንቁ ጨዋታዎች',
      value: games?.data?.length || 0,
      icon: Gamepad2,
      color: 'bg-blue-500',
    },
    {
      label: 'የቦርሳ ሒሳብ',
      value: `${wallet?.data[0]?.balance || 0} ብር`,
      icon: Trophy,
      color: 'bg-green-500',
    },
    {
      label: 'የተጫወትኩት',
      value: '0',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      label: 'ያሸነፍኩት',
      value: '0 ብር',
      icon: Trophy,
      color: 'bg-yellow-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">ዋና ገጽ</h1>
        <Link
          to="/games"
          className="btn-primary flex items-center space-x-2"
        >
          <Gamepad2 className="h-5 w-5" />
          <span>ሁሉንም ጨዋታዎች ይመልከቱ</span>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card flex items-center space-x-4"
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

      {/* Active Games */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">ንቁ ጨዋታዎች</h2>
          <Clock className="h-5 w-5 text-gray-400" />
        </div>

        <div className="space-y-4">
          {games?.data?.slice(0, 3).map((game) => (
            <GameCard key={game.id} game={game} />
          ))}

          {(!games || games.data?.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <p>አሁን ምንም ንቁ ጨዋታ የለም</p>
              <Link to="/games" className="text-primary-600 hover:underline">
                አዲስ ጨዋታ ይፍጠሩ
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard