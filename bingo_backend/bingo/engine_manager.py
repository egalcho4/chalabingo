# bingo/engine_manager.py
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
import threading

# Global engine instance and lock
_engine_instance = None
_engine_lock = threading.Lock()

def get_bingo_engine():
    """Get or create singleton engine instance with thread safety"""
    global _engine_instance
    
    with _engine_lock:
        if _engine_instance is None:
            from .game_engine import BingoGameEngine
            _engine_instance = BingoGameEngine()
            
            # Try to auto-resume from cache if it was recently running
            try:
                engine_status = cache.get('bingo_engine_status')
                if engine_status and engine_status.get('is_running'):
                    # Check if it was running recently (last 5 minutes)
                    last_activity = cache.get('bingo_last_activity')
                    
                    if last_activity:
                        # Convert string to datetime if needed
                        if isinstance(last_activity, str):
                            try:
                                last_activity = timezone.datetime.fromisoformat(
                                    last_activity.replace('Z', '+00:00')
                                )
                            except:
                                last_activity = None
                        
                        if last_activity and (timezone.now() - last_activity) < timedelta(minutes=5):
                            print("🔄 Auto-resuming game engine from cache")
                            
                            # Restore engine state
                            _engine_instance._is_running = True
                            
                            # Restore start time
                            start_time_str = engine_status.get('start_time')
                            if start_time_str and isinstance(start_time_str, str):
                                try:
                                    _engine_instance._engine_start_time = timezone.datetime.fromisoformat(
                                        start_time_str.replace('Z', '+00:00')
                                    )
                                except:
                                    _engine_instance._engine_start_time = timezone.now()
                            else:
                                _engine_instance._engine_start_time = timezone.now()
                            
                            _engine_instance._last_activity = last_activity
                            
                            # Start the engine thread
                            _engine_instance._engine_thread = threading.Thread(
                                target=_engine_instance._engine_main_loop,
                                daemon=True,
                                name="BingoGameEngine"
                            )
                            _engine_instance._engine_thread.start()
                            
                            print(f"✓ Game engine resumed (running since: {_engine_instance._engine_start_time})")
            except Exception as e:
                print(f"⚠️ Error auto-starting engine: {e}")
                import traceback
                traceback.print_exc()
        
        return _engine_instance