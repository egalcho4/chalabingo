# bingo/views.py
from django.db import transaction as db_transaction
from django.utils import timezone
from django.core.cache import cache
from django.contrib.auth.decorators import login_required
from rest_framework import status, viewsets, generics
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta
import json
from .models import GameRound, BingoCard, PlayerSelection, CalledNumber
from .serializers import (
    BingoCardSerializer, 
    GameRoundSerializer, 
    PlayerSelectionSerializer, 
    CalledNumberSerializer
)
from transactions.models import Wallet, Transaction
# views.py - Alternative version
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.management import call_command
from io import StringIO
import sys
from django.views.decorators.http import require_http_methods

# views.py - USE DJANGO'S METHOD
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.management import execute_from_command_line
import io
from contextlib import redirect_stdout, redirect_stderr


import subprocess
import threading
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

@csrf_exempt
@require_http_methods(["GET", "POST"])
def run_game_engine_command(request):
    """
    Run game engine and telegram bot in separate processes
    """
    try:
        # Run commands in background using subprocess
        game_engine_proc = subprocess.Popen(
            ["python", "manage.py", "run_game_engine"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        telegram_bot_proc = subprocess.Popen(
            ["python", "manage.py", "run_telegram_bot"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        return JsonResponse({
            "success": True,
            "message": "Game engine and Telegram bot started in background",
            "pids": {
                "game_engine": game_engine_proc.pid,
                "telegram_bot": telegram_bot_proc.pid
            }
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)

class GameRoundViewSet(viewsets.ModelViewSet):
    queryset = GameRound.objects.all()
    serializer_class = GameRoundSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return GameRound.objects.filter(
            status__in=['waiting', 'active', 'finished']
        ).order_by('-round_number')
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current game round"""
        current_round = GameRound.objects.filter(
            status__in=['waiting', 'active']
        ).order_by('-round_number').first()
        
        if not current_round:
            # Create new round
            last_round = GameRound.objects.order_by('-round_number').first()
            new_round_number = last_round.round_number + 1 if last_round else 1
            
            current_round = GameRound.objects.create(
                round_number=new_round_number,
                status='waiting',
                selection_end_time=timezone.now() + timedelta(seconds=60)
            )
        
        serializer = self.get_serializer(current_round)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def select_card(self, request, pk=None):
        """Select a bingo card"""
        return self.handle_card_selection(request, pk, select=True)
    
    @action(detail=True, methods=['post'])
    def deselect_card(self, request, pk=None):
        """Deselect a bingo card"""
        return self.handle_card_selection(request, pk, select=False)
    
    def handle_card_selection(self, request, round_id, select=True):
        """Handle card selection/deselection"""
        try:
            game_round = GameRound.objects.get(id=round_id)
        except GameRound.DoesNotExist:
            return Response({'error': 'Game round not found'}, status=404)
        
        if game_round.status != 'waiting':
            return Response({'error': 'Selection period ended'}, status=400)
        
        card_number = request.data.get('card_number')
        if not card_number:
            return Response({'error': 'Card number required'}, status=400)
        
        try:
            bingo_card = BingoCard.objects.get(card_number=card_number)
        except BingoCard.DoesNotExist:
            return Response({'error': 'Invalid card number'}, status=400)
        
        bet_amount = 10  # Fixed bet amount
        
        with db_transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)
            
            if select:
                # Check if card already taken
                if PlayerSelection.objects.filter(game_round=game_round, bingo_card=bingo_card).exists():
                    return Response({'error': 'Card already taken'}, status=400)
                
                # Check wallet balance
                if wallet.balance < bet_amount:
                    return Response({'error': 'Insufficient balance'}, status=400)
                
                # Deduct from wallet
                wallet.balance -= bet_amount
                wallet.save()
                
                # Create transaction
                Transaction.objects.create(
                    user=request.user,
                    transaction_type='bet',
                    amount=bet_amount,
                    game_round=game_round,
                    description=f'Bet for card #{card_number}'
                )
                
                # Update game stake
                game_round.total_stake += bet_amount
                game_round.save()
                
                # Create player selection
                PlayerSelection.objects.create(
                    game_round=game_round,
                    player=request.user,
                    bingo_card=bingo_card
                )
                
                message = f'Card #{card_number} selected'
            else:
                # Deselect card
                try:
                    selection = PlayerSelection.objects.get(
                        game_round=game_round,
                        player=request.user,
                        bingo_card=bingo_card
                    )
                except PlayerSelection.DoesNotExist:
                    return Response({'error': 'Card not selected by you'}, status=400)
                
                # Refund to wallet
                wallet.balance += bet_amount
                wallet.save()
                
                # Create refund transaction
                Transaction.objects.create(
                    user=request.user,
                    transaction_type='refund',
                    amount=bet_amount,
                    game_round=game_round,
                    description=f'Refund for card #{card_number}'
                )
                
                # Update game stake
                game_round.total_stake -= bet_amount
                game_round.save()
                
                # Delete selection
                selection.delete()
                
                message = f'Card #{card_number} deselected'
            
            # Clear player count cache
            cache_key = f'player_count_round_{game_round.id}'
            cache.delete(cache_key)
        
        return Response({
            'success': True,
            'message': message,
            'wallet_balance': float(wallet.balance),
            'total_stake': float(game_round.total_stake)
        })

class BingoCardViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BingoCardSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    
    def get_queryset(self):
        return BingoCard.objects.filter(is_active=True).order_by('card_number')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        current_round = GameRound.objects.filter(
            status__in=['waiting', 'active']
        ).order_by('-round_number').first()
        context['game_round'] = current_round
        return context

# API Views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def game_status(request):
    """Get complete game status for polling"""
    # Get current game round
    current_round = GameRound.objects.filter(
        status__in=['waiting', 'active']
    ).order_by('-round_number').first()
    
    if not current_round:
        return Response({'error': 'No active game'}, status=404)
    
    # Get player's selections
    player_selections = PlayerSelection.objects.filter(
        game_round=current_round,
        player=request.user
    )
    
    # Get recent calls (last 4)
    recent_calls = CalledNumber.objects.filter(
        game_round=current_round
    ).order_by('-called_at')[:4]
    
    # Get wallet
    wallet = Wallet.objects.get(user=request.user)
    
    # Get player count
    cache_key = f'player_count_round_{current_round.id}'
    player_count = cache.get(cache_key)
    
    if player_count is None:
        player_count = current_round.selections.values('player').distinct().count()
        cache.set(cache_key, player_count, 5)
    
    # Get time remaining
    time_remaining = 0
    if current_round.status == 'waiting' and current_round.selection_end_time:
        now = timezone.now()
        if now < current_round.selection_end_time:
            time_remaining = int((current_round.selection_end_time - now).total_seconds())
    
    # Check if user has any winning cards
    user_won = False
    winning_card = None
    if current_round.status == 'finished' and current_round.winner == request.user:
        user_won = True
        winning_card = current_round.winning_card.card_number if current_round.winning_card else None
    
    data = {
        'round': {
            'id': current_round.id,
            'round_number': current_round.round_number,
            'status': current_round.status,
            'total_stake': float(current_round.total_stake),
            'time_remaining': time_remaining,
            'called_numbers': current_round.called_numbers,
            'selection_end_time': current_round.selection_end_time.isoformat() if current_round.selection_end_time else None,
            'start_time': current_round.start_time.isoformat() if current_round.start_time else None,
            'winner': current_round.winner.username if current_round.winner else None,
            'winning_card': current_round.winning_card.card_number if current_round.winning_card else None,
            'winning_pattern': current_round.winning_pattern,
            'prize_pool': float(current_round.prize_pool) if current_round.prize_pool else 0,
        },
        'player': {
            'cards': PlayerSelectionSerializer(player_selections, many=True).data,
            'wallet_balance': float(wallet.balance),
            'has_won': user_won,
            'winning_card': winning_card,
        },
        'game': {
            'recent_calls': CalledNumberSerializer(recent_calls, many=True).data,
            'player_count': player_count,
            'total_cards': 200,
            'selected_cards': current_round.selections.count(),
        },
        'timestamp': timezone.now().isoformat(),
    }
    
    return Response(data)
# bingo/views.py - Add this efficient status endpoint
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lightweight_status(request):
    """Lightweight status endpoint for frequent polling"""
    try:
        cache_key = f'lightweight_status_{request.user.id}'
        cached = cache.get(cache_key)
        
        # Get current round info
        current_round = GameRound.objects.filter(
            status__in=['waiting', 'active', 'finished']
        ).order_by('-round_number').first()
        
        if not current_round:
            data = {
                'round': None,
                'player': {
                    'cards': [],
                    'wallet_balance': 0,
                    'has_won': False,
                    'winning_card': None
                },
                'game': {
                    'recent_calls': [],
                    'player_count': 0,
                    'total_cards': 200,
                    'selected_cards': 0
                },
                'timestamp': timezone.now().isoformat(),
            }
            cache.set(cache_key, data, 5)
            return Response(data)
        
        # Get or create wallet for user
        wallet, created = Wallet.objects.get_or_create(
            user=request.user,
            defaults={'balance': 100.00}
        )
        
        # Get user's selections for this round
        user_selections = PlayerSelection.objects.filter(
            game_round=current_round,
            player=request.user,
            is_active=True
        )
        
        # Get player count
        player_count_cache_key = f'player_count_round_{current_round.id}'
        player_count = cache.get(player_count_cache_key)
        
        if player_count is None:
            player_count = current_round.selections.filter(is_active=True).values('player').distinct().count()
            cache.set(player_count_cache_key, player_count, 5)
        
        # Get recent calls
        recent_calls = CalledNumber.objects.filter(
            game_round=current_round
        ).order_by('-called_at')[:4]
        
        # Calculate time remaining for selection
        time_remaining = 0
        if current_round.status == 'waiting' and current_round.selection_end_time:
            now = timezone.now()
            if now < current_round.selection_end_time:
                time_remaining = int((current_round.selection_end_time - now).total_seconds())
        
        # Check if user is winner
        is_winner = current_round.winner_id == request.user.id if current_round.winner_id else False
        user_won = False
        winning_card = None
        
        if current_round.status == 'finished' and current_round.winner_id == request.user.id:
            user_won = True
            winning_card = current_round.winning_card.card_number if current_round.winning_card else None
        
        # Check if user has winning card
        user_has_winning_card = False
        if current_round.winning_card and user_selections.filter(bingo_card=current_round.winning_card).exists():
            user_has_winning_card = True
        
        # Prepare data
        data = {
            'round': {
                'id': current_round.id,
                'status': current_round.status,
                'round_number': current_round.round_number,
                'called_numbers': current_round.called_numbers or [],
                'time_remaining': time_remaining,
                'total_stake': float(current_round.total_stake),
                'winner': current_round.winner.username if current_round.winner else None,
                'winner_id': current_round.winner_id,
                'winning_card': current_round.winning_card.card_number if current_round.winning_card else None,
                'winning_pattern': current_round.winning_pattern,
                'prize_pool': float(current_round.prize_pool) if current_round.prize_pool else 0,
                'selection_end_time': current_round.selection_end_time.isoformat() if current_round.selection_end_time else None,
                'start_time': current_round.start_time.isoformat() if current_round.start_time else None,
                'end_time': current_round.end_time.isoformat() if current_round.end_time else None,
            },
            'player': {
                'cards': PlayerSelectionSerializer(user_selections, many=True).data,
                'wallet_balance': float(wallet.balance),
                'has_won': user_won or is_winner or user_has_winning_card,
                'winning_card': winning_card or (current_round.winning_card.card_number if current_round.winning_card else None),
            },
            'game': {
                'recent_calls': CalledNumberSerializer(recent_calls, many=True).data,
                'player_count': player_count,
                'total_cards': 200,
                'selected_cards': current_round.selections.filter(is_active=True).count(),
            },
            'timestamp': timezone.now().isoformat(),
        }
        
        cache.set(cache_key, data, 2)  # Cache for 2 seconds
        return Response(data)
        
    except Exception as e:
        print(f"Error in lightweight_status: {e}")
        import traceback
        traceback.print_exc()
        
        # Return basic data on error
        return Response({
            'round': None,
            'player': {
                'cards': [],
                'wallet_balance': 0,
                'has_won': False,
                'winning_card': None
            },
            'game': {
                'recent_calls': [],
                'player_count': 0,
                'total_cards': 200,
                'selected_calls': 0
            },
            'timestamp': timezone.now().isoformat(),
        }, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def poll_updates(request):
    """Poll for game updates (lightweight endpoint)"""
    current_round = GameRound.objects.filter(
        status__in=['waiting', 'active', 'finished']
    ).order_by('-round_number').first()
    
    if not current_round:
        return Response({'updates': [], 'timestamp': timezone.now().isoformat()})
    
    last_poll = request.GET.get('last_poll')
    updates = []
    
    # Check for new called numbers
    if last_poll:
        try:
            last_poll_time = timezone.datetime.fromisoformat(last_poll.replace('Z', '+00:00'))
            new_numbers = CalledNumber.objects.filter(
                game_round=current_round,
                called_at__gt=last_poll_time
            ).order_by('called_at')
            
            for number in new_numbers:
                updates.append({
                    'type': 'new_number',
                    'letter': number.letter,
                    'number': number.number,
                    'timestamp': number.called_at.isoformat()
                })
        except:
            pass
    
    # Check for round status changes
    if current_round.status == 'finished':
        updates.append({
            'type': 'game_finished',
            'winner': current_round.winner.username if current_round.winner else None,
            'winning_card': current_round.winning_card.card_number if current_round.winning_card else None,
            'prize': float(current_round.prize_pool) if current_round.prize_pool else 0,
        })
    elif current_round.status == 'active' and not last_poll:
        # If first poll and game is active, send current called numbers
        recent_numbers = CalledNumber.objects.filter(
            game_round=current_round
        ).order_by('-called_at')[:4]
        
        for number in recent_numbers:
            updates.append({
                'type': 'current_number',
                'letter': number.letter,
                'number': number.number,
                'timestamp': number.called_at.isoformat()
            })
    
    # Check for player count changes
    cache_key = f'player_count_round_{current_round.id}'
    player_count = cache.get(cache_key)
    
    if player_count is None:
        player_count = current_round.selections.values('player').distinct().count()
        cache.set(cache_key, player_count, 5)
    
    updates.append({
        'type': 'player_count',
        'count': player_count
    })
    
    return Response({
        'updates': updates,
        'round_status': current_round.status,
        'timestamp': timezone.now().isoformat()
    })

@api_view(['GET'])
#@permission_classes([IsAuthenticated])
def available_cards(request):
    """Get all cards with availability status"""
    current_round = GameRound.objects.filter(
        status__in=['waiting', 'active']
    ).order_by('-round_number').first()
    
    if not current_round:
        return Response({'cards': []})
    
    # Get all cards
    all_cards = BingoCard.objects.filter(is_active=True).order_by('card_number')
    
    # Get selected cards for this round
    selected_cards = set(PlayerSelection.objects.filter(
        game_round=current_round
    ).values_list('bingo_card__card_number', flat=True))
    
    # Get user's selected cards
    user_cards = set(PlayerSelection.objects.filter(
        game_round=current_round,
        player=request.user
    ).values_list('bingo_card__card_number', flat=True))
    
    cards_data = []
    for card in all_cards:
        is_selected = card.card_number in selected_cards
        is_mine = card.card_number in user_cards
        
        cards_data.append({
            'id': card.id,
            'card_number': card.card_number,
            'is_available': not is_selected,
            "numbers":card.numbers,
            'is_mine': is_mine,
            'selected_by': 'You' if is_mine else ('Other' if is_selected else None)
        })
    
    return Response({
        'cards': cards_data,
        'total_cards': len(cards_data),
        'available_cards': len([c for c in cards_data if c['is_available']]),
        'my_cards': len([c for c in cards_data if c['is_mine']])
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def player_count(request):
    """Get player count for current round"""
    current_round = GameRound.objects.filter(
        status__in=['waiting', 'active']
    ).order_by('-round_number').first()
    
    if not current_round:
        return Response({'player_count': 0})
    
    cache_key = f'player_count_round_{current_round.id}'
    player_count = cache.get(cache_key)
    
    if player_count is None:
        player_count = current_round.selections.values('player').distinct().count()
        cache.set(cache_key, player_count, 5)
    
    return Response({'player_count': player_count})