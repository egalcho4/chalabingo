// src/components/GameRoom.jsx - OPTIMIZED FULL VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gameAPI } from './api';
import styles from './Bingo.module.css';
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
// Safe data access helper
const safeGet = (obj, path, defaultValue = null) => {
  if (!obj) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  return result;
};

// Memoized PlayerCards component
const PlayerCards = React.memo(({ 
  selectedCards, 
  availableCards, 
  calledNumbers, 
  lastCalledNumber,
  containerRef
}) => {
  if (selectedCards.length === 0) {
    return (
      <div className={styles.playerCardSection}>
        <div className={styles.playerCardTitle}>No Active Cards</div>
        <div className={styles.noCardsMessage}>
          Select cards in the waiting period of the next round!
        </div>
      </div>
    );
  }

  return (
    <div className={styles.playerCardSection}>
      <div className={styles.playerCardTitle}>Your Cards ({selectedCards.length})</div>
      <div 
        className={styles.playerCardsContainer}
        ref={containerRef}
      >
        {selectedCards.map(cardNumber => {
          const cardData = availableCards.find(card => card?.card_number === cardNumber);
          
          if (!cardData || !cardData.numbers) return null;
          
          const rows = cardData.numbers;
          
          // Transpose rows to columns for Bingo display
          const columns = [];
          for (let i = 0; i < 5; i++) {
            const column = [];
            for (let j = 0; j < 5; j++) {
              column.push(rows[j][i]);
            }
            columns.push(column);
          }
          
          const columnLetters = ['B', 'I', 'N', 'G', 'O'];
          
          return (
            <div key={`card-${cardNumber}`} className={styles.playerCardWrapper}>
              <div className={styles.playerCardHeader} >
                Card #{cardNumber}
              </div>
              <div className={styles.miniCard}>
                <div className={styles.miniCardHeader}>
                  {columnLetters.map((letter) => (
                    <div key={letter} className={styles.miniCardHeaderCell}>
                      {letter}
                    </div>
                  ))}
                </div>
                
                <div className={styles.miniCardNumbers}>
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className={styles.miniCardRow}>
                      {Array.from({ length: 5 }).map((_, colIndex) => {
                        if (rowIndex === 2 && colIndex === 2) {
                          return (
                            <div key={colIndex} className={`${styles.miniCell} ${styles.freeCell}`}>
                              Free
                            </div>
                          );
                        }
                        
                        const num = columns[colIndex][rowIndex];
                        const isMarked = calledNumbers.includes(num);
                        const isCurrent = num === lastCalledNumber;
                        
                        return (
                          <div 
                            key={colIndex} 
                            className={`${styles.miniCell} ${
                              isCurrent 
                                ? styles.miniCurrent 
                                : isMarked 
                                  ? styles.miniMarked 
                                  : ''
                            }`}
                          >
                            {num}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

PlayerCards.displayName = 'PlayerCards';

const GameRoom = () => {
  // Main game state
  const [round, setRound] = useState({
    id: null,
    round_number: 0,
    status: 'waiting',
    time_remaining: 60,
    total_stake: 0,
    called_numbers: [],
    winner: null,
    winning_card: null,
    prize_pool: 0,
    winning_pattern: null
  });
  
  const [player, setPlayer] = useState({
    cards: [],
    wallet_balance: 0,
    has_won: false,
    winning_card: null
  });
  
  const [game, setGame] = useState({
    recent_calls: [],
    player_count: 0,
    total_cards: 200,
    selected_cards: 0
  });
  
  const [timestamp, setTimestamp] = useState(null);
  const [availableCards, setAvailableCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [lastPollTime, setLastPollTime] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showNoWinnerModal, setShowNoWinnerModal] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [selectionTimer, setSelectionTimer] = useState(60);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnectionError, setIsConnectionError] = useState(false);
  const [isSelectingCard, setIsSelectingCard] = useState(false);
  const [localCardUpdates, setLocalCardUpdates] = useState({});
  const [nextRoundCountdown, setNextRoundCountdown] = useState(5);
  const [engineStatus, setEngineStatus] = useState(null);
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [engineMonitor, setEngineMonitor] = useState(null);
  
  // Refs
  const pollIntervalRef = useRef(null);
  const selectionTimerRef = useRef(null);
  const nextRoundTimerRef = useRef(null);
  const lastWinnerRoundRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastLoadTimeRef = useRef(0);
  const previousRoundStatusRef = useRef('waiting');
  const isUpdatingCardsRef = useRef(false);
  const showModalRef = useRef(false);
  const modalShownForRoundRef = useRef(0);
  const currentRoundRef = useRef(0);
  const loadDataTimeoutRef = useRef(null);
  const playerCardsContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isScrollingRef = useRef(false);
  const previousSelectedCardsRef = useRef([]);
  const { user, logout } = useAuth()
  const scrollRestorationTimeoutRef = useRef(null);
const isUserScrollingRef = useRef(false);
 

const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Check for token parameter on component mount
  useEffect(() => {
    const token = searchParams.get('token')
    console.log(token)
    if (token) {
      // Save token to localStorage
      localStorage.setItem('access_token', token)
      
      // Remove token from URL for security
      navigate('/', { replace: true })
      
      // Optionally, you can auto-login with the token here
      // For now, just save it and let user login manually if needed
    }
  }, [searchParams, navigate])
  // Add this effect to start monitoring the engine
  useEffect(() => {
    let autoStartAttempted = false;
    
    // Create engine monitor
    const monitor = gameAPI.createEngineMonitor({
      interval: 2000,
      onStatusChange: (newStatus, oldStatus) => {
        console.log('Engine status changed:', oldStatus?.status, '->', newStatus?.status);
        setEngineStatus(newStatus);
        setIsEngineRunning(newStatus?.status === 'running');
        
        // Auto-start the engine if it's not started
        if (newStatus?.status === 'not_started' && !autoStartAttempted) {
          console.log('Engine is not started, auto-starting...');
          autoStartAttempted = true;
          
          // Add a small delay before starting
          setTimeout(() => {
            handleStartEngine();
          }, 1000);
        }
      },
      onError: (error) => {
        console.error('Engine monitor error:', error);
      },
      autoStart: true
    });
    
    setEngineMonitor(monitor);
    
    // Also do an immediate check on mount
    setTimeout(() => {
      const quickCheck = async () => {
        try {
          const response = await gameAPI.getEngineStatusQuick();
          const status = response.data?.status?.status;
          if (status === 'not_started' && !autoStartAttempted) {
            console.log('Immediate check: engine not started, auto-starting...');
            autoStartAttempted = true;
            handleStartEngine();
          }
        } catch (error) {
          console.warn('Quick engine check failed:', error.message);
        }
      };
      quickCheck();
    }, 500);
    
    // Cleanup
    return () => {
      if (monitor) {
        monitor.stop();
      }
    };
  }, []);

  // Save scroll position when scrolling
  // Save scroll position when scrolling - UPDATED VERSION
useEffect(() => {
  const container = playerCardsContainerRef.current;
  
  const handleScrollStart = () => {
    isUserScrollingRef.current = true;
  };
  
  const handleScrollEnd = () => {
    if (scrollRestorationTimeoutRef.current) {
      clearTimeout(scrollRestorationTimeoutRef.current);
    }
    
    scrollRestorationTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 100);
  };
  
  const handleScroll = () => {
    if (container && isUserScrollingRef.current) {
      scrollPositionRef.current = container.scrollTop;
    }
  };
  
  if (container) {
    container.addEventListener('scroll', handleScroll);
    container.addEventListener('touchstart', handleScrollStart);
    container.addEventListener('mousedown', handleScrollStart);
    container.addEventListener('touchend', handleScrollEnd);
    container.addEventListener('mouseup', handleScrollEnd);
    container.addEventListener('touchcancel', handleScrollEnd);
  }
  
  return () => {
    if (container) {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('touchstart', handleScrollStart);
      container.removeEventListener('mousedown', handleScrollStart);
      container.removeEventListener('touchend', handleScrollEnd);
      container.removeEventListener('mouseup', handleScrollEnd);
      container.removeEventListener('touchcancel', handleScrollEnd);
    }
    
    if (scrollRestorationTimeoutRef.current) {
      clearTimeout(scrollRestorationTimeoutRef.current);
    }
  };
}, []);

  // Restore scroll position when selectedCards changes
  // Restore scroll position when selectedCards changes - UPDATED VERSION
useEffect(() => {
  // Don't restore scroll if user is currently scrolling
  if (isUserScrollingRef.current) return;
  
  const cardsChanged = JSON.stringify(previousSelectedCardsRef.current) !== JSON.stringify(selectedCards);
  
  if (cardsChanged && playerCardsContainerRef.current && scrollPositionRef.current > 0) {
    // Clear any pending scroll restoration
    if (scrollRestorationTimeoutRef.current) {
      clearTimeout(scrollRestorationTimeoutRef.current);
    }
    
    // Wait a bit longer to ensure DOM is fully updated
    scrollRestorationTimeoutRef.current = setTimeout(() => {
      if (playerCardsContainerRef.current && !isUserScrollingRef.current) {
        // Smooth scroll to position
        playerCardsContainerRef.current.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'smooth'
        });
      }
    }, 300); // Increased delay for better stability
  }
  
  // Update previous cards ref
  previousSelectedCardsRef.current = [...selectedCards];
  
  return () => {
    if (scrollRestorationTimeoutRef.current) {
      clearTimeout(scrollRestorationTimeoutRef.current);
    }
  };
}, [selectedCards]);

  // Add these functions to control the engine
  const handleStartEngine = async () => {
    try {
      console.log('Starting game engine...');
      const response = await gameAPI.startGameEngine();
      console.log('Engine start response:', response.data);
      setIsEngineRunning(true);
      
      // Refresh status immediately
      if (engineMonitor) {
        engineMonitor.checkNow();
      }
    } catch (error) {
      console.error('Failed to start engine:', error);
    }
  };

  const handleStopEngine = async () => {
    try {
      console.log('Stopping game engine...');
      const response = await gameAPI.stopGameEngine();
      console.log('Engine stop response:', response.data);
      setIsEngineRunning(false);
      
      // Refresh status immediately
      if (engineMonitor) {
        engineMonitor.checkNow();
      }
    } catch (error) {
      console.error('Failed to stop engine:', error);
    }
  };

  const handleRunSingleTick = async () => {
    try {
      console.log('Running single tick...');
      const response = await gameAPI.runSingleTick();
      console.log('Single tick response:', response.data);
    } catch (error) {
      console.error('Failed to run single tick:', error);
    }
  };

  // Optimized round updater
  const updateRound = useCallback((updates) => {
    setRound(prev => {
      let changed = false;
      const newRound = { ...prev };
      
      Object.keys(updates).forEach(key => {
        if (newRound[key] !== updates[key]) {
          newRound[key] = updates[key];
          changed = true;
        }
      });
      
      return changed ? newRound : prev;
    });
  }, []);

  // Optimized player updater
  const updatePlayer = useCallback((updates) => {
    setPlayer(prev => {
      let changed = false;
      const newPlayer = { ...prev };
      
      Object.keys(updates).forEach(key => {
        if (JSON.stringify(newPlayer[key]) !== JSON.stringify(updates[key])) {
          newPlayer[key] = updates[key];
          changed = true;
        }
      });
      
      return changed ? newPlayer : prev;
    });
  }, []);

  // Optimized game updater
  const updateGame = useCallback((updates) => {
    setGame(prev => {
      let changed = false;
      const newGame = { ...prev };
      
      Object.keys(updates).forEach(key => {
        if (JSON.stringify(newGame[key]) !== JSON.stringify(updates[key])) {
          newGame[key] = updates[key];
          changed = true;
        }
      });
      
      return changed ? newGame : prev;
    });
  }, []);

  // Load game data
  const loadGameData = useCallback(async (isInitialLoad = false, forceReload = false) => {
    if (!isMountedRef.current) return;
    
    const now = Date.now();
    if (!forceReload && !isInitialLoad && now - lastLoadTimeRef.current < 2000) {
      return;
    }
    
    if (loadDataTimeoutRef.current) {
      clearTimeout(loadDataTimeoutRef.current);
      loadDataTimeoutRef.current = null;
    }
    
    try {
      setError(null);
      
      const [statusResponse, cardsResponse] = await Promise.all([
        gameAPI.getLightweightStatus().catch(err => {
          console.warn('Status error:', err);
          return { data: {} };
        }),
        gameAPI.getAvailableCards().catch(err => {
          console.warn('Cards error:', err);
          return { data: { cards: [] } };
        })
      ]);
      
      const newData = statusResponse.data || {};
      const cardsData = safeGet(cardsResponse, 'data.cards', []);
      
      const currentRoundStatus = safeGet(newData, 'round.status', 'waiting');
      const previousRoundStatus = previousRoundStatusRef.current;
      const currentRoundNumber = safeGet(newData, 'round.round_number', 0);
      
      currentRoundRef.current = currentRoundNumber;
      previousRoundStatusRef.current = currentRoundStatus;
      
      // CHECK FOR WINNER
      if (currentRoundStatus === 'finished') {
        const winner = safeGet(newData, 'round.winner');
        
        if (currentRoundNumber > lastWinnerRoundRef.current && 
            modalShownForRoundRef.current < currentRoundNumber &&
            !showModalRef.current) {
          
          lastWinnerRoundRef.current = currentRoundNumber;
          modalShownForRoundRef.current = currentRoundNumber;
          showModalRef.current = true;
          
          if (winner) {
            const isUserWinner = safeGet(newData, 'player.has_won', false) ||
                                safeGet(newData, 'round.winner') === 'You' ||
                                (safeGet(newData, 'player.cards', []) || []).some(card => 
                                  safeGet(card, 'card_number') === safeGet(newData, 'round.winning_card')
                                );
            
            setWinnerInfo({
              winner: winner,
              card: safeGet(newData, 'round.winning_card'),
              prize: safeGet(newData, 'round.prize_pool', 0),
              pattern: safeGet(newData, 'round.winning_pattern', 'Full House'),
              round: currentRoundNumber,
              isUserWinner: isUserWinner
            });
            
            setShowWinnerModal(true);
            setNextRoundCountdown(5);
            startNextRoundCountdown();
          } else {
            setShowNoWinnerModal(true);
            setNextRoundCountdown(5);
            startNextRoundCountdown();
          }
        }
      } else if (currentRoundStatus === 'waiting' && previousRoundStatus === 'finished') {
        setShowWinnerModal(false);
        setShowNoWinnerModal(false);
        showModalRef.current = false;
        
        if (nextRoundTimerRef.current) {
          clearInterval(nextRoundTimerRef.current);
          nextRoundTimerRef.current = null;
        }
        
        setNextRoundCountdown(5);
      }
      
      if (Object.keys(newData).length > 0) {
        updateRound({
          id: safeGet(newData, 'round.id', round.id),
          round_number: currentRoundNumber,
          status: currentRoundStatus,
          time_remaining: safeGet(newData, 'round.time_remaining', round.time_remaining),
          total_stake: safeGet(newData, 'round.total_stake', round.total_stake),
          called_numbers: safeGet(newData, 'round.called_numbers', round.called_numbers),
          winner: safeGet(newData, 'round.winner', round.winner),
          winning_card: safeGet(newData, 'round.winning_card', round.winning_card),
          prize_pool: safeGet(newData, 'round.prize_pool', round.prize_pool),
          winning_pattern: safeGet(newData, 'round.winning_pattern', round.winning_pattern)
        });
        
        updatePlayer({
          cards: safeGet(newData, 'player.cards', player.cards),
          wallet_balance: safeGet(newData, 'player.wallet_balance', player.wallet_balance),
          has_won: safeGet(newData, 'player.has_won', player.has_won),
          winning_card: safeGet(newData, 'player.winning_card', player.winning_card)
        });
        
        updateGame({
          recent_calls: safeGet(newData, 'game.recent_calls', game.recent_calls),
          player_count: safeGet(newData, 'game.player_count', game.player_count),
          total_cards: safeGet(newData, 'game.total_cards', game.total_cards),
          selected_cards: safeGet(newData, 'game.selected_cards', game.selected_cards)
        });
        
        const newTimestamp = safeGet(newData, 'timestamp');
        if (newTimestamp && newTimestamp !== timestamp) {
          setTimestamp(newTimestamp);
        }
        
        setIsGameActive(currentRoundStatus === 'active');
        
        const timeRemaining = safeGet(newData, 'round.time_remaining', 60);
        setSelectionTimer(Math.max(0, timeRemaining));
        
        if (newData.timestamp) {
          setLastPollTime(newData.timestamp);
        }
      }
      
      if (cardsData.length > 0) {
        const mergedCards = cardsData.map(card => {
          const cardNumber = card.card_number;
          if (localCardUpdates[cardNumber]) {
            return { ...card, ...localCardUpdates[cardNumber] };
          }
          return card;
        });
        
        setAvailableCards(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(mergedCards)) {
            return mergedCards;
          }
          return prev;
        });
        
        const myCards = mergedCards.filter(card => card?.is_mine);
        const newSelectedCards = myCards.map(card => card?.card_number).filter(Boolean);
        setSelectedCards(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(newSelectedCards)) {
            return newSelectedCards;
          }
          return prev;
        });
      }
      
      setIsLoading(false);
      setIsConnectionError(false);
      lastLoadTimeRef.current = Date.now();
      
    } catch (error) {
      console.error('Error loading game data:', error);
      
      if (isMountedRef.current) {
        if (error.isNetworkError || error.code === 'ECONNABORTED') {
          setIsConnectionError(true);
          setError('Connection issue. Will retry...');
        } else if (error.response?.status !== 401) {
          setError('Failed to load game data');
        }
        setIsLoading(false);
      }
    } finally {
      isUpdatingCardsRef.current = false;
    }
  }, [round, player, game, timestamp, localCardUpdates]);

  // Start countdown for next round
  const startNextRoundCountdown = useCallback(() => {
    if (nextRoundTimerRef.current) {
      clearInterval(nextRoundTimerRef.current);
    }
    
    nextRoundTimerRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setNextRoundCountdown(prev => {
          if (prev <= 1) {
            clearInterval(nextRoundTimerRef.current);
            nextRoundTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  }, []);

  // Poll for updates
  const pollForUpdates = useCallback(async () => {
    if (!lastPollTime || !isMountedRef.current) return;
    
    if (showModalRef.current) {
      return;
    }
    
    try {
      const response = await gameAPI.pollUpdates(lastPollTime);
      
      const currentRoundStatus = response.data.round_status;
      
      if (currentRoundStatus === 'finished' && round.status === 'active') {
        loadGameData(false, true);
        return;
      }
      
      const updates = response.data.updates || [];
      let roundChanged = false;
      let gameChanged = false;
      const roundUpdates = {};
      const gameUpdates = {};
      
      updates.forEach(update => {
        switch (update.type) {
          case 'new_number':
          case 'current_number':
            // Update recent calls
            const newRecentCall = {
              letter: update.letter,
              number: update.number,
              called_at: update.timestamp
            };
            
            // Only update if different from first recent call
            if (game.recent_calls.length === 0 || 
                game.recent_calls[0].number !== newRecentCall.number) {
              gameChanged = true;
              gameUpdates.recent_calls = [newRecentCall, ...game.recent_calls.slice(0, 3)];
            }
            
            // Update called numbers
            if (!round.called_numbers.includes(update.number)) {
              roundChanged = true;
              roundUpdates.called_numbers = [...round.called_numbers, update.number];
            }
            break;
            
          case 'player_count':
            if (game.player_count !== update.count) {
              gameChanged = true;
              gameUpdates.player_count = update.count;
            }
            break;
        }
      });
      
      if (roundChanged) {
        updateRound(roundUpdates);
      }
      
      if (gameChanged) {
        updateGame(gameUpdates);
      }
      
      if (response.data.timestamp && response.data.timestamp !== lastPollTime) {
        setLastPollTime(response.data.timestamp);
      }
      
    } catch (error) {
      console.error('Polling error:', error);
      if (error.isNetworkError) {
        setIsConnectionError(true);
      }
    }
  }, [lastPollTime, round.status, round.called_numbers, game.recent_calls, game.player_count, loadGameData, updateRound, updateGame]);

  // Handle card selection
  const handleCardSelect = async (cardNumber) => {
    if (!round.id || round.status !== 'waiting' || isSelectingCard) {
      return;
    }
    
    try {
      setIsSelectingCard(true);
      isUpdatingCardsRef.current = true;
      
      setLocalCardUpdates(prev => ({
        ...prev,
        [cardNumber]: { is_mine: true, is_available: false }
      }));
      
      setSelectedCards(prev => [...prev, cardNumber]);
      
      updatePlayer({
        wallet_balance: player.wallet_balance - 10,
        cards: [...player.cards, { card_number: cardNumber }]
      });
      
      updateRound({
        total_stake: round.total_stake + 10
      });
      
      const response = await gameAPI.selectCard(round.id, cardNumber);
      
      if (response.data.success) {
        updatePlayer({
          wallet_balance: response.data.wallet_balance
        });
        
        updateRound({
          total_stake: response.data.total_stake
        });
        
        setLocalCardUpdates(prev => {
          const newUpdates = { ...prev };
          delete newUpdates[cardNumber];
          return newUpdates;
        });
      }
    } catch (error) {
      console.error('Error selecting card:', error);
      
      setLocalCardUpdates(prev => {
        const newUpdates = { ...prev };
        delete newUpdates[cardNumber];
        return newUpdates;
      });
      
      setSelectedCards(prev => prev.filter(num => num !== cardNumber));
      
      updatePlayer({
        wallet_balance: player.wallet_balance + 10,
        cards: player.cards.filter(card => card.card_number !== cardNumber)
      });
      
      updateRound({
        total_stake: round.total_stake - 10
      });
      
      if (!error.isNetworkError) {
        alert(error.response?.data?.error || 'Failed to select card');
      }
    } finally {
      setTimeout(() => {
        setIsSelectingCard(false);
        isUpdatingCardsRef.current = false;
      }, 300);
    }
  };

  // Handle card deselection
  const handleCardDeselect = async (cardNumber) => {
    if (!round.id || round.status !== 'waiting' || isSelectingCard) {
      return;
    }
    
    try {
      setIsSelectingCard(true);
      isUpdatingCardsRef.current = true;
      
      setLocalCardUpdates(prev => ({
        ...prev,
        [cardNumber]: { is_mine: false, is_available: true }
      }));
      
      setSelectedCards(prev => prev.filter(num => num !== cardNumber));
      
      updatePlayer({
        wallet_balance: player.wallet_balance + 10,
        cards: player.cards.filter(card => card.card_number !== cardNumber)
      });
      
      updateRound({
        total_stake: round.total_stake - 10
      });
      
      const response = await gameAPI.deselectCard(round.id, cardNumber);
      
      if (response.data.success) {
        updatePlayer({
          wallet_balance: response.data.wallet_balance
        });
        
        updateRound({
          total_stake: response.data.total_stake
        });
        
        setLocalCardUpdates(prev => {
          const newUpdates = { ...prev };
          delete newUpdates[cardNumber];
          return newUpdates;
        });
      }
    } catch (error) {
      console.error('Error deselecting card:', error);
      
      setLocalCardUpdates(prev => {
        const newUpdates = { ...prev };
        delete newUpdates[cardNumber];
        return newUpdates;
      });
      
      setSelectedCards(prev => [...prev, cardNumber]);
      
      updatePlayer({
        wallet_balance: player.wallet_balance - 10,
        cards: [...player.cards, { card_number: cardNumber }]
      });
      
      updateRound({
        total_stake: round.total_stake + 10
      });
      
      if (!error.isNetworkError) {
        alert(error.response?.data?.error || 'Failed to deselect card');
      }
    } finally {
      setTimeout(() => {
        setIsSelectingCard(false);
        isUpdatingCardsRef.current = false;
      }, 300);
    }
  };

  // Handle card click
  const handleCardClick = (cardNumber, isMine, isAvailable) => {
    if (!isAvailable && !isMine) return;
    if (isSelectingCard) return;
    
    if (isMine) {
      handleCardDeselect(cardNumber);
    } else {
      handleCardSelect(cardNumber);
    }
  };

  // Initialize
  useEffect(() => {
    isMountedRef.current = true;
    
    loadGameData(true);
    
    const setupPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      pollIntervalRef.current = setInterval(() => {
        if (!showModalRef.current) {
          pollForUpdates();
        }
      }, 2000);
    };
    
    setupPolling();
    
    return () => {
      isMountedRef.current = false;
      clearInterval(pollIntervalRef.current);
      clearInterval(selectionTimerRef.current);
      clearInterval(nextRoundTimerRef.current);
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }
      gameAPI.clearCache();
    };
  }, [loadGameData, pollForUpdates]);

  // Update timer when status changes
  useEffect(() => {
    if (round.status === 'waiting' && selectionTimer > 0) {
      clearInterval(selectionTimerRef.current);
      selectionTimerRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setSelectionTimer(prev => {
            if (prev <= 1) {
              clearInterval(selectionTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      clearInterval(selectionTimerRef.current);
    }
    
    return () => {
      clearInterval(selectionTimerRef.current);
    };
  }, [round.status, selectionTimer]);

  // Update modal ref when modal state changes
  useEffect(() => {
    showModalRef.current = showWinnerModal || showNoWinnerModal;
    
    if (showWinnerModal || showNoWinnerModal) {
      clearInterval(selectionTimerRef.current);
      clearInterval(pollIntervalRef.current);
    } else {
      if (isMountedRef.current) {
        loadDataTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            pollIntervalRef.current = setInterval(pollForUpdates, 2000);
          }
        }, 1000);
      }
    }
    
    return () => {
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }
    };
  }, [showWinnerModal, showNoWinnerModal, pollForUpdates]);

  // Winner Modal Component
  const WinnerModal = () => {
     if (!showWinnerModal || !winnerInfo) return null;
    
    const currentCall = game.recent_calls[0] || { letter: 'B', number: 1 };
    
    return (
      <div className={styles.winnerModalSection}>
        <div className={styles.modalSectionContent}>
          <div className={styles.winnerHeader}>
            <div className={styles.winnerFireworks}>🎆🎇✨🎆🎇✨</div>
            <h1 className={styles.winnerTitle}>🎉 BINGO! 🎉</h1>
            <div className={styles.winnerFireworks}>✨🎆🎇✨🎆🎇</div>
          </div>
          
          <div className={styles.winnerBody}>
            {winnerInfo.isUserWinner ? (
              <>
                <div className={styles.winnerSubtitle}>CONGRATULATIONS!</div>
                <div className={styles.winnerUserWon}>YOU ARE THE WINNER! 🏆</div>
                <div className={styles.winnerPrizeHighlight}>
                  🎊 {winnerInfo.prize || 0} ETB 🎊
                </div>
              </>
            ) : (
              <>
                <div className={styles.winnerSubtitle}>WE HAVE A WINNER!</div>
                <div className={styles.winnerDetails}>
                  <div className={styles.winnerName}>
                    <span className={styles.winnerLabel}>Winner:</span>
                    <span className={styles.winnerValue}>{winnerInfo.winner || 'Anonymous'}</span>
                  </div>
                  <div className={styles.winnerCardInfo}>
                    <span className={styles.winnerLabel}>Winning Card:</span>
                    <span className={styles.winnerValue}>#{winnerInfo.card || 'Unknown'}</span>
                  </div>
                  <div className={styles.winnerPattern}>
                    <span className={styles.winnerLabel}>Pattern:</span>
                    <span className={styles.winnerValue}>{winnerInfo.pattern || 'Full House'}</span>
                  </div>
                  <div className={styles.winnerPrize}>
                    <span className={styles.winnerLabel}>Prize:</span>
                    <span className={styles.winnerValue}>{winnerInfo.prize || 0} ETB</span>
                  </div>
                </div>
              </>
            )}
            
            <div className={styles.winnerRoundInfo}>
              Round #{winnerInfo.round || round.round_number || 0} completed
            </div>
          </div>
          
          <div className={styles.winnerFooter}>
            <div className={styles.winnerCountdown}>
              <div className={styles.countdownText}>
                Next round starting in {nextRoundCountdown} seconds...
              </div>
              <div className={styles.countdownBar}>
                <div 
                  className={styles.countdownProgress}
                  style={{ width: `${(nextRoundCountdown / 5) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className={styles.currentCallDuringWin}>
              <div className={styles.winningCall}>
                Last called: <span className={styles.winningCallNumber}>
                  {currentCall.letter}-{currentCall.number}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const NoWinnerModal = () => {
    if (!showNoWinnerModal) return null;
    
    const currentCall = game.recent_calls[0] || { letter: 'B', number: 1 };
    const calledNumbers = round.called_numbers || [];
    
    return (
      <div className={styles.noWinnerModalSection}>
        <div className={styles.modalSectionContent}>
          <div className={styles.noWinnerHeader}>
            <div className={styles.noWinnerIcon}>❌</div>
            <h1 className={styles.noWinnerTitle}>No Winner This Round</h1>
          </div>
          
          <div className={styles.noWinnerBody}>
            <div className={styles.noWinnerMessage}>
              All 75 numbers were called but no one got Bingo!
            </div>
            
            <div className={styles.noWinnerDetails}>
              <div className={styles.noWinnerDetailItem}>
                <span className={styles.noWinnerLabel}>Round:</span>
                <span className={styles.noWinnerValue}>#{round.round_number || 0}</span>
              </div>
              <div className={styles.noWinnerDetailItem}>
                <span className={styles.noWinnerLabel}>Total Calls:</span>
                <span className={styles.noWinnerValue}>{calledNumbers.length}/75</span>
              </div>
              <div className={styles.noWinnerDetailItem}>
                <span className={styles.noWinnerLabel}>Last Called:</span>
                <span className={styles.noWinnerValue}>{currentCall.letter}-{currentCall.number}</span>
              </div>
            </div>
            
            <div className={styles.noWinnerInfo}>
              The prize pool will be carried over to the next round!
            </div>
          </div>
          
          <div className={styles.noWinnerFooter}>
            <div className={styles.noWinnerCountdown}>
              <div className={styles.countdownText}>
                Next round starting in {nextRoundCountdown} seconds...
              </div>
              <div className={styles.countdownBar}>
                <div 
                  className={styles.countdownProgress}
                  style={{ width: `${(nextRoundCountdown / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Card Selection Component
  const CardSelection = () => {
    return (
      <div className={styles.cardSection}>
        <div className={styles.cardSelectionSection}>
          <div className={styles.selectionHeader}>
            <div className={styles.selectionGameInfo}>
              <div className={styles.selectionInfoItem}>
                <span className={`${styles.selectionInfoValue} ${styles.highlight}`}>
                  {game.player_count || 0}
                </span>
                <span className={styles.selectionInfoLabel}>Players</span>
              </div>
              <div className={styles.selectionInfoItem}>
                <span className={styles.selectionInfoValue}>
                  {(round.total_stake || 0).toFixed(2)*0.8}
                </span>
                <span className={styles.selectionInfoLabel}>Pot</span>
              </div>
              <div className={styles.selectionInfoItem}>
                <span className={`${styles.selectionInfoValue} ${styles.highlight}`}>10</span>
                <span className={styles.selectionInfoLabel}>Bet</span>
              </div>
              <div className={styles.selectionInfoItem}>
                <div className={styles.selectionTimer}>
                  <span className={styles.timerValue}>{selectionTimer}</span>
                  <span className={styles.timerLabel}>s</span>
                </div>
                <span className={styles.selectionInfoLabel}>Next</span>
              </div>
              <div className={styles.selectionInfoItem}>
                <div className={styles.selectionInfoValue}>{(player.wallet_balance || 0).toFixed(2)}</div>
                <span className={styles.selectionInfoLabel}>Wallet</span>
              </div>
            </div>
          </div>
          
          <div className={styles.selectionContent}>
            <div className={styles.cardsHeader}>
              {isSelectingCard && (
                <div className={styles.selectionInProgress}>
                  Processing...
                </div>
              )}
            </div>
            
            <div className={styles.cardsGrid}>
              {availableCards.map(card => {
                if (!card) return null;
                
                const cardNumber = card.card_number;
                const localUpdate = localCardUpdates[cardNumber];
                
                const isMine = localUpdate?.is_mine !== undefined ? localUpdate.is_mine : card.is_mine;
                const isAvailable = localUpdate?.is_available !== undefined ? localUpdate.is_available : card.is_available;
                
                let cardClass = styles.cardIndexItem;
                if (isMine) cardClass += ` ${styles.selected}`;
                else if (!isAvailable) cardClass += ` ${styles.taken}`;
                
                return (
                  <div
                    key={cardNumber}
                    className={cardClass}
                    onClick={() => handleCardClick(cardNumber, isMine, isAvailable)}
                    style={{ 
                      pointerEvents: isSelectingCard ? 'none' : 'auto',
                      opacity: isSelectingCard && (isMine || !isAvailable) ? 0.7 : 1 
                    }}
                  >
                    {cardNumber}
                    {!isAvailable && !isMine && <div className={styles.takenIndicator}>✗</div>}
                    {isMine && <div className={styles.myCardIndicator}>★</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Game Screen Component
  const GameScreen = () => {
    const currentCall = game.recent_calls[0] || { letter: 'B', number: 1 };
    const calledNumbers = round.called_numbers || [];
    const lastCalledNumber = currentCall.number;
    
    const bingoColumns = {
      B: Array.from({ length: 15 }, (_, i) => i + 1),
      I: Array.from({ length: 15 }, (_, i) => i + 16),
      N: Array.from({ length: 15 }, (_, i) => i + 31),
      G: Array.from({ length: 15 }, (_, i) => i + 46),
      O: Array.from({ length: 15 }, (_, i) => i + 61)
    };
    
    return (
      <div className={styles.gameSection}>
        <div className={styles.gameInfo}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Derash</span>
            <span className={styles.infoValue}>{(round.total_stake || 0).toFixed(2)*0.8}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Players</span>
            <span className={styles.infoValue}>{game.player_count || 0}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Bet</span>
            <span className={styles.infoValue}>10</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Calls</span>
            <span className={`${styles.infoValue} ${styles.gameProgress}`}>
              {calledNumbers.length}/75
            </span>
          </div>
        </div>
        
        <div className={styles.mainGameLayout}>
          <div className={styles.leftPanel}>
            <div className={styles.numbersContainer}>
              <div className={styles.bingoHeader}>
                {['B', 'I', 'N', 'G', 'O'].map((letter, index) => (
                  <div key={letter} className={styles.bingoLetter}>{letter}</div>
                ))}
              </div>
              
              <div className={styles.bingoGrid}>
                {Array.from({ length: 15 }).map((_, rowIndex) => (
                  <div key={rowIndex} className={styles.bingoRow}>
                    <div 
                      className={`${styles.bingoCell} ${
                        lastCalledNumber === bingoColumns.B[rowIndex] 
                          ? styles.currentCalled 
                          : calledNumbers.includes(bingoColumns.B[rowIndex]) 
                            ? styles.called 
                            : ''
                      }`}
                    >
                      {bingoColumns.B[rowIndex]}
                    </div>
                    
                    <div 
                      className={`${styles.bingoCell} ${
                        lastCalledNumber === bingoColumns.I[rowIndex] 
                          ? styles.currentCalled 
                          : calledNumbers.includes(bingoColumns.I[rowIndex]) 
                            ? styles.called 
                            : ''
                      }`}
                    >
                      {bingoColumns.I[rowIndex]}
                    </div>
                    
                    <div 
                      className={`${styles.bingoCell} ${
                        lastCalledNumber === bingoColumns.N[rowIndex] 
                          ? styles.currentCalled 
                          : calledNumbers.includes(bingoColumns.N[rowIndex]) 
                            ? styles.called 
                            : ''
                      }`}
                    >
                      {bingoColumns.N[rowIndex]}
                    </div>
                    
                    <div 
                      className={`${styles.bingoCell} ${
                        lastCalledNumber === bingoColumns.G[rowIndex] 
                          ? styles.currentCalled 
                          : calledNumbers.includes(bingoColumns.G[rowIndex]) 
                            ? styles.called 
                            : ''
                      }`}
                    >
                      {bingoColumns.G[rowIndex]}
                    </div>
                    
                    <div 
                      className={`${styles.bingoCell} ${
                        lastCalledNumber === bingoColumns.O[rowIndex] 
                          ? styles.currentCalled 
                          : calledNumbers.includes(bingoColumns.O[rowIndex]) 
                            ? styles.called 
                            : ''
                      }`}
                    >
                      {bingoColumns.O[rowIndex]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className={styles.rightPanel}>
            <div className={styles.rightContent}>
              <div className={styles.circularCallContainer}>
                <div className={styles.circularCall}>
                  <div className={styles.outerRing}></div>
                  <div className={styles.middleRing}>
                    <div className={styles.innerCircle}>
                      <div className={styles.callLetter}>{currentCall.letter}</div>
                      <div className={styles.callSeparator}></div>
                      <div className={styles.callNumber}>{currentCall.number}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles.recentCallsSection}>
                <div className={styles.recentCallsTitle}></div>
                <div className={styles.recentCallsContainer}>
                  {game.recent_calls.slice(0, 3).map((call, index) => (
                    <div key={index} className={styles.recentCallItem}>
                      <div className={styles.callLetter}>{call.letter}</div>
                      <div className={styles.callNumber}>{call.number}</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <PlayerCards
                key={`player-cards-${selectedCards.join('-')}`} 
                selectedCards={selectedCards}
                availableCards={availableCards}
                calledNumbers={calledNumbers}
                lastCalledNumber={lastCalledNumber}
                containerRef={playerCardsContainerRef}
                style={{ minHeight: 0 }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Loading State
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <div className={styles.loadingText}>Loading Bingo Game...</div>
      </div>
    );
  }

  // Error State
  if (error && !isConnectionError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <div className={styles.errorText}>{error}</div>
        <button 
          className={styles.retryButton}
          onClick={() => loadGameData(true)}
        >
          Retry
        </button>
      </div>
    );
  }

  // MAIN RENDER
  return (
    <div className={styles.appContainer}>
      {showWinnerModal && <WinnerModal />}
      {showNoWinnerModal && <NoWinnerModal />}
      
      {!showWinnerModal && !showNoWinnerModal && (
        <>
          {round.status === 'waiting' ? (
            <CardSelection />
          ) : round.status === 'active' || isGameActive ? (
            <GameScreen />
          ) : round.status === 'finished' ? (
            <div className={styles.roundFinished}>
              <div className={styles.finishedContent}>
                <h3>Round #{round.round_number || 0} Finished</h3>
                <p>Waiting for next round...</p>
                <div className={styles.loadingSpinnerSmall}></div>
              </div>
            </div>
          ) : (
            <div className={styles.noRound}>
              <h3>No Active Game</h3>
              <p>Waiting for game to start...</p>
              <button onClick={() => loadGameData(true)}>Refresh</button>
            </div>
          )}
        </>
      )}
      
      {isConnectionError && (
        <div className={styles.connectionError}>
          Connection issue - attempting to reconnect...
        </div>
      )}
    </div>
  );
};

export default GameRoom;