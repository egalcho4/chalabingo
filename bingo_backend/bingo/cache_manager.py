# bingo/cache_manager.py
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
import json

class BingoCacheManager:
    """Centralized cache management for bingo game"""
    
    # Cache key templates
    ROUND_STATUS = 'round_status_{id}'
    PLAYER_SELECTIONS = 'player_selections_{round_id}_{user_id}'
    AVAILABLE_CARDS = 'available_cards_{round_id}'
    PLAYER_COUNT = 'player_count_{round_id}'
    RECENT_CALLS = 'recent_calls_{round_id}'
    LIGHTWEIGHT_STATUS = 'lightweight_status_{user_id}'
    CALLED_NUMBERS = 'called_numbers_{round_id}'
    
    @classmethod
    def get_cached_round_status(cls, round_id):
        """Get cached round status"""
        key = cls.ROUND_STATUS.format(id=round_id)
        return cache.get(key)
    
    @classmethod
    def set_cached_round_status(cls, round_id, data, timeout=5):
        """Cache round status"""
        key = cls.ROUND_STATUS.format(id=round_id)
        cache.set(key, data, timeout)
    
    @classmethod
    def get_cached_selections(cls, round_id, user_id):
        """Get cached player selections"""
        key = cls.PLAYER_SELECTIONS.format(round_id=round_id, user_id=user_id)
        return cache.get(key)
    
    @classmethod
    def set_cached_selections(cls, round_id, user_id, data, timeout=10):
        """Cache player selections"""
        key = cls.PLAYER_SELECTIONS.format(round_id=round_id, user_id=user_id)
        cache.set(key, data, timeout)
    
    @classmethod
    def invalidate_selections(cls, round_id, user_id=None):
        """Invalidate selections cache"""
        if user_id:
            key = cls.PLAYER_SELECTIONS.format(round_id=round_id, user_id=user_id)
            cache.delete(key)
        else:
            # Delete all user caches for this round
            from django.core.cache import cache
            cache.delete_many([f'player_selections_{round_id}_*'])
    
    @classmethod
    def get_cached_available_cards(cls, round_id):
        """Get cached available cards"""
        key = cls.AVAILABLE_CARDS.format(round_id=round_id)
        return cache.get(key)
    
    @classmethod
    def set_cached_available_cards(cls, round_id, data, timeout=10):
        """Cache available cards"""
        key = cls.AVAILABLE_CARDS.format(round_id=round_id)
        cache.set(key, data, timeout)
    
    @classmethod
    def get_cached_player_count(cls, round_id):
        """Get cached player count"""
        key = cls.PLAYER_COUNT.format(round_id=round_id)
        return cache.get(key)
    
    @classmethod
    def set_cached_player_count(cls, round_id, count, timeout=10):
        """Cache player count"""
        key = cls.PLAYER_COUNT.format(round_id=round_id)
        cache.set(key, count, timeout)
    
    @classmethod
    def invalidate_player_count(cls, round_id):
        """Invalidate player count cache"""
        key = cls.PLAYER_COUNT.format(round_id=round_id)
        cache.delete(key)
    
    @classmethod
    def get_cached_recent_calls(cls, round_id):
        """Get cached recent calls"""
        key = cls.RECENT_CALLS.format(round_id=round_id)
        return cache.get(key)
    
    @classmethod
    def set_cached_recent_calls(cls, round_id, data, timeout=2):
        """Cache recent calls"""
        key = cls.RECENT_CALLS.format(round_id=round_id)
        cache.set(key, data, timeout)
    
    @classmethod
    def get_cached_called_numbers(cls, round_id):
        """Get cached called numbers"""
        key = cls.CALLED_NUMBERS.format(round_id=round_id)
        return cache.get(key)
    
    @classmethod
    def set_cached_called_numbers(cls, round_id, data, timeout=30):
        """Cache called numbers"""
        key = cls.CALLED_NUMBERS.format(round_id=round_id)
        cache.set(key, data, timeout)
    
    @classmethod
    def invalidate_game_caches(cls, round_id):
        """Invalidate all game caches for a round"""
        keys = [
            cls.ROUND_STATUS.format(id=round_id),
            cls.AVAILABLE_CARDS.format(round_id=round_id),
            cls.PLAYER_COUNT.format(round_id=round_id),
            cls.RECENT_CALLS.format(round_id=round_id),
            f"available_cards_{round_id}",
            f"player_count_{round_id}",
        ]
        cache.delete_many(keys)
        
        # Also delete lightweight status caches
        cache.delete_many([f'lightweight_status_*'])