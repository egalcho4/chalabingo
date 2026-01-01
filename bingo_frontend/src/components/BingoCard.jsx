const BingoCard = ({ card, calledNumbers }) => {
  const getLetterColor = (letter) => {
    const colors = {
      'B': 'bg-bingo-b',
      'I': 'bg-bingo-i',
      'N': 'bg-bingo-n',
      'G': 'bg-bingo-g',
      'O': 'bg-bingo-o',
    }
    return colors[letter] || 'bg-gray-200'
  }

  const getNumberColor = (number, letter) => {
    if (number === 'FREE') return 'bg-yellow-100 border-yellow-300'
    
    const isCalled = calledNumbers.includes(number)
    if (isCalled) {
      const colors = {
        'B': 'bg-blue-100 border-blue-300',
        'I': 'bg-red-100 border-red-300',
        'N': 'bg-green-100 border-green-300',
        'G': 'bg-yellow-100 border-yellow-300',
        'O': 'bg-purple-100 border-purple-300',
      }
      return colors[letter] + ' text-gray-800'
    }
    
    return 'bg-white border-gray-200'
  }

  if (!card?.card_display) {
    return (
      <div className="card animate-pulse">
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-900">ካርድ #{card.id}</h3>
          <span className="text-sm text-gray-500">
            {card.marked_count}/{card.total_numbers}
          </span>
        </div>
        {card.win_status !== 'playing' && (
          <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium inline-block ${
            card.win_status === 'winner'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {card.win_status === 'winner' ? 'አሸናፊ' : 'ስንት'}
          </div>
        )}
      </div>

      {/* Bingo Card Grid */}
      <div className="space-y-1">
        {/* Header Row */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {['B', 'I', 'N', 'G', 'O'].map((letter) => (
            <div
              key={letter}
              className={`bingo-cell ${getLetterColor(letter)} text-white font-bold`}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Number Rows */}
        {card.card_display.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-1">
            {row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`bingo-cell ${getNumberColor(cell.number, cell.letter)} ${
                  cell.marked ? 'marked' : ''
                } ${cell.number === 'FREE' ? 'free' : ''}`}
              >
                {cell.number === 'FREE' ? (
                  <span className="text-sm font-bold">ነፃ</span>
                ) : (
                  <>
                    {cell.number}
                    {cell.marked && (
                      <div className="absolute top-1 right-1">
                        <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default BingoCard