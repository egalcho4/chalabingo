# bingo/management/commands/check_winners.py
from django.core.management.base import BaseCommand
from bingo.game_engine import BingoGameEngine

class Command(BaseCommand):
    help = 'Manually check for winners in current round'
    
    def handle(self, *args, **options):
        engine = BingoGameEngine()
        current_round = engine.get_current_round()
        
        if current_round and current_round.status == 'active':
            self.stdout.write(f"🔍 Checking for winners in round #{current_round.round_number}...")
            engine.check_for_winners(current_round)
            self.stdout.write(self.style.SUCCESS("Winner check completed"))
        else:
            self.stdout.write(self.style.WARNING("No active round to check"))