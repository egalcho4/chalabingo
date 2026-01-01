// api/games.js - Updated and Corrected
import api from './index'

const gamesAPI = {
  // Get the current continuous game (CRITICAL for your new GameRoom)
   getContinuousGame: () =>
    api.get('/games/continuous/'),

  // Get game state for polling
  getGameState: (gameId) =>
    api.get(`/games/${gameId}/state/`),

  // Get available cards
  getAvailableCards: (gameId) =>
    api.get(`/available_card/`),

  // Purchase specific card
  purchaseCard: (gameId, data) =>
    api.post(`/games/${gameId}/purchase_card/`, data),

  // Get recent calls
  getRecentCalls: (gameId) =>
    api.get(`/games/${gameId}/recent_calls/`),

  // Get user's cards for a specific game (Your frontend uses this exact path)
  getMyCards: (gameId) =>
    api.get(`/bingo-cards/my_cards/?game_id=${gameId}`),

  // Call number (admin)
  callNumber: (gameId) =>
    api.post(`/games/${gameId}/call_number/`),

  // Start game (admin)
  startGame: (gameId) =>
    api.post(`/games/${gameId}/start_game/`),

  // Get all games
  getGames: () =>
    api.get('/games/'),

  // Get specific game
  getGame: (gameId) =>
    api.get(`/games/${gameId}/`),

  // Create game (admin)
  createGame: (data) =>
    api.post('/games/', data),

  // Get active games
  getActiveGames: () =>
    api.get('/games/active_games/'),

  // Get waiting games (useful for listings)
  getWaitingGames: () =>
    api.get('/games/waiting_games/'),
}

export { gamesAPI }