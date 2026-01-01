import {Link} from 'react-router-dom'
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


export default GameCard