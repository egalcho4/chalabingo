# bingo/models.py
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
import json

class GameRound(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting for Players'),
        ('active', 'Active'),
        ('finished', 'Finished'),
        ('cancelled', 'Cancelled'),
    ]
    
    round_number = models.PositiveIntegerField(unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    total_stake = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    winning_card = models.ForeignKey('BingoCard', on_delete=models.SET_NULL, null=True, blank=True)
    winning_pattern = models.CharField(max_length=50, null=True, blank=True)
    prize_pool = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    admin_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    called_numbers = models.JSONField(default=list)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    selection_end_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'game_rounds'
        indexes = [
            models.Index(fields=['status', 'round_number']),
            models.Index(fields=['status', 'selection_end_time']),
        ]
    
    def __str__(self):
        return f"Round {self.round_number} - {self.status}"

class BingoCard(models.Model):
    card_number = models.PositiveIntegerField(unique=True)
    numbers = models.JSONField()  # Store as [[B], [I], [N], [G], [O]]
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'bingo_cards'
        indexes = [
            models.Index(fields=['card_number']),
        ]
    
    def __str__(self):
        return f"Card #{self.card_number}"
    
    def get_flat_numbers(self):
        """Convert 5x5 grid to flat list"""
        flat = []
        for col in range(5):
            for row in range(5):
                flat.append(self.numbers[row][col])
        return flat
    def check_patterns_fast(self, marked_positions_set):
        """Ultra-fast pattern checking using set operations"""
        patterns = {}
        
        # Quick length check first
        marked_count = len(marked_positions_set)
        if marked_count < 5:  # Minimum for any pattern
            return patterns
        
        # Full house (all 25)
        if marked_count == 25:
            patterns['full_house'] = list(marked_positions_set)
        
        # Rows
        for row in range(5):
            row_set = {row * 5 + col for col in range(5)}
            if row_set.issubset(marked_positions_set):
                patterns[f'row_{row+1}'] = list(row_set)
        
        # Columns (check only if we have at least 5 marks in vertical alignment)
        for col in range(5):
            col_set = {row * 5 + col for row in range(5)}
            if col_set.issubset(marked_positions_set):
                patterns[f'col_{col+1}'] = list(col_set)
        
        # Diagonals
        diag1 = {i * 5 + i for i in range(5)}  # 0,6,12,18,24
        diag2 = {i * 5 + (4 - i) for i in range(5)}  # 4,8,12,16,20
        
        if diag1.issubset(marked_positions_set):
            patterns['diagonal_1'] = list(diag1)
        if diag2.issubset(marked_positions_set):
            patterns['diagonal_2'] = list(diag2)
        
        # Four corners
        corners = {0, 4, 20, 24}
        if corners.issubset(marked_positions_set):
            patterns['four_corners'] = list(corners)
        
        return patterns
    
    def check_patterns(self, marked_positions):
        """Check if card has any winning pattern"""
        patterns = {
            'full_house': self.check_full_house(marked_positions),
            'row_1': self.check_row(0, marked_positions),
            'row_2': self.check_row(1, marked_positions),
            'row_3': self.check_row(2, marked_positions),
            'row_4': self.check_row(3, marked_positions),
            'row_5': self.check_row(4, marked_positions),
            'col_1': self.check_column(0, marked_positions),
            'col_2': self.check_column(1, marked_positions),
            'col_3': self.check_column(2, marked_positions),
            'col_4': self.check_column(3, marked_positions),
            'col_5': self.check_column(4, marked_positions),
            'diagonal_1': self.check_diagonal(True, marked_positions),
            'diagonal_2': self.check_diagonal(False, marked_positions),
            'four_corners': self.check_four_corners(marked_positions),
        }
        return {k: v for k, v in patterns.items() if v}
    
    def check_full_house(self, marked_positions):
        return len(marked_positions) == 25
    
    def check_row(self, row_index, marked_positions):
        positions = [row_index * 5 + col for col in range(5)]
        return all(pos in marked_positions for pos in positions)
    
    def check_column(self, col_index, marked_positions):
        positions = [row * 5 + col_index for row in range(5)]
        return all(pos in marked_positions for pos in positions)
    
    def check_diagonal(self, main_diagonal, marked_positions):
        if main_diagonal:
            positions = [i * 5 + i for i in range(5)]  # 0,6,12,18,24
        else:
            positions = [i * 5 + (4 - i) for i in range(5)]  # 4,8,12,16,20
        return all(pos in marked_positions for pos in positions)
    
    def check_four_corners(self, marked_positions):
        corners = [0, 4, 20, 24]  # Positions of four corners
        return all(corner in marked_positions for corner in corners)

class PlayerSelection(models.Model):
    game_round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='selections')
    player = models.ForeignKey(User, on_delete=models.CASCADE, related_name='selections')
    bingo_card = models.ForeignKey(BingoCard, on_delete=models.CASCADE)
    marked_numbers = models.JSONField(default=list)  # List of marked numbers
    marked_positions = models.JSONField(default=list)  # Positions 0-24
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    has_won = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'player_selections'
        unique_together = ['game_round', 'bingo_card']
        indexes = [
             models.Index(fields=['game_round', 'player']),
            models.Index(fields=['game_round', 'bingo_card']),
            models.Index(fields=['player', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.player.username} - Card #{self.bingo_card.card_number}"

class CalledNumber(models.Model):
    game_round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name='called_numbers_rel')
    letter = models.CharField(max_length=1)  # B, I, N, G, O
    number = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(75)])
    called_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'called_numbers'
        unique_together = ['game_round', 'number']
        indexes = [
            models.Index(fields=['game_round']),
             models.Index(fields=['game_round', 'called_at']),
        ]
        ordering = ['called_at']
    
    def __str__(self):
        return f"{self.letter}-{self.number}"