# bingo/management/commands/start_game_engine.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from bingo.game_engine import BingoGameEngine

class Command(BaseCommand):
    help = 'Start the bingo game engine (for development)'
    
    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.SUCCESS('Starting Bingo Game Engine...'))
        
        engine = BingoGameEngine()
        
        # Ensure we have a current round
        current_round = engine.get_current_round()
        self.stdout.write(f'Current Round: #{current_round.round_number} - {current_round.status}')
        
        self.stdout.write(self.style.SUCCESS('Game engine started. Use Celery for production.'))