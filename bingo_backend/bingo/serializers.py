# bingo/serializers.py
from rest_framework import serializers
from .models import GameRound, BingoCard, PlayerSelection, CalledNumber
from transactions.models import Wallet, Transaction

class BingoCardSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()
    selected_by = serializers.SerializerMethodField()
    
    class Meta:
        model = BingoCard
        fields = ['id', 'card_number', 'is_available', 'selected_by']
    
    def get_is_available(self, obj):
        game_round = self.context.get('game_round')
        if game_round:
            return not PlayerSelection.objects.filter(
                game_round=game_round,
                bingo_card=obj
            ).exists()
        return True
    
    def get_selected_by(self, obj):
        game_round = self.context.get('game_round')
        if game_round:
            selection = PlayerSelection.objects.filter(
                game_round=game_round,
                bingo_card=obj
            ).first()
            if selection:
                return selection.player.username
        return None

class GameRoundSerializer(serializers.ModelSerializer):
    time_remaining = serializers.SerializerMethodField()
    player_count = serializers.SerializerMethodField()
    
    class Meta:
        model = GameRound
        fields = ['id', 'round_number', 'status', 'total_stake', 'time_remaining', 
                  'player_count', 'selection_end_time', 'called_numbers']
    
    def get_time_remaining(self, obj):
        import datetime
        if obj.selection_end_time:
            now = datetime.datetime.now(datetime.timezone.utc)
            if now < obj.selection_end_time:
                return int((obj.selection_end_time - now).total_seconds())
        return 0
    
    def get_player_count(self, obj):
        return obj.selections.values('player').distinct().count()

class PlayerSelectionSerializer(serializers.ModelSerializer):
    card_number = serializers.IntegerField(source='bingo_card.card_number', read_only=True)
    
    class Meta:
        model = PlayerSelection
        fields = ['id', 'card_number', 'marked_numbers', 'marked_positions']

class CalledNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalledNumber
        fields = ['id', 'letter', 'number', 'called_at']

class GameStatusSerializer(serializers.Serializer):
    current_round = GameRoundSerializer()
    recent_calls = CalledNumberSerializer(many=True)
    player_cards = PlayerSelectionSerializer(many=True)
    wallet_balance = serializers.DecimalField(max_digits=10, decimal_places=2)