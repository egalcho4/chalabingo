# bingo/tasks.py (simplified version)
from django.utils import timezone
from django.core.management.base import BaseCommand
from .game_engine import BingoGameEngine
from .models import GameRound, CalledNumber
import time

def process_game_round():
    """Process current game round"""
    engine = BingoGameEngine()
    engine.process_game_round()
    return "Game round processed"

def call_next_number_if_needed():
    """Check if we need to call next number"""
    active_round = GameRound.objects.filter(status='active').first()
    
    if not active_round:
        return "No active round"
    
    # Check when last number was called
    last_call = CalledNumber.objects.filter(
        game_round=active_round
    ).order_by('-called_at').first()
    
    if not last_call:
        # No numbers called yet, call first number
        engine = BingoGameEngine()
        engine.call_number(active_round)
        return "First number called"
    
    # Check if 2 seconds have passed since last call
    time_since_last_call = (timezone.now() - last_call.called_at).total_seconds()
    
    if time_since_last_call >= 2:
        engine = BingoGameEngine()
        engine.call_number(active_round)
        return "New number called"
    
    return f"Waiting... {2 - time_since_last_call:.1f}s remaining"

# Management command to run as cron job
class Command(BaseCommand):
    help = 'Process bingo game rounds and call numbers'
    
    def handle(self, *args, **options):
        self.stdout.write("Starting bingo game processing...")
        
        try:
            # Process game round (starts new rounds, ends waiting periods)
            process_game_round()
            self.stdout.write("✓ Game round processed")
            
            # Call numbers if needed
            result = call_next_number_if_needed()
            self.stdout.write(f"✓ {result}")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))