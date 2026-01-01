# reset_game.py
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bingo_backend.settings')
django.setup()

from bingo.models import GameRound, CalledNumber, PlayerSelection

def reset_current_game():
    """Reset the current game to fix duplicate numbers"""
    print("🔄 Resetting current game...")
    
    # Get current active or waiting round
    current_round = GameRound.objects.filter(
        status__in=['waiting', 'active']
    ).order_by('-round_number').first()
    
    if not current_round:
        print("No active round found, creating new one...")
        last_round = GameRound.objects.order_by('-round_number').first()
        new_round_number = last_round.round_number + 1 if last_round else 1
        
        current_round = GameRound.objects.create(
            round_number=new_round_number,
            status='waiting',
            selection_end_time=timezone.now() + timedelta(seconds=60)
        )
        print(f"✅ Created new round #{current_round.round_number}")
        return
    
    print(f"Found round #{current_round.round_number} - Status: {current_round.status}")
    
    if current_round.status == 'active':
        # Delete all called numbers
        deleted_count, _ = CalledNumber.objects.filter(game_round=current_round).delete()
        print(f"🗑️  Deleted {deleted_count} called numbers")
        
        # Reset JSON field
        current_round.called_numbers = []
        current_round.save()
        print("✅ Reset called numbers list")
    
    # Also reset any finished rounds that might have issues
    finished_rounds = GameRound.objects.filter(status='finished')
    for round_obj in finished_rounds:
        # Fix any inconsistencies
        db_numbers = set(CalledNumber.objects.filter(game_round=round_obj).values_list('number', flat=True))
        json_numbers = set(round_obj.called_numbers or [])
        
        if db_numbers != json_numbers:
            print(f"Fixing round #{round_obj.round_number}...")
            round_obj.called_numbers = list(db_numbers)
            round_obj.save()
            print(f"  Fixed: {len(db_numbers)} numbers in sync")
    
    print("\n✅ Game reset complete!")
    print(f"Current round: #{current_round.round_number}")
    print(f"Status: {current_round.status}")
    print(f"Selection ends: {current_round.selection_end_time}")

if __name__ == '__main__':
    from django.utils import timezone
    from datetime import timedelta
    reset_current_game()