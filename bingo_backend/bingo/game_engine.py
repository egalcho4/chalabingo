# bingo/game_engine.py - FIXED WINNER CHECKING
from django.utils import timezone
from django.db import transaction as db_transaction
from datetime import timedelta
import random
from decimal import Decimal
import time
import gc
from django.db import connection
from django.contrib.auth.models import User
from .models import GameRound, CalledNumber, PlayerSelection, BingoCard
from transactions.models import Wallet, Transaction

class BingoGameEngine:
    """Optimized bingo game engine with winner check on every call"""
    
    def __init__(self):
        self.winner_cooldown = 5  # 5 seconds cooldown after winner
        self.call_interval = 2
        self.cache = {}
        self.last_gc_time = time.time()
        self.FREE_POSITION = 12  # Middle position (row 3, col 3) in 5x5 grid
        self.current_round_ended = False  # Track if current round has ended
        
        # Define winning patterns (positions 0-24 in 5x5 grid)
        self.WINNING_PATTERNS = {
            'full_house': set(range(25)),  # All 25 positions
            
            # Diagonals
            'diagonal_1': {0, 6, 12, 18, 24},  # Top-left to bottom-right
            'diagonal_2': {4, 8, 12, 16, 20},  # Top-right to bottom-left
            
            # Four corners
            'four_corners': {0, 4, 20, 24},
            
            # Rows
            'row_1': {0, 1, 2, 3, 4},
            'row_2': {5, 6, 7, 8, 9},
            'row_3': {10, 11, 12, 13, 14},
            'row_4': {15, 16, 17, 18, 19},
            'row_5': {20, 21, 22, 23, 24},
            
            # Columns
            'col_1': {0, 5, 10, 15, 20},
            'col_2': {1, 6, 11, 16, 21},
            'col_3': {2, 7, 12, 17, 22},
            'col_4': {3, 8, 13, 18, 23},
            'col_5': {4, 9, 14, 19, 24},
        }
    
    def get_current_round(self):
        """Get current round with caching for minimum DB hits"""
        cache_key = 'current_round'
        
        # Check cache first (valid for 2 seconds)
        if cache_key in self.cache:
            cached_time, round_obj = self.cache[cache_key]
            if time.time() - cached_time < 2:
                return round_obj
        
        try:
            # Use only() to fetch minimum fields
            round_obj = GameRound.objects.filter(
                status__in=['waiting', 'active']
            ).only('id', 'status', 'round_number', 'selection_end_time', 
                  'start_time', 'called_numbers', 'total_stake').order_by('-id').first()
            
            # Cache result
            self.cache[cache_key] = (time.time(), round_obj)
            
            # Clean cache every 60 seconds
            if time.time() - self.last_gc_time > 60:
                self.clean_cache()
                gc.collect()
                self.last_gc_time = time.time()
            
            return round_obj
        except:
            return None
    
    def clean_cache(self):
        """Clean old cache entries"""
        current_time = time.time()
        keys_to_delete = []
        for key, (cached_time, _) in self.cache.items():
            if current_time - cached_time > 10:  # Remove entries older than 10s
                keys_to_delete.append(key)
        
        for key in keys_to_delete:
            del self.cache[key]
    
    def process_tick(self):
        """Process one game tick with minimal resource usage"""
        try:
            # Close idle connections to save resources
            connection.close_if_unusable_or_obsolete()
            
            round_obj = self.get_current_round()
            
            if not round_obj:
                self.create_new_round()
                return
            
            # Reset round ended flag for new round
            if round_obj.status == 'waiting':
                self.current_round_ended = False
            
            if round_obj.status == 'waiting':
                # Check if selection period has ended
                if round_obj.selection_end_time and timezone.now() >= round_obj.selection_end_time:
                    self.start_game(round_obj)
            
            elif round_obj.status == 'active' and not self.current_round_ended:
                # Only process if current round hasn't ended
                self.process_active_game(round_obj)
                
        except Exception as e:
            print(f"Game tick error: {e}")
    
    def start_game(self, game_round):
        """Start the game round optimized"""
        try:
            # Update only necessary fields
            GameRound.objects.filter(id=game_round.id).update(
                status='active',
                start_time=timezone.now()
            )
            
            print(f"Round {game_round.round_number} started!")
            
            # Invalidate cache
            if 'current_round' in self.cache:
                del self.cache['current_round']
            
            # Mark FREE position on all player cards first
            self.mark_free_position_on_all_cards(game_round)
            
            # Then call the FREE numbers (each player has their own FREE number)
            self.call_free_numbers(game_round)
            
        except Exception as e:
            print(f"Error starting game: {e}")
    
    def mark_free_position_on_all_cards(self, game_round):
        """Mark FREE position (center position 12) on all player cards"""
        try:
            # Get all active selections with their bingo cards
            selections = PlayerSelection.objects.filter(
                game_round=game_round,
                is_active=True
            ).select_related('bingo_card')
            
            updates = []
            
            for sel in selections:
                # Get the actual FREE number from the player's card
                card_numbers_grid = sel.bingo_card.numbers
                
                # The FREE position is at row=2, col=2 (0-indexed)
                # In grid format: card_numbers_grid[col][row]
                # For position 12: row = 12 // 5 = 2, col = 12 % 5 = 2
                row = 2  # Third row (0-indexed)
                col = 2  # Third column (0-indexed) - N column
                
                try:
                    # Get the actual FREE number from the player's card
                    free_number_list = card_numbers_grid[col]  # N column (index 2)
                    free_number = free_number_list[row]  # Third row
                    
                    # Ensure free_number is integer
                    if isinstance(free_number, str):
                        free_number = int(free_number)
                    
                    print(f"  Player {sel.player.username}: FREE number is {free_number}")
                    
                    # Mark the FREE position if not already marked
                    if self.FREE_POSITION not in sel.marked_positions:
                        sel.marked_positions.append(self.FREE_POSITION)
                        sel.marked_numbers.append(free_number)
                        updates.append(sel)
                        
                except (IndexError, ValueError, TypeError) as e:
                    print(f"Error getting FREE number for player {sel.player.username}: {e}")
                    continue
            
            # Batch update
            if updates:
                PlayerSelection.objects.bulk_update(
                    updates, 
                    ['marked_positions', 'marked_numbers']
                )
                print(f"Marked FREE position on {len(updates)} player card(s)")
                        
        except Exception as e:
            print(f"Error marking free position: {e}")
    
    def call_free_numbers(self, game_round):
        """Call all the FREE numbers from player cards"""
        try:
            # Get all unique FREE numbers from player cards
            selections = PlayerSelection.objects.filter(
                game_round=game_round,
                is_active=True
            ).select_related('bingo_card')
            
            free_numbers_called = set()
            
            for sel in selections:
                # Get the actual FREE number from the player's card
                card_numbers_grid = sel.bingo_card.numbers
                
                # The FREE position is at row=2, col=2 (0-indexed)
                row = 2  # Third row
                col = 2  # Third column - N column
                
                try:
                    # Get the actual FREE number from the player's card
                    free_number_list = card_numbers_grid[col]  # N column (index 2)
                    free_number = free_number_list[row]  # Third row
                    
                    # Ensure free_number is integer
                    if isinstance(free_number, str):
                        free_number = int(free_number)
                    
                    # Only call this FREE number if it hasn't been called yet
                    if free_number not in free_numbers_called:
                        # Call this FREE number
                        self.call_specific_number(game_round, free_number, is_free=True)
                        free_numbers_called.add(free_number)
                        
                except (IndexError, ValueError, TypeError) as e:
                    print(f"Error calling FREE number for player {sel.player.username}: {e}")
                    continue
            
            # After calling all FREE numbers, check for winners immediately
            self.check_and_declare_winners_immediately(game_round)
            
        except Exception as e:
            print(f"Error calling FREE numbers: {e}")
    
    def call_specific_number(self, game_round, number, is_free=False):
        """Call a specific number (used for FREE numbers)"""
        try:
            # Determine letter based on number range
            if number <= 15:
                letter = 'B'
            elif number <= 30:
                letter = 'I'
            elif number <= 45:
                letter = 'N'
            elif number <= 60:
                letter = 'G'
            else:
                letter = 'O'
            
            # Create called number record
            CalledNumber.objects.create(
                game_round=game_round,
                letter=letter,
                number=number
            )
            
            # Update game round called numbers
            current_called = game_round.called_numbers or []
            if number not in current_called:
                current_called.append(number)
                game_round.called_numbers = current_called
                game_round.save(update_fields=['called_numbers'])
            
            if is_free:
                print(f"FREE NUMBER CALLED: {letter}-{number}")
            else:
                print(f"{letter}-{number} (Total: {len(current_called)}/75)")
            
            # Mark this number on all player cards
            self.mark_on_cards_optimized(game_round, number)
            
            return number
            
        except Exception as e:
            print(f"Error calling specific number {number}: {e}")
            return None
    
    def process_active_game(self, game_round):
        """Process active game - optimized"""
        try:
            # If round has already ended (winner found), don't process
            if self.current_round_ended:
                print(f"Round already ended, not processing")
                return
            
            # Sync called numbers every 10 calls to prevent desync
            called_count = len(game_round.called_numbers or [])
            if called_count % 10 == 0:  # Sync every 10th call
                self.sync_called_numbers(game_round)
            
            # Use values_list for minimum data fetch
            last_call = CalledNumber.objects.filter(
                game_round=game_round
            ).order_by('-called_at').values_list('called_at', flat=True).first()
            
            if not last_call:
                # Call first regular number after FREE numbers
                self.call_number(game_round)
                return
            
            # Calculate seconds since last call
            seconds_since = (timezone.now() - last_call).total_seconds()
            
            if seconds_since >= self.call_interval:
                self.call_number(game_round)
                
        except Exception as e:
            print(f"Error processing active game: {e}")
    
    def call_number(self, game_round):
        """Call a random number with emergency winner check and forced declaration"""
        try:
            if self.current_round_ended:
                return None
            
            try:
                game_round.refresh_from_db()
            except:
                pass
            
            # Get all called numbers
            already_called_db = set(CalledNumber.objects.filter(
                game_round=game_round
            ).values_list('number', flat=True))
            
            called_from_cache = set(game_round.called_numbers or [])
            all_called = already_called_db.union(called_from_cache)
            
            # Check if all 75 numbers have been called
            if len(all_called) >= 75:
                self.end_game_no_winner(game_round)
                return None
            
            # Generate available numbers (1-75)
            all_numbers = set(range(1, 76))
            available = list(all_numbers - all_called)
            
            if not available:
                self.end_game_no_winner(game_round)
                return None
            
            # Select random number from available
            number = random.choice(available)
            
            # Determine letter based on number range
            if number <= 15:
                letter = 'B'
            elif number <= 30:
                letter = 'I'
            elif number <= 45:
                letter = 'N'
            elif number <= 60:
                letter = 'G'
            else:
                letter = 'O'
            
            try:
                # Record called number
                CalledNumber.objects.create(
                    game_round=game_round,
                    letter=letter,
                    number=number
                )
            except Exception as db_error:
                if 'duplicate' in str(db_error).lower() or 'unique' in str(db_error).lower():
                    if number in available:
                        available.remove(number)
                    if available:
                        number = random.choice(available)
                        if number <= 15:
                            letter = 'B'
                        elif number <= 30:
                            letter = 'I'
                        elif number <= 45:
                            letter = 'N'
                        elif number <= 60:
                            letter = 'G'
                        else:
                            letter = 'O'
                        
                        try:
                            CalledNumber.objects.create(
                                game_round=game_round,
                                letter=letter,
                                number=number
                            )
                        except Exception as e2:
                            return self.call_number_fallback(game_round, available)
                    else:
                        return None
                else:
                    return None
            
            # Update called numbers list
            new_called = list(all_called)
            if number not in new_called:
                new_called.append(number)
            
            game_round.called_numbers = new_called
            game_round.save(update_fields=['called_numbers'])
            
            # Mark this number on all player cards
            self.mark_on_cards_optimized(game_round, number)
            
            print(f"{letter}-{number} (Total: {len(new_called)}/75)")
            
            # Check for winners after every number call
            winner_found = self.check_and_declare_winners_immediately(game_round)
            
            if winner_found:
                return number
            else:
                # If no winner found but many numbers called, do emergency checks
                if len(new_called) >= 40:
                    time.sleep(1)
                    self.emergency_winner_check()
                
                if len(new_called) >= 60:
                    self.check_extreme_winner(game_round)
                
                return number
            
        except Exception as e:
            try:
                self.emergency_winner_check()
            except:
                pass
            
            return None
    
    def call_number_fallback(self, game_round, available):
        """Fallback method for calling numbers"""
        try:
            if not available:
                return None
            
            number = random.choice(available)
            
            if number <= 15:
                letter = 'B'
            elif number <= 30:
                letter = 'I'
            elif number <= 45:
                letter = 'N'
            elif number <= 60:
                letter = 'G'
            else:
                letter = 'O'
            
            # Simple create without transaction
            cn = CalledNumber(
                game_round=game_round,
                letter=letter,
                number=number
            )
            cn.save()
            
            return number
        except:
            return None
    
    def sync_called_numbers(self, game_round):
        """Sync called numbers between database and cache"""
        try:
            # Get all called numbers from database
            db_called = list(CalledNumber.objects.filter(
                game_round=game_round
            ).order_by('called_at').values_list('number', flat=True))
            
            # Update game round cache
            if db_called != (game_round.called_numbers or []):
                game_round.called_numbers = db_called
                game_round.save(update_fields=['called_numbers'])
                print(f"Synced called numbers: {len(db_called)} numbers")
            
            return db_called
        except Exception as e:
            print(f"Error syncing called numbers: {e}")
            return game_round.called_numbers or []
    
    def check_and_declare_winners_immediately(self, game_round, forced_check=False):
        """Check for winners and declare immediately - FIXED VERSION"""
        try:
            # Don't check if round already ended
            if self.current_round_ended and not forced_check:
                print(f"Round already ended, skipping winner check")
                return False
            
            # Force database sync for called numbers
            called_numbers_set = self.sync_called_numbers(game_round)
            called_numbers_set = set(called_numbers_set)
            
            print(f"Checking for winners... Called numbers: {len(called_numbers_set)}")
            
            # FORCE refresh of game round from database
            game_round.refresh_from_db()
            
            # If round is already finished in DB, set flag and skip
            if game_round.status == 'finished':
                print(f"Round already marked as finished in DB")
                self.current_round_ended = True
                return False
            
            # Fetch all active players for this round with their cards
            active_selections = PlayerSelection.objects.filter(
                game_round=game_round,
                is_active=True
            ).select_related('bingo_card', 'player')
            
            winners = []
            winning_patterns = {}
            
            # Check each active player
            for sel in active_selections:
                # FORCE refresh of player selection from database
                try:
                    sel.refresh_from_db()
                except:
                    pass  # If it fails, continue with current object
                
                # Get the card numbers in 5x5 format
                card_numbers_grid = sel.bingo_card.numbers
                
                # Get marked positions (ensure it's a set)
                marked_positions_set = set(sel.marked_positions)
                
                # Check for winning patterns WITH FREE POSITION INCLUDED
                patterns_found = self.check_winning_patterns_with_free(marked_positions_set, sel)
                
                if patterns_found:
                    # Verify that the actual numbers in the pattern have been called
                    valid_patterns = self.verify_patterns_with_called_numbers(
                        patterns_found, 
                        card_numbers_grid, 
                        called_numbers_set,
                        sel
                    )
                    
                    if valid_patterns:
                        # WINNER FOUND!
                        print(f"WINNER CONFIRMED: {sel.player.username}!")
                        winners.append(sel)
                        winning_patterns[sel.id] = {
                            'patterns': valid_patterns,
                            'card_numbers': card_numbers_grid,
                            'marked_positions': list(marked_positions_set),
                            'player_name': sel.player.username,
                            'card_number': sel.bingo_card.card_number
                        }
            
            if winners:
                print(f"Total winners found: {len(winners)}")
                
                # Declare all winners IMMEDIATELY
                self.declare_winners(game_round, winners, winning_patterns)
                return True
            
            print(f"No winners found")
            return False
            
        except Exception as e:
            print(f"Error checking for winners: {e}")
            import traceback
            traceback.print_exc()
            
            # If there's an error, try a forced declaration
            if not self.current_round_ended:
                print(f"Attempting forced winner check...")
                return self.check_and_declare_winners_immediately(game_round, forced_check=True)
            return False
    
    def check_winning_patterns_with_free(self, marked_positions_set, player_selection):
        """Check if marked positions match any winning pattern WITH FREE POSITION"""
        patterns_found = {}
        
        # Always include FREE position if it's not already marked
        if self.FREE_POSITION not in marked_positions_set:
            print(f"Warning: FREE position (12) not marked for {player_selection.player.username}")
            print(f"Current marked positions: {sorted(marked_positions_set)}")
        
        # Check each pattern
        for pattern_name, pattern_positions in self.WINNING_PATTERNS.items():
            # Create a copy of the pattern positions
            pattern_check = pattern_positions.copy()
            
            # IMPORTANT: If this pattern includes the FREE position (12), 
            # we should consider it as automatically marked
            if self.FREE_POSITION in pattern_check:
                # Add FREE position to marked positions for this check
                effective_marked = marked_positions_set.union({self.FREE_POSITION})
                
                # Check if all pattern positions are in marked positions (with FREE)
                if pattern_check.issubset(effective_marked):
                    patterns_found[pattern_name] = list(pattern_check)
                    print(f"Pattern {pattern_name} found for {player_selection.player.username} (with FREE position)")
            else:
                # Pattern doesn't include FREE position, check normally
                if pattern_check.issubset(marked_positions_set):
                    patterns_found[pattern_name] = list(pattern_check)
                    print(f"Pattern {pattern_name} found for {player_selection.player.username}")
        
        return patterns_found
    
    def verify_patterns_with_called_numbers(self, patterns, card_numbers_grid, called_numbers_set, player_selection):
        """Verify that the numbers in winning patterns have actually been called"""
        valid_patterns = {}
        
        for pattern_name, pattern_positions in patterns.items():
            # For each pattern, check if all numbers in those positions have been called
            all_numbers_called = True
            pattern_numbers = []
            
            for pos in pattern_positions:
                # Convert flat position to grid coordinates
                row = pos // 5
                col = pos % 5
                
                # Get the number at this position in the card
                try:
                    # card_numbers_grid is [[B], [I], [N], [G], [O]]
                    # So col=0 is B column, col=1 is I column, etc.
                    number_list = card_numbers_grid[col]
                    number = number_list[row]
                    
                    # Handle if number is stored as string
                    if isinstance(number, str):
                        number = int(number)
                except (IndexError, ValueError, TypeError) as e:
                    print(f"Error getting number at position {pos} for {player_selection.player.username}: {e}")
                    all_numbers_called = False
                    break
                
                pattern_numbers.append(number)
                
                # SPECIAL CASE: If this is the FREE position (12), 
                # we should have called the FREE number during game start
                if pos == self.FREE_POSITION:
                    print(f"  Position {pos} (FREE): number {number} should have been called")
                    if number not in called_numbers_set:
                        print(f"  WARNING: FREE number {number} not in called numbers!")
                        # But we should still accept it since it's FREE
                        # Actually, FREE numbers are called at game start, so this shouldn't happen
                
                # Check if this number has been called (for non-free positions)
                if number not in called_numbers_set and pos != self.FREE_POSITION:
                    all_numbers_called = False
                    print(f"  Number {number} at position {pos} not called yet")
                    break
            
            if all_numbers_called:
                valid_patterns[pattern_name] = {
                    'positions': pattern_positions,
                    'numbers': pattern_numbers
                }
                print(f"Valid pattern found for {player_selection.player.username}: {pattern_name}")
        
        return valid_patterns

    def mark_on_cards_optimized(self, game_round, number):
        """Mark number on player cards optimized for 5x5 grid"""
        try:
            # If round has ended, don't mark cards
            if self.current_round_ended:
                return
            
            # Get all active selections for this round
            selections = PlayerSelection.objects.filter(
                game_round=game_round,
                is_active=True
            ).select_related('bingo_card')
            
            updates = []
            marked_count = 0
            
            for sel in selections:
                # Get card numbers in grid format
                card_numbers_grid = sel.bingo_card.numbers
                
                # Search for the number in the 5x5 grid
                found_position = -1
                
                for col in range(5):  # 5 columns: B, I, N, G, O
                    column_numbers = card_numbers_grid[col]
                    for row in range(5):  # 5 rows
                        try:
                            card_num = column_numbers[row]
                            if isinstance(card_num, str):
                                card_num = int(card_num)
                            
                            if card_num == number:
                                # Calculate flat position
                                found_position = row * 5 + col
                                break
                        except (ValueError, TypeError):
                            continue
                    if found_position != -1:
                        break
                
                # If number found on card and not already marked
                if found_position != -1 and found_position not in sel.marked_positions:
                    sel.marked_positions.append(found_position)
                    sel.marked_numbers.append(number)
                    updates.append(sel)
                    marked_count += 1
            
            # Batch update
            if updates:
                PlayerSelection.objects.bulk_update(
                    updates, 
                    ['marked_positions', 'marked_numbers']
                )
                print(f"  Marked number {number} on {marked_count} card(s)")
                        
        except Exception as e:
            print(f"Error marking cards: {e}")
    
    def declare_winners(self, game_round, winners, winning_patterns):
        """Declare multiple winners with forced database updates"""
        try:
            if not winners:
                return
            
            # Get fresh data from database in atomic transaction
            with db_transaction.atomic():
                # Refresh game round from database
                game_round = GameRound.objects.select_for_update().get(id=game_round.id)
                
                # Double-check round hasn't already been processed
                if game_round.status == 'finished':
                    print(f"Round already finished, skipping winner declaration")
                    self.current_round_ended = True
                    return
                
                # Calculate total prize pool (80% of total stake)
                total = game_round.total_stake or Decimal('0')
                total_prize = (total * Decimal('0.8')).quantize(Decimal('0.01'))
                admin_fee = (total * Decimal('0.2')).quantize(Decimal('0.01'))
                
                # Calculate prize per winner (equal distribution)
                num_winners = len(winners)
                prize_per_winner = (total_prize / Decimal(str(num_winners))).quantize(Decimal('0.01'))
                
                print("\n" + "=" * 50)
                print(f"{num_winners} WINNER{'S' if num_winners > 1 else ''} DECLARED!")
                print("=" * 50)
                print(f"  Total Stake: {total} ETB")
                print(f"  Total Prize Pool: {total_prize} ETB")
                print(f"  Prize per winner: {prize_per_winner} ETB")
                print(f"  Admin Fee: {admin_fee} ETB")
                print(f"  Called Numbers: {len(game_round.called_numbers or [])}/75")
                print("-" * 50)
                
                # Update game round status FIRST
                game_round.status = 'finished'
                game_round.end_time = timezone.now()
                game_round.prize_pool = total_prize
                game_round.admin_fee = admin_fee
                
                # For multiple winners, store first winner and note it's a split win
                if num_winners == 1:
                    winner = winners[0]
                    pattern_data = winning_patterns[winner.id]
                    pattern_name = list(pattern_data['patterns'].keys())[0]
                    pattern_info = pattern_data['patterns'][pattern_name]
                    
                    game_round.winner = winner.player
                    game_round.winning_card = winner.bingo_card
                    game_round.winning_pattern = pattern_name
                    game_round.winning_numbers = pattern_info['numbers']
                    
                    print(f"  Winner: {winner.player.username}")
                    print(f"  Card: #{winner.bingo_card.card_number}")
                    print(f"  Pattern: {pattern_name}")
                    print(f"  Winning Numbers: {pattern_info['numbers']}")
                    
                    # Display card grid for verification
                    self.print_card_grid(winner.bingo_card, pattern_info['positions'])
                else:
                    # Multiple winners - store first winner with note
                    first_winner = winners[0]
                    pattern_data = winning_patterns[first_winner.id]
                    pattern_name = list(pattern_data['patterns'].keys())[0]
                    pattern_info = pattern_data['patterns'][pattern_name]
                    
                    game_round.winner = first_winner.player
                    game_round.winning_card = first_winner.bingo_card
                    game_round.winning_pattern = f"{pattern_name} (Split among {num_winners} winners)"
                    game_round.winning_numbers = pattern_info['numbers']
                    
                    # List all winners
                    for i, winner in enumerate(winners, 1):
                        pattern_data = winning_patterns[winner.id]
                        pattern_name = list(pattern_data['patterns'].keys())[0]
                        pattern_info = pattern_data['patterns'][pattern_name]
                        
                        print(f"  Winner {i}: {winner.player.username}")
                        print(f"    Card: #{winner.bingo_card.card_number}")
                        print(f"    Pattern: {pattern_name}")
                        print(f"    Winning Numbers: {pattern_info['numbers']}")
                
                # SAVE game round FIRST
                game_round.save()
                
                # Award prize to each winner
                for winner in winners:
                    # Get winner with select_for_update to prevent race conditions
                    try:
                        player_selection = PlayerSelection.objects.select_for_update().get(id=winner.id)
                    except PlayerSelection.DoesNotExist:
                        continue
                    
                    # Get or create wallet WITH LOCK
                    wallet, created = Wallet.objects.select_for_update().get_or_create(
                        user=winner.player,
                        defaults={'balance': prize_per_winner}
                    )
                    
                    if not created:
                        wallet.balance += prize_per_winner
                        wallet.save(update_fields=['balance'])
                    
                    # Record win transaction
                    pattern_data = winning_patterns[winner.id]
                    pattern_name = list(pattern_data['patterns'].keys())[0]
                    
                    Transaction.objects.create(
                        user=winner.player,
                        transaction_type='deposit',
                        amount=prize_per_winner,
                        description=f'Won round {game_round.round_number} - {pattern_name} (Split: {num_winners} winners)',
                        game_round=game_round,
                        reference="won"
                    )
                    
                    # Mark player selection as won
                    player_selection.has_won = True
                    player_selection.save(update_fields=['has_won'])
                    print(winner.player)
                
                # Record admin fee transaction
                try:
                    win_player=User.objects.get(username=winner.player)
                    admin_username=win_player.agent_id if win_player.agent_id else "nebaBingo"
                    admin_user = User.objects.get(username=admin_username)
                    
                    # Get or create admin wallet WITH LOCK
                    admin_wallet, created = Wallet.objects.select_for_update().get_or_create(
                        user=admin_user,
                        defaults={'balance': admin_fee}
                    )
                    
                    if not created:
                        admin_wallet.balance += admin_fee
                        admin_wallet.save(update_fields=['balance'])
                    
                    Transaction.objects.create(
                        user=admin_user,
                        transaction_type='deposit',
                        amount=admin_fee,
                        description=f'Admin fee round {game_round.round_number}',
                        game_round=game_round,
                        reference="admin_fee"
                    )
                    
                    print(f"  Admin fee recorded for user: {admin_user.username}")
                except User.DoesNotExist:
                    print(f"Admin user 'nebaBingo' not found. Skipping admin fee.")
                except Exception as e:
                    print(f"Error recording admin fee: {e}")
                
                # CRITICAL: Set round ended flag AFTER successful winner declaration
                self.current_round_ended = True
            
            print("\n" + "=" * 50)
            print(f"ROUND {game_round.round_number} COMPLETED SUCCESSFULLY!")
            print("=" * 50)
            
            # Force clear cache
            self.cache.clear()
            
            # Wait before new round
            print(f"\nStarting new round in {self.winner_cooldown} seconds...")
            for i in range(self.winner_cooldown, 0, -1):
                print(f"  {i}...")
                time.sleep(1)
            
            # Create new round
            self.create_new_round()
            
        except Exception as e:
            print(f"CRITICAL ERROR declaring winners: {e}")
            import traceback
            traceback.print_exc()
            
            # Try one more time with simpler approach
            try:
                print(f"Attempting emergency winner declaration...")
                
                # At minimum, mark round as finished and set flag
                with db_transaction.atomic():
                    game_round = GameRound.objects.get(id=game_round.id)
                    game_round.status = 'finished'
                    game_round.end_time = timezone.now()
                    game_round.save()
                
                self.current_round_ended = True
                print(f"Emergency round closure completed.")
            except:
                print(f"Emergency closure failed.")
            
            # Wait and create new round
            time.sleep(self.winner_cooldown)
            self.create_new_round()
    
    def emergency_winner_check(self):
        """Emergency winner check to force winner declaration"""
        try:
            round_obj = self.get_current_round()
            if not round_obj or round_obj.status != 'active':
                return
            
            print(f"EMERGENCY WINNER CHECK for Round #{round_obj.round_number}")
            
            # Force winner check
            result = self.check_and_declare_winners_immediately(round_obj, forced_check=True)
            
            if result:
                print(f"Emergency check: Winner found and declared!")
            else:
                print(f"Emergency check: No winner found")
                
        except Exception as e:
            print(f"Emergency check failed: {e}")
    
    def check_extreme_winner(self, game_round):
        """Check for winners when many numbers have been called"""
        try:
            if self.current_round_ended:
                return
            
            print(f"EXTREME WINNER CHECK: Many numbers called")
            self.check_and_declare_winners_immediately(game_round, forced_check=True)
            
        except Exception as e:
            print(f"Extreme winner check failed: {e}")
    
    def print_card_grid(self, bingo_card, winning_positions=None):
        """Print the bingo card grid with marked positions highlighted"""
        if winning_positions is None:
            winning_positions = []
        
        card_numbers = bingo_card.numbers
        print(f"\n  Card #{bingo_card.card_number} Grid:")
        print("  " + "="*25)
        
        for row in range(5):
            row_str = "  |"
            for col in range(5):
                pos = row * 5 + col
                try:
                    number = card_numbers[col][row]
                    if pos in winning_positions:
                        row_str += f" [{number:>2}] |"
                    else:
                        row_str += f"  {number:>2}  |"
                except (IndexError, TypeError):
                    row_str += "  ??  |"
            print(row_str)
            if row < 4:
                print("  |" + "------|"*4 + "-----|")
        print("  " + "="*25)
    
    def end_game_no_winner(self, game_round):
        """End game with no winner optimized"""
        try:
            # Mark that this round has ended
            self.current_round_ended = True
            
            # Update game round status
            GameRound.objects.filter(id=game_round.id).update(
                status='finished',
                end_time=timezone.now()
            )
            
            print(f"\n" + "=" * 50)
            print(f"ROUND {game_round.round_number} ENDED - NO WINNER")
            print("=" * 50)
            print(f"  All 75 numbers called")
            print(f"  No player completed any winning pattern")
            print(f"  Total stake will be returned to admin")
            
            # Return stake to admin (or keep as admin fee)
            try:
                
                admin_user = User.objects.get(username="nebaBingo")
                total = game_round.total_stake or Decimal('0')
                
                if total > 0:
                    # Get or create admin wallet
                    admin_wallet, created = Wallet.objects.get_or_create(
                        user=admin_user,
                        defaults={'balance': total}
                    )
                    
                    if not created:
                        admin_wallet.balance += total
                        admin_wallet.save(update_fields=['balance'])
                    
                    Transaction.objects.create(
                        user=admin_user,
                        transaction_type='deposit',
                        amount=total,
                        description=f'No winner - stake returned round {game_round.round_number}',
                        game_round=game_round,
                        reference="no_winner_stake"
                    )
                    
                    print(f"  Total stake {total} ETB returned to admin")
            except User.DoesNotExist:
                print(f"Admin user 'nebaBingo' not found.")
            
            # Invalidate cache
            if 'current_round' in self.cache:
                del self.cache['current_round']
            
            # Wait before new round
            print(f"\nStarting new round in 5 seconds...")
            for i in range(5, 0, -1):
                print(f"  {i}...")
                time.sleep(1)
            
            # Create new round immediately
            self.create_new_round()
            
        except Exception as e:
            print(f"Error ending game: {e}")
            time.sleep(5)
            self.create_new_round()
    
    def create_new_round(self):
        """Create a new game round optimized"""
        try:
            # Use aggregation for max round number
            from django.db.models import Max
            last_num = GameRound.objects.aggregate(
                max_round=Max('round_number')
            )['max_round'] or 0
            
            next_num = last_num + 1
            
            # Reset round ended flag
            self.current_round_ended = False
            
            # Create new round with proper datetime
            new_round = GameRound.objects.create(
                round_number=next_num,
                status='waiting',
                selection_end_time=timezone.now() + timedelta(seconds=60)
            )
            
            # Update cache
            self.cache['current_round'] = (time.time(), new_round)
            
            print(f"\n" + "*" * 50)
            print(f"NEW ROUND {next_num} CREATED")
            print("*" * 50)
            print(f"  Selection period: 60 seconds")
            print(f"  FREE Position: Center (position 12) will be marked automatically")
            print(f"  FREE Number: Each player has their own FREE number (N column, 31-45)")
            print(f"  Waiting for players to join...")
            
            return new_round
            
        except Exception as e:
            print(f"Error creating new round: {e}")
            return None
    
    def print_stats(self):
        """Print game statistics optimized"""
        try:
            round_obj = self.get_current_round()
            if not round_obj:
                print("No active round")
                return
            
            called = len(round_obj.called_numbers or [])
            available = 75 - called
            
            # Get active player count
            player_count = PlayerSelection.objects.filter(
                game_round=round_obj,
                is_active=True
            ).count()
            
            print(f"\nRound #{round_obj.round_number}")
            print(f"  Status: {round_obj.status}")
            print(f"  Players: {player_count}")
            print(f"  Called: {called}/75 numbers")
            print(f"  FREE Position: Center (position 12)")
            
            if called > 0:
                last_called = round_obj.called_numbers[-1] if round_obj.called_numbers else None
                if last_called:
                    # Determine letter for last called
                    if last_called <= 15:
                        letter = 'B'
                    elif last_called <= 30:
                        letter = 'I'
                    elif last_called <= 45:
                        letter = 'N'
                    elif last_called <= 60:
                        letter = 'G'
                    else:
                        letter = 'O'
                    print(f"  Last called: {letter}-{last_called}")
            
        except Exception as e:
            print(f"Error printing stats: {e}")