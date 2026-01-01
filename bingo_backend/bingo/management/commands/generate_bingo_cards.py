# bingo/management/commands/generate_bingo_cards.py
from django.core.management.base import BaseCommand
from django.db import transaction
from bingo.models import BingoCard
import random

class Command(BaseCommand):
    help = 'Generate 200 unique bingo cards'
    
    def handle(self, *args, **kwargs):
        cards_created = 0
        existing_cards = BingoCard.objects.count()
        
        if existing_cards >= 200:
            self.stdout.write(self.style.WARNING('Already have 200 cards. No new cards created.'))
            return
        
        cards_to_create = 200 - existing_cards
        
        with transaction.atomic():
            for card_num in range(existing_cards + 1, existing_cards + cards_to_create + 1):
                # Generate unique numbers for each column
                columns = {
                    'B': random.sample(range(1, 16), 5),
                    'I': random.sample(range(16, 31), 5),
                    'N': random.sample(range(31, 46), 5),
                    'G': random.sample(range(46, 61), 5),
                    'O': random.sample(range(61, 76), 5),
                }
                
                # Sort each column
                for col in columns.values():
                    col.sort()
                
                # Transpose to row-major format for easier checking
                numbers = []
                for row in range(5):
                    row_numbers = []
                    for letter in ['B', 'I', 'N', 'G', 'O']:
                        row_numbers.append(columns[letter][row])
                    numbers.append(row_numbers)
                
                # Create card
                BingoCard.objects.create(
                    card_number=card_num,
                    numbers=numbers
                )
                cards_created += 1
        
        self.stdout.write(self.style.SUCCESS(f'Successfully created {cards_created} bingo cards. Total: {existing_cards + cards_created}'))