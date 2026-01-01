# bingo/management/commands/process_rounds.py
from django.core.management.base import BaseCommand
from bingo.game_engine import BingoGameEngine

class Command(BaseCommand):
    help = 'Process game rounds (start new rounds, end waiting periods)'
    
    def handle(self, *args, **options):
        engine = BingoGameEngine()
        current_round = engine.process_game_round()
        
        if current_round:
            self.stdout.write(f"Processed round {current_round.round_number} - Status: {current_round.status}")
        else:
            self.stdout.write("No active rounds to process")
        
        self.stdout.write(self.style.SUCCESS("Round processing completed"))