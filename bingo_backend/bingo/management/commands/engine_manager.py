# bingo/engine_manager.py
from .game_engine_web import WebBingoGameEngine

# Singleton instance
_engine_instance = None

def get_bingo_engine():
    """Get or create singleton engine instance"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = WebBingoGameEngine()
    return _engine_instance