// src/services/api.js - UPDATED VERSION
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_END_POINT || "https://backendbingo.fanoshomecaretreatment.com/api";
const token = localStorage.getItem('access_token');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  timeout: 10000, // 10 second timeout
});

// Request cache for performance
const requestCache = new Map();

// Add response interceptor for authentication
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      // Redirect to login if not authenticated
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const gameAPI = {
  // Game status
  getGameStatus: () => api.get('/status/'),
  
  // Game Engine Endpoints (NEW - ADDED ONLY THESE)
  startGameEngine: () => api.post('/game-engine/start/'),
  stopGameEngine: () => api.post('/game-engine/stop/'),
  getEngineStatus: () => api.get('/game-engine/status/'),
  runSingleTick: () => api.post('/game-engine/tick/'),
  runGameEngineManual: (params = {}) => api.post('/game-engine/tick/', { params }),
  getEngineStatusQuick: () => api.get('/game-engine/status/', { timeout: 2000 }),
  
  // Game Engine Polling Methods (NEW - ADDED THESE)
  startEnginePolling: (interval = 2000) => {
    // This is a client-side polling implementation
    const intervalId = setInterval(async () => {
      try {
        const response = await api.get('/game-engine/status/', { timeout: 3000 });
        if (response.data) {
          // You can add custom logic here to handle status updates
          console.log('Engine poll:', response.data);
        }
      } catch (error) {
        console.warn('Engine poll error:', error.message);
      }
    }, interval);
    
    return () => clearInterval(intervalId);
  },
  
  // Poll engine status with callback
  pollEngineStatus: (callback, interval = 2000) => {
    let isPolling = true;
    
    const poll = async () => {
      if (!isPolling) return;
      
      try {
        const response = await api.get('/game-engine/status/', { timeout: 3000 });
        if (response.data) {
          callback(null, response.data);
        }
      } catch (error) {
        callback(error, null);
      }
      
      if (isPolling) {
        setTimeout(poll, interval);
      }
    };
    
    poll();
    
    return () => {
      isPolling = false;
    };
  },
  
  // Subscribe to engine status changes (simple version)
  subscribeToEngineStatus: (onUpdate, interval = 2000) => {
    let lastStatus = null;
    let intervalId = null;
    
    const checkStatus = async () => {
      try {
        const response = await api.get('/game-engine/status/', { timeout: 3000 });
        const currentStatus = response.data?.status;
        
        if (currentStatus && JSON.stringify(currentStatus) !== JSON.stringify(lastStatus)) {
          onUpdate(currentStatus);
          lastStatus = currentStatus;
        }
      } catch (error) {
        console.warn('Engine status subscription error:', error.message);
      }
    };
    
    intervalId = setInterval(checkStatus, interval);
    
    // Initial check
    checkStatus();
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  },
  
  // Monitor engine with more control
  createEngineMonitor: (config = {}) => {
    const {
      interval = 2000,
      onStatusChange = () => {},
      onError = () => {},
      autoStart = true
    } = config;
    
    let monitorInterval = null;
    let isMonitoring = false;
    let lastStatus = null;
    
    const checkEngine = async () => {
      if (!isMonitoring) return;
      
      try {
        const response = await api.get('/game-engine/status/', { timeout: 3000 });
        const newStatus = response.data?.status;
        
        if (newStatus && JSON.stringify(newStatus) !== JSON.stringify(lastStatus)) {
          onStatusChange(newStatus, lastStatus);
          lastStatus = newStatus;
        }
      } catch (error) {
        onError(error);
      }
    };
    
    const start = () => {
      if (isMonitoring) return;
      isMonitoring = true;
      monitorInterval = setInterval(checkEngine, interval);
      checkEngine(); // Initial check
    };
    
    const stop = () => {
      isMonitoring = false;
      if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
      }
    };
    
    const getStatus = () => ({
      isMonitoring,
      lastStatus,
      interval
    });
    
    if (autoStart) {
      start();
    }
    
    return {
      start,
      stop,
      getStatus,
      checkNow: checkEngine
    };
  },
  
  // Lightweight status for frequent polling
  getLightweightStatus: () => api.get('/lightweight-status/'),
  
  // Poll for updates
  pollUpdates: (lastPoll) => api.get('/poll/', { params: { last_poll: lastPoll } }),
  
  // Available cards
  getAvailableCards: () => {
    const cacheKey = 'available_cards';
    const cached = requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 2000) { // 2 second cache
      return Promise.resolve(cached.data);
    }
    
    return api.get('/available-cards/').then(response => {
      requestCache.set(cacheKey, {
        timestamp: Date.now(),
        data: response
      });
      //console.log(response)
      return response;
    });
  },
  
  // Player count
  getPlayerCount: () => {
    const cacheKey = 'player_count';
    const cached = requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache
      return Promise.resolve(cached.data);
    }
    
    return api.get('/player-count/').then(response => {
      requestCache.set(cacheKey, {
        timestamp: Date.now(),
        data: response
      });
      return response;
    });
  },
  
  // Card selection
  selectCard: (roundId, cardNumber) => 
    api.post(`/rounds/${roundId}/select_card/`, { card_number: cardNumber }),
  
  deselectCard: (roundId, cardNumber) => 
    api.post(`/rounds/${roundId}/deselect_card/`, { card_number: cardNumber }),
  
  // Current round
  getCurrentRound: () => api.get('/rounds/current/'),
  
  // Clear cache
  clearCache: () => requestCache.clear(),
};

// Clear cache every 5 minutes
setInterval(() => {
  requestCache.clear();
}, 5 * 60 * 1000);

// Export default for backward compatibility
export default api;