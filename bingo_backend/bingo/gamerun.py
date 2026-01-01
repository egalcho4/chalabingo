# views.py - BACKGROUND ENGINE RUNNER
import time
import threading
import atexit
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import close_old_connections
from .game_engine import BingoGameEngine
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Global engine state
engine_runner = None
engine_thread = None

class GameEngineRunner:
    """
    Background game engine runner that processes ticks every second
    """
    def __init__(self):
        self.running = False
        self.interval = 1.0  # 1 second between ticks
        self.engine = None
        self.thread = None
        self.tick_count = 0
        self.start_time = None
        self.last_tick_time = None
        self.errors = 0
        self.max_errors = 10
        self.shutdown_flag = threading.Event()
        
    def start(self):
        """Start the engine runner in background thread"""
        if self.running:
            logger.warning("Engine already running")
            return False
            
        logger.info(" Starting game engine runner")
        self.running = True
        self.start_time = datetime.now()
        self.shutdown_flag.clear()
        
        # Start in background thread
        self.thread = threading.Thread(target=self.run_engine_loop, daemon=True)
        self.thread.start()
        
        return True
    
    def stop(self):
        """Stop the engine runner"""
        if not self.running:
            return False
            
        logger.info(" Stopping game engine runner")
        self.running = False
        self.shutdown_flag.set()
        
        if self.engine:
            try:
                self.engine.cleanup()
            except:
                pass
            self.engine = None
            
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
            
        return True
    
    def run_engine_loop(self):
        """Main engine loop running in background thread"""
        logger.info("🏁 Engine loop started")
        self.errors = 0
        
        try:
            # Initialize engine
            self.engine = BingoGameEngine()
            
            while not self.shutdown_flag.is_set() and self.running:
                try:
                    # Close old database connections
                    close_old_connections()
                    
                    # Process game tick
                    self.engine.process_tick()
                    self.tick_count += 1
                    self.last_tick_time = datetime.now()
                    
                    # Log every 10 ticks
                    if self.tick_count % 10 == 0:
                        runtime = datetime.now() - self.start_time
                        logger.info(f"📊 Tick {self.tick_count} | Runtime: {str(runtime).split('.')[0]}")
                    
                    # Reset error count on successful tick
                    self.errors = 0
                    
                    # Sleep for interval (1 second)
                    time.sleep(self.interval)
                    
                except Exception as e:
                    self.errors += 1
                    logger.error(f" Tick error: {e}")
                    
                    if self.errors >= self.max_errors:
                        logger.error(f" Too many errors ({self.errors}), stopping engine")
                        break
                    
                    # Exponential backoff
                    backoff = min(self.interval * (self.errors * 0.5), 10)
                    time.sleep(backoff)
                    
        except Exception as e:
            logger.error(f" Engine loop error: {e}")
        finally:
            # Cleanup
            if self.engine:
                try:
                    self.engine.cleanup()
                except:
                    pass
                self.engine = None
            
            self.running = False
            logger.info(" Engine loop stopped")
    
    def get_status(self):
        """Get current engine status"""
        if not self.start_time:
            return {"status": "not_started"}
        
        return {
            "status": "running" if self.running else "stopped",
            "tick_count": self.tick_count,
            "errors": self.errors,
            "running_time": str(datetime.now() - self.start_time).split('.')[0],
            "last_tick": self.last_tick_time.isoformat() if self.last_tick_time else None,
            "interval": self.interval,
            "thread_alive": self.thread.is_alive() if self.thread else False
        }

# Initialize global runner
engine_runner = GameEngineRunner()

# Auto-start on Django startup (optional)
# Uncomment if you want engine to start automatically
# engine_runner.start()

# Cleanup on exit
def cleanup_engine():
    if engine_runner:
        engine_runner.stop()
atexit.register(cleanup_engine)

# Views
@csrf_exempt
@require_http_methods(["GET", "POST"])
def start_game_engine(request):
    """Start the game engine"""
    try:
        success = engine_runner.start()
        
        if success:
            return JsonResponse({
                "success": True,
                "message": "Game engine started",
                "interval": engine_runner.interval,
                "status": engine_runner.get_status()
            })
        else:
            return JsonResponse({
                "success": False,
                "message": "Engine already running or failed to start"
            })
            
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET", "POST"])
def stop_game_engine(request):
    """Stop the game engine"""
    try:
        success = engine_runner.stop()
        
        return JsonResponse({
            "success": success,
            "message": "Game engine stopped" if success else "Engine not running",
            "status": engine_runner.get_status()
        })
            
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_engine_status(request):
    """Get engine status"""
    return JsonResponse({
        "success": True,
        "status": engine_runner.get_status()
    })

@csrf_exempt
@require_http_methods(["POST"])
def run_single_tick(request):
    """Run a single game tick on demand"""
    try:
        engine = BingoGameEngine()
        close_old_connections()
        
        # Process one tick
        engine.process_tick()
        engine.cleanup()
        
        return JsonResponse({
            "success": True,
            "message": "Single tick completed",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)