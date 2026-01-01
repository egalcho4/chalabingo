# bingo/management/commands/check_cards.py
from django.core.management.base import BaseCommand
from bingo.models import BingoCard
import json

class Command(BaseCommand):
    help = 'Check and create bingo cards if needed'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--create',
            action='store_true',
            help='Create cards if they dont exist',
        )
    
    def handle(self, *args, **options):
        total_cards = BingoCard.objects.count()
        active_cards = BingoCard.objects.filter(is_active=True).count()
        
        self.stdout.write(f"📊 Current card stats:")
        self.stdout.write(f"   Total cards in database: {total_cards}")
        self.stdout.write(f"   Active cards: {active_cards}")
        
        if total_cards == 0 and options['create']:
            self.stdout.write("🃏 No cards found. Creating bingo cards...")
            
            # Create 200 bingo cards
            from bingo.utils import generate_bingo_card
            
            created_count = 0
            for i in range(1, 201):
                try:
                    # Generate card numbers
                    card_numbers = generate_bingo_card()
                    
                    # Create the card
                    BingoCard.objects.create(
                        card_number=i,
                        numbers=card_numbers,
                        is_active=True
                    )
                    created_count += 1
                    
                    if i % 50 == 0:
                        self.stdout.write(f"   Created {i} cards...")
                        
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error creating card {i}: {e}"))
            
            self.stdout.write(self.style.SUCCESS(f"✅ Created {created_count} bingo cards!"))
        elif total_cards == 0:
            self.stdout.write(self.style.WARNING("⚠️ No bingo cards found in database!"))
            self.stdout.write("   Run: python manage.py check_cards --create")
        else:
            self.stdout.write(self.style.SUCCESS("✅ Cards found in database"))
            
            # Show sample cards
            sample_cards = BingoCard.objects.filter(is_active=True)[:3]
            for card in sample_cards:
                self.stdout.write(f"\n   Card #{card.card_number}:")
                self.stdout.write(f"      Numbers: {json.dumps(card.numbers, indent=12)}")