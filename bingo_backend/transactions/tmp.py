# views.py - Complete with all ViewSets including WalletViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, action
from rest_framework import viewsets, status, filters
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q, Count, Sum, Avg, F, ExpressionWrapper, DecimalField
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import datetime, timedelta, date
import json
import uuid
from decimal import Decimal
from django.db import models
from rest_framework import serializers
from django_filters.rest_framework import DjangoFilterBackend

from .models import Deposit, WithdrawRequest, Transaction, Agent, PaymentAccount, Wallet
from users.serializers import AgentSerializer, CreateAgentSerializer, AgentAnalyticsSerializer
from .serializers import PaymentAccountSerializer, WalletSerializer, DepositSerializer, WithdrawRequestSerializer, TransactionSerializer, DepositApprovalSerializer


# Your existing code for register_account, get_payment_account, etc...
@api_view(['POST'])
def register_account(request):
    """
    Register a new payment account endpoint.
    """
    try:
        usr=User.objects.get(username=request.user)
        if usr:
            pass 
        else:
            if request.user.is_authenticated:
                aget_user=User.objects.get(username=request.user)
                agents=Agent(user=aget_user,phone_number=request.user.username,address="ethiopia")
                agents.save()
    except:
        return Response(
            {"detail": "account exs"},
            status=status.HTTP_403_FORBIDDEN
        )

    if not request.user.is_authenticated:
        return Response(
            {"detail": "Authentication required"},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Check if user is an agent
    try:
        agent = Agent.objects.get(user=request.user)
    except Agent.DoesNotExist:
        return Response(
            {"detail": "Only agents can create payment accounts"},
            status=status.HTTP_403_FORBIDDEN
        )
    
    serializer = PaymentAccountSerializer(data=request.data, context={'request': request})
    
    if serializer.is_valid():
        serializer.save(agent=agent)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_payment_account(request):
    user=User.objects.get(username=request.user)
    if user.agent_id:
        agent_user=User.objects.get(username=user.agent_id)
        agent=Agent.objects.get(user=agent_user)
        accounts=PaymentAccount.objects.filter(agent=agent)
        serializer = PaymentAccountSerializer(accounts, many=True)
        return Response(serializer.data)
    else:
        return Response({"message":"no account for deposit"})


class PaymentAccountViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing payment accounts.
    Allow agents to create/update/delete their own payment accounts.
    """
    queryset = PaymentAccount.objects.all()
    serializer_class = PaymentAccountSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['account_name', 'account_number', 'phone_number', 'bank_name']
    ordering_fields = ['created_at', 'account_name', 'payment_method']
    filterset_fields = ['agent', 'payment_method', 'is_active']
    
    # Explicitly allow all HTTP methods including POST
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']
    
    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action in ['list', 'retrieve', 'active_accounts', 'by_payment_method', 
                          'payment_methods', 'public']:
            permission_classes = [AllowAny]  # Everyone can view
        elif self.action in ['create']:
            # Allow authenticated users (agents) to create
            permission_classes = [IsAuthenticated]
        elif self.action in ['update', 'partial_update', 'destroy', 'toggle_active', 'my_accounts']:
            # Allow owners or admins to modify
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """
        Optionally restricts the returned payment accounts,
        by filtering against query parameters in the URL.
        """
        queryset = PaymentAccount.objects.all()
        user = self.request.user
        
        # For authenticated users
        if user.is_authenticated:
            # Admin/Staff can see all accounts
            if user.is_staff or user.is_superuser:
                pass  # Don't filter for admin/staff
            
            # For non-admin users (agents and players)
            else:
                try:
                    # Get the full user object from database
                    db_user = User.objects.get(username=user.username)
                    
                    # Check if user is an agent
                    try:
                        agent = Agent.objects.get(user=db_user)
                    except Agent.DoesNotExist:
                        # If not an agent, check for agent_id
                        agent_username = db_user.agent_id if hasattr(db_user, 'agent_id') and db_user.agent_id else "nebaBingo"
                        
                        # Get the agent user
                        agent_user = User.objects.get(username=agent_username)
                        
                        # Get or create agent
                        agent, created = Agent.objects.get_or_create(
                            user=agent_user,
                            defaults={
                                'phone_number': agent_user.username if agent_user.username != "egalcho" else '0000000000',
                                'address': 'Super Admin' if agent_user.username == "egalcho" else 'Ethiopia'
                            }
                        )
                    
                    # Filter by this agent's accounts
                    queryset = queryset.filter(agent=agent)
                    
                except (User.DoesNotExist, Agent.DoesNotExist) as e:
                    # If agent not found, return empty
                    queryset = PaymentAccount.objects.none()
        
        # For unauthenticated users, show only active accounts (public view)
        else:
            queryset = queryset.filter(is_active=True)
        
        # Filter by payment method
        payment_method = self.request.query_params.get('payment_method', None)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by agent
        agent_id = self.request.query_params.get('agent', None)
        if agent_id:
            queryset = queryset.filter(agent_id=agent_id)
        
        # Filter by minimum amount
        min_amount = self.request.query_params.get('min_amount', None)
        if min_amount:
            queryset = queryset.filter(min_amount__gte=min_amount)
        
        # Filter by maximum amount
        max_amount = self.request.query_params.get('max_amount', None)
        if max_amount:
            queryset = queryset.filter(max_amount__lte=max_amount)
        
        return queryset
    
    def perform_create(self, serializer):
        """
        Automatically set the agent to the current user when creating.
        This method is called by the create() method.
        """
        # Check if user is an agent
        if not self.request.user.is_authenticated:
            raise serializers.ValidationError({"detail": "Authentication required"})
        
        try:
            # Get or create agent for the user
            agent, created = Agent.objects.get_or_create(user=self.request.user)
            
            # If admin is creating for another agent
            if self.request.user.is_staff or self.request.user.is_superuser:
                agent_id = self.request.data.get('agent')
                if agent_id:
                    try:
                        agent = Agent.objects.get(id=agent_id)
                    except Agent.DoesNotExist:
                        raise serializers.ValidationError({"agent": "Agent not found"})
            
            # Save with the agent
            serializer.save(agent=agent)
            
        except Exception as e:
            raise serializers.ValidationError({"detail": str(e)})
    
    def create(self, request, *args, **kwargs):
        """
        Create a payment account with proper validation.
        This is the actual method that handles POST requests.
        """
        # Check authentication for create action
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication credentials were not provided."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Check if request is multipart/form-data for file uploads
        content_type = request.content_type
        is_multipart = 'multipart/form-data' in content_type
        
        # If image is being uploaded and content type is not multipart, warn
        if 'image' in request.FILES and not is_multipart:
            return Response(
                {"detail": "Image upload requires multipart/form-data content type"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            self.perform_create(serializer)
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def update(self, request, *args, **kwargs):
        """
        Allow update only if user owns the account or is admin.
        Handle image updates properly.
        """
        instance = self.get_object()
        
        # Check if user is admin or owner of the payment account
        if not (request.user.is_staff or request.user.is_superuser) and instance.agent != request.user:
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # For image updates, make sure we handle partial updates
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Check for image deletion
        if 'image' in request.data and request.data['image'] is None:
            # Handle image removal
            if hasattr(instance, 'image') and instance.image:
                instance.image.delete(save=False)
        
        self.perform_update(serializer)
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Allow deletion only if user owns the account or is admin.
        """
        instance = self.get_object()
        
        # Check if user is admin or owner of the payment account
        if not (request.user.is_staff or request.user.is_superuser) and instance.agent != request.user:
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Delete associated image if exists
        if hasattr(instance, 'image') and instance.image:
            instance.image.delete(save=False)
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """
        Toggle the active status of a payment account.
        Allow agents to toggle their own accounts.
        """
        payment_account = self.get_object()
        
        # Check if user is admin or owner of the payment account
        if not (request.user.is_staff or request.user.is_superuser) and payment_account.agent != request.user:
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        payment_account.is_active = not payment_account.is_active
        payment_account.save()
        
        serializer = self.get_serializer(payment_account)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def active_accounts(self, request):
        """
        Get active payment accounts for deposit/withdraw:
        - Players: Get their agent's accounts
        - Agents: Get their own accounts
        - Admin: Get all accounts
        - Super Admin: Get accounts without agent (agent=None)
        """
        operation = request.query_params.get('operation', 'deposit')
        account_type = request.query_params.get('account_type')
        
        try:
            current_user = request.user
            
            # Handle unauthenticated users
            if not current_user.is_authenticated:
                # For deposit, show super admin accounts (agent=None)
                if operation == 'deposit':
                    queryset = PaymentAccount.objects.filter(
                        is_active=True,
                        agent=None,
                    )
                else:
                    # For withdraw, unauthenticated users can't withdraw
                    queryset = PaymentAccount.objects.none()
            
            else:
                # Get user from database to ensure we have latest data
                user = User.objects.get(id=current_user.id)
                
                # Check if user is a player (has user_type=="player")
                if hasattr(user, 'user_type') and user.user_type == "player":
                    # Get agent_username from agent_id or use default
                    agent_username = user.agent_id if hasattr(user, 'agent_id') and user.agent_id else "nebaBingo"
                    
                    try:
                        # Get agent user by username
                        agent_user = User.objects.get(username=agent_username)
                        # Get agent instance
                        agent = Agent.objects.get(user=agent_user)
                        # Filter by this agent
                        queryset = PaymentAccount.objects.filter(
                            is_active=True,
                            agent=agent
                        )
                        
                    except (User.DoesNotExist, Agent.DoesNotExist):
                        queryset = PaymentAccount.objects.none()
                
                # Check if user is an agent
                elif hasattr(user, 'user_type') and user.user_type == "agent":
                    try:
                        agent = Agent.objects.get(user=user)
                        queryset = PaymentAccount.objects.filter(
                            is_active=True,
                            agent=agent
                        )
                    except Agent.DoesNotExist:
                        queryset = PaymentAccount.objects.none()
                
                # Check if user is admin/staff
                elif current_user.is_staff or current_user.is_superuser:
                    # Admin can see all accounts
                    queryset = PaymentAccount.objects.filter(is_active=True)
                
                else:
                    # Regular users without specific type get super admin accounts
                    queryset = PaymentAccount.objects.filter(
                        is_active=True,
                        agent=None,
                    )
        
        except Exception as e:
            print(f"Error in active_accounts: {e}")
            queryset = PaymentAccount.objects.none()
        
        # Apply operation-specific filters
        if operation == 'deposit':
            # For deposit, show only accounts with min_amount > 0
            queryset = queryset.filter(min_amount__gt=0)
            
            # Optional: Filter by payment method types
            if account_type == 'mobile':
                queryset = queryset.filter(payment_method__in=['telebirr', 'cbe_birr'])
            elif account_type == 'bank':
                queryset = queryset.exclude(payment_method__in=['telebirr', 'cbe_birr'])
        
        elif operation == 'withdraw':
            # For withdraw, check wallet balance
            try:
                wallet = Wallet.objects.get(user=current_user)
                balance = wallet.balance
                
                # Show only accounts where min_amount <= balance and max_amount >= min_amount
                queryset = queryset.filter(
                    min_amount__lte=balance,
                    max_amount__gte=models.F('min_amount')
                )
            except:
                print(f"Wallet error for user {current_user.username}")
                queryset = PaymentAccount.objects.none()
        
        # Apply additional filters
        payment_method = request.query_params.get('payment_method')
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        
        # For withdraw operations with mobile money, ensure phone_number is not empty
        if operation == 'withdraw':
            mobile_methods = ['telebirr', 'cbe_birr']
            queryset = queryset.exclude(
                models.Q(payment_method__in=mobile_methods) & 
                (models.Q(phone_number__isnull=True) | models.Q(phone_number=''))
            )
        
        # Apply ordering
        ordering = request.query_params.get('ordering')
        if ordering:
            queryset = queryset.order_by(ordering)
        else:
            # Default: Mobile money first, then banks, ordered by created date
            queryset = queryset.annotate(
                is_mobile=models.Case(
                    models.When(payment_method__in=['telebirr', 'cbe_birr'], then=models.Value(1)),
                    default=models.Value(2),
                    output_field=models.IntegerField()
                )
            ).order_by('is_mobile', 'created_at')
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def player_agent_accounts(self, request, player_username=None):
        """
        Get payment accounts for a player's assigned agent.
        Can be called with player username parameter or uses current user.
        """
        if player_username:
            try:
                player_user = User.objects.get(username=player_username)
            except User.DoesNotExist:
                return Response(
                    {"error": "Player not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            player_user = request.user
        
        if not player_user.is_authenticated or player_user.user_type != "player":
            return Response(
                {"error": "User is not a player"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if hasattr(player_user, 'agent_id') and player_user.agent_id:
            try:
                agent_user = User.objects.get(username=player_user.agent_id)
                agent = Agent.objects.get(user=agent_user)
                accounts = PaymentAccount.objects.filter(is_active=True, agent=agent)
                serializer = self.get_serializer(accounts, many=True)
                return Response(serializer.data)
            except (User.DoesNotExist, Agent.DoesNotExist):
                pass
        
        # Return empty if no agent found
        return Response([])

    @action(detail=False, methods=['get'])
    def agent_accounts(self, request, agent_username=None):
        """
        Get payment accounts for a specific agent.
        """
        if agent_username:
            try:
                agent_user = User.objects.get(username=agent_username)
                agent = Agent.objects.get(user=agent_user)
                accounts = PaymentAccount.objects.filter(is_active=True, agent=agent)
                serializer = self.get_serializer(accounts, many=True)
                return Response(serializer.data)
            except (User.DoesNotExist, Agent.DoesNotExist):
                return Response(
                    {"error": "Agent not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # If no username provided and user is agent, return their own accounts
        if request.user.is_authenticated and request.user.user_type == "agent":
            try:
                agent = Agent.objects.get(user=request.user)
                accounts = PaymentAccount.objects.filter(is_active=True, agent=agent)
                serializer = self.get_serializer(accounts, many=True)
                return Response(serializer.data)
            except Agent.DoesNotExist:
                pass
        
        return Response([])
    
    @action(detail=False, methods=['get'])
    def by_payment_method(self, request):
        """
        Get payment accounts grouped by payment method.
        """
        payment_method = request.query_params.get('method', None)
        if not payment_method:
            return Response(
                {"error": "Please provide payment method parameter"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        accounts = PaymentAccount.objects.filter(
            payment_method=payment_method,
            is_active=True
        )
        serializer = self.get_serializer(accounts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def payment_methods(self, request):
        """
        Get list of available payment methods.
        """
        from .models import PaymentMethod
        
        methods = [
            {"value": choice[0], "label": choice[1]}
            for choice in PaymentMethod.choices
        ]
        
        return Response(methods)
    
    @action(detail=False, methods=['get'])
    def public(self, request):
        """
        Get public payment accounts (active accounts only).
        """
        accounts = PaymentAccount.objects.filter(is_active=True)
        
        # Apply filters
        payment_method = request.query_params.get('payment_method', None)
        if payment_method:
            accounts = accounts.filter(payment_method=payment_method)
        
        agent_id = request.query_params.get('agent', None)
        if agent_id:
            accounts = accounts.filter(agent_id=agent_id)
        
        serializer = self.get_serializer(accounts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_accounts(self, request):
        """
        Get current user's payment accounts.
        """
        if not request.user.is_authenticated:
            return Response(
                {"detail": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Get agent for the user
        try:
            agent = Agent.objects.get(user=request.user)
            accounts = PaymentAccount.objects.filter(agent=agent)
            serializer = self.get_serializer(accounts, many=True)
            return Response(serializer.data)
        except Agent.DoesNotExist:
            # If user is not an agent, check if they're admin
            if request.user.is_staff or request.user.is_superuser:
                accounts = PaymentAccount.objects.all()
                serializer = self.get_serializer(accounts, many=True)
                return Response(serializer.data)
            else:
                accounts = PaymentAccount.objects.none()
                serializer = self.get_serializer(accounts, many=True)
                return Response(serializer.data)


# Add WalletViewSet
class WalletViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WalletSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Wallet.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_wallet(self, request):
        """Get current user's wallet"""
        wallet, created = Wallet.objects.get_or_create(user=request.user)
        serializer = self.get_serializer(wallet)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def balance(self, request):
        """Get current user's wallet balance"""
        wallet, created = Wallet.objects.get_or_create(user=request.user)
        return Response({
            'balance': float(wallet.balance),
            'currency': 'ETB',
            'updated_at': wallet.updated_at
        })

# Custom permission for agent and admin
class IsAgentOrAdmin(permissions.BasePermission):
    """
    Allow access to agents and admin users.
    """
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return False
        
        # Admin users always have permission
        if request.user.is_staff or request.user.is_superuser:
            return True
        
        # Check if user is an agent
        try:
            Agent.objects.get(user=request.user)
            return True
        except Agent.DoesNotExist:
            return False


class AgentMyDepositsView(APIView):
    """Get agent's deposit requests"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            agent = Agent.objects.get(user=request.user)
            
            # Get deposits for this agent's payment accounts
            deposits = Deposit.objects.filter(
                payment_account__agent=agent
            ).order_by('-created_at')
            
            # Apply filters
            status_filter = request.query_params.get('status')
            if status_filter:
                deposits = deposits.filter(status=status_filter)
            
            # Filter by date range
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            if start_date and end_date:
                try:
                    start = datetime.strptime(start_date, '%Y-%m-%d').date()
                    end = datetime.strptime(end_date, '%Y-%m-%d').date()
                    deposits = deposits.filter(created_at__date__gte=start, created_at__date__lte=end)
                except:
                    pass
            
            serializer = DepositSerializer(deposits, many=True)
            return Response(serializer.data)
            
        except Agent.DoesNotExist:
            return Response(
                {'error': 'You are not registered as an agent'},
                status=status.HTTP_403_FORBIDDEN
            )


class AgentMyWithdrawalsView(APIView):
    """Get agent's withdrawal requests"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            agent = Agent.objects.get(user=request.user)
            
            # Get withdrawals for this agent's payment accounts
            withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent
            ).order_by('-created_at')
            
            # Apply filters
            status_filter = request.query_params.get('status')
            if status_filter:
                withdrawals = withdrawals.filter(status=status_filter)
            
            # Filter by date range
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            if start_date and end_date:
                try:
                    start = datetime.strptime(start_date, '%Y-%m-%d').date()
                    end = datetime.strptime(end_date, '%Y-%m-%d').date()
                    withdrawals = withdrawals.filter(created_at__date__gte=start, created_at__date__lte=end)
                except:
                    pass
            
            serializer = WithdrawRequestSerializer(withdrawals, many=True)
            return Response(serializer.data)
            
        except Agent.DoesNotExist:
            return Response(
                {'error': 'You are not registered as an agent'},
                status=status.HTTP_403_FORBIDDEN
            )


# Your existing AgentListView, AgentDetailView, etc...
class AgentListView(APIView):
    """Get all agents or create new agent"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        agents = Agent.objects.all().select_related('user')
        
        # Get date range from query params
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        # Calculate date range
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except:
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
        else:
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
        
        agents_data = []
        for agent in agents:
            # Calculate agent's total deposits and withdrawals for the date range
            agent_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            agent_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            # Get agent's players (users with this agent as agent_id)
            player_users = User.objects.filter(agent_id=agent.user.username)
            total_players = player_users.count()
            
            agents_data.append({
                'id': agent.id,
                'username': agent.user.username,
                'first_name': agent.user.first_name,
                'last_name': agent.user.last_name,
                'email': agent.user.email,
                'phone_number': agent.phone_number,
                'commission_rate': float(agent.commission_rate),
                'total_earnings': float(agent.total_earnings),
                'is_active': agent.is_active,
                'total_deposits': float(agent_deposits),
                'total_withdrawals': float(agent_withdrawals),
                'total_players': total_players,
                'agent_link': f"https://t.me/chalabingo_bot?start={agent.user.username}",
                'agent_id': agent.user.agent_id,
                'date_joined': agent.user.date_joined,
                'address': agent.address,
                'date_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                }
            })
        
        return Response(agents_data)
    
    def post(self, request):
        serializer = CreateAgentSerializer(data=request.data)
        if serializer.is_valid():
            agent = serializer.save()
            return Response(AgentSerializer(agent).data, status=status.HTTP_201_CREATED)
        # Add detailed error logging
        print("Serializer errors:", serializer.errors)
        return Response({
            'error': 'Validation failed',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AgentDetailView(APIView):
    """Get, update, or delete a specific agent"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request, pk):
        try:
            agent = Agent.objects.get(pk=pk)
            
            # Get date range from query params
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            
            # Calculate date range
            if start_date_str and end_date_str:
                try:
                    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                except:
                    end_date = date.today()
                    start_date = end_date - timedelta(days=30)
            else:
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
            
            # Calculate agent's total deposits and withdrawals for the date range
            agent_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            agent_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            agent_data = {
                'id': agent.id,
                'username': agent.user.username,
                'first_name': agent.user.first_name,
                'last_name': agent.user.last_name,
                'email': agent.user.email,
                'phone_number': agent.phone_number,
                'commission_rate': float(agent.commission_rate),
                'total_earnings': float(agent.total_earnings),
                'is_active': agent.is_active,
                'total_deposits': float(agent_deposits),
                'total_withdrawals': float(agent_withdrawals),
                'agent_link': f"https://t.me/chalabingo_bot?start={agent.user.username}",
                'agent_id': agent.user.agent_id,
                'date_joined': agent.user.date_joined,
                'address': agent.address,
                'date_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                }
            }
            
            return Response(agent_data)
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def put(self, request, pk):
        try:
            agent = Agent.objects.get(pk=pk)
            serializer = AgentSerializer(agent, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def delete(self, request, pk):
        try:
            agent = Agent.objects.get(pk=pk)
            agent.is_active = False
            agent.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


# Your existing AgentAnalyticsView, AgentDashboardView, AdminStatsView, etc...
class AgentAnalyticsView(APIView):
    """Get agent-specific analytics"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        agent_id = request.query_params.get('agent_id')  # Optional filter for specific agent
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except:
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
        
        # Get agents based on filter
        if agent_id:
            agents = Agent.objects.filter(id=agent_id, is_active=True)
        else:
            agents = Agent.objects.filter(is_active=True)
        
        agents_data = []
        total_agent_commission = Decimal('0')
        total_admin_earnings = Decimal('0')
        
        for agent in agents:
            # Get agent's deposits and withdrawals
            agent_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(
                total=Sum('amount'),
                count=Count('id')
            )
            
            agent_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(
                total=Sum('amount'),
                count=Count('id')
            )
            
            total_amount = (agent_deposits['total'] or Decimal('0')) + (agent_withdrawals['total'] or Decimal('0'))
            agent_commission = (total_amount * agent.commission_rate) / Decimal('100')
            admin_earnings = total_amount - agent_commission
            
            agents_data.append({
                'id': agent.id,
                'name': agent.user.username,
                'phone_number': agent.phone_number,
                'commission_rate': float(agent.commission_rate),
                'total_deposits': float(agent_deposits['total'] or 0),
                'total_withdrawals': float(agent_withdrawals['total'] or 0),
                'total_transactions': (agent_deposits['count'] or 0) + (agent_withdrawals['count'] or 0),
                'agent_commission': float(agent_commission),
                'admin_earnings': float(admin_earnings),
                'total_earnings': float(agent.total_earnings)
            })
            
            total_agent_commission += agent_commission
            total_admin_earnings += admin_earnings
        
        # Get agent performance over time
        performance_data = []
        current_date = start_date
        while current_date <= end_date:
            day_data = []
            for agent in agents:
                day_deposits = Deposit.objects.filter(
                    payment_account__agent=agent,
                    status='approved',
                    created_at__date=current_date
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                
                day_withdrawals = WithdrawRequest.objects.filter(
                    payment_account__agent=agent,
                    status='approved',
                    created_at__date=current_date
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                
                if day_deposits > 0 or day_withdrawals > 0:
                    day_data.append({
                        'agent': agent.user.username,
                        'deposits': float(day_deposits),
                        'withdrawals': float(day_withdrawals),
                        'total': float(day_deposits + day_withdrawals)
                    })
            
            performance_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'total_agents': len(day_data),
                'total_deposits': sum(item['deposits'] for item in day_data),
                'total_withdrawals': sum(item['withdrawals'] for item in day_data),
                'total_transactions': float(sum(item['deposits'] + item['withdrawals'] for item in day_data)),
                'agents': day_data
            })
            
            current_date += timedelta(days=1)
        
        return Response({
            'agents': agents_data,
            'performance_data': performance_data,
            'summary': {
                'total_agents': agents.count(),
                'total_agent_commission': float(total_agent_commission),
                'total_admin_earnings': float(total_admin_earnings),
                'total_transactions': sum(agent['total_transactions'] for agent in agents_data),
                'date_range': {
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d')
                }
            }
        })


class AgentDashboardView(APIView):
    """Get agent dashboard data (for agent users)"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            agent = Agent.objects.get(user=request.user)
            
            # Today's stats
            today = date.today()
            today_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date=today
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            today_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date=today
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            # Weekly stats
            week_ago = today - timedelta(days=7)
            weekly_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date__gte=week_ago
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            weekly_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date__gte=week_ago
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            # Recent transactions
            recent_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                status='approved'
            ).order_by('-created_at')[:10]
            
            recent_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                status='approved'
            ).order_by('-created_at')[:10]
            
            return Response({
                'agent': {
                    'username': agent.user.username,
                    'commission_rate': float(agent.commission_rate),
                    'total_earnings': float(agent.total_earnings),
                    'phone_number': agent.phone_number,
                    "agent_id": agent.user.agent_id
                },
                'today_stats': {
                    'deposits': float(today_deposits),
                    'withdrawals': float(today_withdrawals),
                    'total': float(today_deposits + today_withdrawals)
                },
                'weekly_stats': {
                    'deposits': float(weekly_deposits),
                    'withdrawals': float(weekly_withdrawals),
                    'total': float(weekly_deposits + weekly_withdrawals)
                },
                'recent_deposits': [
                    {
                        'id': dep.id,
                        'amount': float(dep.amount),
                        'status': dep.status,
                        'created_at': dep.created_at
                    } for dep in recent_deposits
                ],
                'recent_withdrawals': [
                    {
                        'id': wd.id,
                        'amount': float(wd.amount),
                        'status': wd.status,
                        'created_at': wd.created_at
                    } for wd in recent_withdrawals
                ]
            })
            
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found for this user'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"Error in AgentDashboardView: {str(e)}")
            return Response(
                {'error': f'An error occurred: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Your existing AdminStatsView, QuickStatsView, etc...
class AdminStatsView(APIView):
    """Get comprehensive admin statistics"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        # Parse date range from query params
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        period = request.query_params.get('period', 'today')
        
        # Set default date range based on period
        if not start_date_str or not end_date_str:
            if period == 'today':
                start_date = date.today()
                end_date = date.today()
            elif period == 'yesterday':
                start_date = date.today() - timedelta(days=1)
                end_date = date.today() - timedelta(days=1)
            elif period == 'week':
                start_date = date.today() - timedelta(days=7)
                end_date = date.today()
            elif period == 'month':
                start_date = date.today() - timedelta(days=30)
                end_date = date.today()
            else:
                start_date = date.today() - timedelta(days=30)
                end_date = date.today()
        else:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except:
                start_date = date.today() - timedelta(days=30)
                end_date = date.today()
        
        # Calculate statistics
        stats = self.calculate_stats(start_date, end_date)
        
        return Response(stats)
    
    def calculate_stats(self, start_date, end_date):
        """Calculate all statistics for the given date range"""
        # Date filter for queries
        date_filter = Q(created_at__date__gte=start_date, created_at__date__lte=end_date)
        
        # 1. Summary Statistics
        total_deposits = Deposit.objects.filter(
            status='approved', created_at__date__gte=start_date, created_at__date__lte=end_date
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        total_withdrawals = WithdrawRequest.objects.filter(
            status='approved', created_at__date__gte=start_date, created_at__date__lte=end_date
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        total_transactions = Transaction.objects.filter(date_filter).count()
        
        total_users = User.objects.filter(date_joined__date__lte=end_date).count()
        
        active_users_today = User.objects.filter(
            last_login__date=date.today()
        ).count()
        
        pending_deposits = Deposit.objects.filter(status='pending').count()
        pending_withdrawals = WithdrawRequest.objects.filter(status='pending').count()
        
        total_revenue = float(total_deposits)
        net_profit = float(total_deposits) - float(total_withdrawals)
        
        # 2. Daily Statistics for Chart
        daily_stats = []
        current_date = start_date
        while current_date <= end_date:
            day_deposits = Deposit.objects.filter(
                status='approved', created_at__date=current_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            day_withdrawals = WithdrawRequest.objects.filter(
                status='approved', created_at__date=current_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            day_transactions = Transaction.objects.filter(
                created_at__date=current_date
            ).count()
            
            day_new_users = User.objects.filter(
                date_joined__date=current_date
            ).count()
            
            day_active_users = User.objects.filter(
                last_login__date=current_date
            ).count()
            
            daily_stats.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'total_deposits': float(day_deposits),
                'total_withdrawals': float(day_withdrawals),
                'total_transactions': day_transactions,
                'new_users': day_new_users,
                'active_users': day_active_users,
                'total_revenue': float(day_deposits),
                'net_profit': float(day_deposits) - float(day_withdrawals)
            })
            
            current_date += timedelta(days=1)
        
        # 3. Recent Activity
        recent_deposits = Deposit.objects.filter(
            created_at__date__gte=start_date, created_at__date__lte=end_date
        ).order_by('-created_at')[:10]
        
        recent_withdrawals = WithdrawRequest.objects.filter(
            created_at__date__gte=start_date, created_at__date__lte=end_date
        ).order_by('-created_at')[:10]
        
        # 4. Top Users by Transaction Amount
        top_users = Transaction.objects.filter(date_filter).values(
            'user__username', 'user__email'
        ).annotate(
            transaction_count=Count('id'),
            total_amount=Sum('amount')
        ).order_by('-total_amount')[:5]
        
        top_users_list = []
        for user in top_users:
            top_users_list.append({
                'username': user['user__username'],
                'email': user['user__email'],
                'transaction_count': user['transaction_count'],
                'total_amount': float(user['total_amount'] or 0)
            })
        
        # 5. Payment Method Distribution
        payment_methods = Deposit.objects.filter(date_filter).exclude(
            payment_account__isnull=True
        ).values(
            'payment_account__payment_method'
        ).annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')
        
        payment_methods_list = []
        for method in payment_methods:
            payment_methods_list.append({
                'method': method['payment_account__payment_method'] or 'Unknown',
                'method_display': method['payment_account__payment_method'].replace('_', ' ').title() if method['payment_account__payment_method'] else 'Unknown',
                'count': method['count'],
                'total': float(method['total'] or 0)
            })
        
        # 6. Recent Transactions
        recent_transactions = Transaction.objects.filter(date_filter).order_by('-created_at')[:20]
        recent_transactions_data = []
        for trans in recent_transactions:
            recent_transactions_data.append({
                'id': trans.id,
                'user': trans.user.username,
                'amount': float(trans.amount),
                'type': trans.transaction_type,
                'type_display': trans.get_transaction_type_display(),
                'status': trans.status,
                'status_display': trans.get_status_display(),
                'description': trans.description,
                'created_at': trans.created_at
            })
        
        # 7. Agent Statistics with total deposits and withdrawals
        agents = Agent.objects.filter(is_active=True)
        agents_data = []
        for agent in agents:
            agent_deposits = Deposit.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(
                total=Sum('amount'),
                count=Count('id')
            )
            
            agent_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent,
                status='approved',
                created_at__date__gte=start_date,
                created_at__date__lte=end_date
            ).aggregate(
                total=Sum('amount'),
                count=Count('id')
            )
            
            total_amount = (agent_deposits['total'] or Decimal('0')) + (agent_withdrawals['total'] or Decimal('0'))
            agent_gain = (total_amount * agent.commission_rate) / Decimal('100')
            admin_gain = total_amount - agent_gain
            
            agents_data.append({
                'id': agent.id,
                'name': agent.user.username,
                'phone_number': agent.phone_number,
                'total_deposits': float(agent_deposits['total'] or 0),
                'total_withdrawals': float(agent_withdrawals['total'] or 0),
                'total_rounds': (agent_deposits['count'] or 0) + (agent_withdrawals['count'] or 0),
                'agent_gain': float(agent_gain),
                'admin_gain': float(admin_gain),
                'commission_rate': float(agent.commission_rate),
                "agent_id": agent.user.agent_id,
                "agent_link": f"https://t.me/chalabingo_bot?start={agent.user.username}"
            })
        
        # 8. Dashboard Card Statistics
        # Get yesterday's stats for comparison
        yesterday = date.today() - timedelta(days=1)
        yesterday_deposits = Deposit.objects.filter(
            status='approved', created_at__date=yesterday
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        yesterday_withdrawals = WithdrawRequest.objects.filter(
            status='approved', created_at__date=yesterday
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        yesterday_users = User.objects.filter(
            last_login__date=yesterday
        ).count()
        
        # Calculate changes
        deposit_change = self.calculate_percentage_change(float(total_deposits), float(yesterday_deposits))
        withdrawal_change = self.calculate_percentage_change(float(total_withdrawals), float(yesterday_withdrawals))
        user_change = self.calculate_percentage_change(active_users_today, yesterday_users)
        
        # Get game rounds count (from transactions with game_round)
        total_rounds = Transaction.objects.filter(
            date_filter,
            game_round__isnull=False
        ).count()
        
        yesterday_rounds = Transaction.objects.filter(
            created_at__date=yesterday,
            game_round__isnull=False
        ).count()
        
        rounds_change = self.calculate_percentage_change(total_rounds, yesterday_rounds)
        
        # Calculate profit (revenue - withdrawals)
        total_profit = float(total_deposits) - float(total_withdrawals)
        
        # Calculate pending amounts
        pending_deposit_amount = Deposit.objects.filter(
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        pending_withdraw_amount = WithdrawRequest.objects.filter(
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # Compile all statistics
        return {
            # Summary Stats
            'total_deposits': float(total_deposits),
            'total_withdrawals': float(total_withdrawals),
            'total_transactions': total_transactions,
            'total_users': total_users,
            'active_users_today': active_users_today,
            'pending_deposits': pending_deposits,
            'pending_withdrawals': pending_withdrawals,
            'total_revenue': total_revenue,
            'net_profit': net_profit,
            
            # Dashboard Cards Data
            'stats_cards': {
                'total_rounds': total_rounds,
                'rounds_change': rounds_change,
                'total_players': total_users,
                'players_change': user_change,
                'total_withdrawal': float(total_withdrawals),
                'withdrawal_change': withdrawal_change,
                'withdraw_pending': float(pending_withdraw_amount),
                'pending_change': self.calculate_percentage_change(
                    float(pending_withdraw_amount), 
                    0
                ),
                'withdraw_approved': float(total_withdrawals),
                'approved_change': withdrawal_change,
                'total_deposit': float(total_deposits),
                'deposit_change': deposit_change,
                'deposit_approved': float(total_deposits),
                'deposit_approved_change': deposit_change,
                'deposit_pending': float(pending_deposit_amount),
                'deposit_pending_change': self.calculate_percentage_change(
                    float(pending_deposit_amount),
                    0
                ),
                'total_earning': float(total_deposits),
                'earning_change': deposit_change,
                'total_profit': total_profit,
                'profit_change': self.calculate_percentage_change(
                    total_profit,
                    0
                ),
            },
            
            # Agent Data with total deposits and withdrawals
            'agents': agents_data,
            
            # Chart Data
            'daily_stats': daily_stats,
            
            # Recent Activity
            'recent_deposits': self.serialize_deposits(recent_deposits),
            'recent_withdrawals': self.serialize_withdrawals(recent_withdrawals),
            'recent_transactions': recent_transactions_data,
            'recent_activity': self.get_recent_activity(start_date, end_date),
            
            # Analytics
            'top_users': top_users_list,
            'payment_methods': payment_methods_list,
            
            # Date Info
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'period': f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d, %Y')}"
            }
        }
    
    def calculate_percentage_change(self, current, previous):
        """Calculate percentage change between two values"""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return ((current - previous) / abs(previous)) * 100.0
    
    def get_recent_activity(self, start_date, end_date):
        """Get recent activity data for dashboard"""
        # Combine deposits, withdrawals, and transactions
        activities = []
        
        # Get recent deposits
        deposits = Deposit.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        ).order_by('-created_at')[:5]
        
        for deposit in deposits:
            activities.append({
                'type': 'deposit',
                'user': deposit.user.username,
                'amount': float(deposit.amount),
                'status': deposit.status,
                'timestamp': deposit.created_at,
                'description': f'Deposit via {deposit.payment_account.get_payment_method_display() if deposit.payment_account else "Unknown"}'
            })
        
        # Get recent withdrawals
        withdrawals = WithdrawRequest.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date
        ).order_by('-created_at')[:5]
        
        for withdrawal in withdrawals:
            activities.append({
                'type': 'withdrawal',
                'user': withdrawal.user.username,
                'amount': float(withdrawal.amount),
                'status': withdrawal.status,
                'timestamp': withdrawal.created_at,
                'description': f'Withdrawal to {withdrawal.account_name}'
            })
        
        # Get recent game transactions
        game_transactions = Transaction.objects.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
            game_round__isnull=False
        ).order_by('-created_at')[:5]
        
        for transaction in game_transactions:
            activities.append({
                'type': 'game',
                'user': transaction.user.username,
                'amount': float(transaction.amount),
                'status': transaction.status,
                'timestamp': transaction.created_at,
                'description': transaction.description or 'Game transaction'
            })
        
        # Sort by timestamp and return top 10
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        return activities[:10]
    
    def serialize_deposits(self, deposits):
        """Serialize deposit data"""
        result = []
        for deposit in deposits:
            result.append({
                'id': deposit.id,
                'user': deposit.user.username,
                'amount': float(deposit.amount),
                'payment_method': deposit.payment_account.payment_method if deposit.payment_account else 'Unknown',
                'payment_method_display': deposit.payment_account.get_payment_method_display() if deposit.payment_account else 'Unknown',
                'status': deposit.status,
                'status_display': deposit.get_status_display(),
                'proof_image': deposit.proof_image.url if deposit.proof_image else None,
                'created_at': deposit.created_at,
                'phone_number': deposit.phone_number
            })
        return result
    
    def serialize_withdrawals(self, withdrawals):
        """Serialize withdrawal data"""
        result = []
        for withdrawal in withdrawals:
            result.append({
                'id': withdrawal.id,
                'user': withdrawal.user.username,
                'amount': float(withdrawal.amount),
                'payment_method': withdrawal.payment_account.payment_method if withdrawal.payment_account else 'Unknown',
                'payment_method_display': withdrawal.payment_account.get_payment_method_display() if withdrawal.payment_account else 'Unknown',
                'status': withdrawal.status,
                'status_display': withdrawal.get_status_display(),
                'account_name': withdrawal.account_name,
                'account_number': withdrawal.account_number,
                'created_at': withdrawal.created_at,
                'phone_number': withdrawal.phone_number
            })
        return result


class QuickStatsView(APIView):
    """Get quick overview statistics for admin dashboard"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        # Today's stats
        today_deposits = Deposit.objects.filter(
            status='approved', created_at__date=today
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        today_withdrawals = WithdrawRequest.objects.filter(
            status='approved', created_at__date=today
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        today_transactions = Transaction.objects.filter(created_at__date=today).count()
        
        # Yesterday's stats for comparison
        yesterday_deposits = Deposit.objects.filter(
            status='approved', created_at__date=yesterday
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        yesterday_withdrawals = WithdrawRequest.objects.filter(
            status='approved', created_at__date=yesterday
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        yesterday_transactions = Transaction.objects.filter(created_at__date=yesterday).count()
        
        # Calculate percentages
        deposit_change = self.calculate_percentage_change(float(today_deposits), float(yesterday_deposits))
        withdrawal_change = self.calculate_percentage_change(float(today_withdrawals), float(yesterday_withdrawals))
        transaction_change = self.calculate_percentage_change(today_transactions, yesterday_transactions)
        
        # Pending counts
        pending_deposits = Deposit.objects.filter(status='pending').count()
        pending_withdrawals = WithdrawRequest.objects.filter(status='pending').count()
        
        # Pending amounts
        pending_deposit_amount = Deposit.objects.filter(
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        pending_withdraw_amount = WithdrawRequest.objects.filter(
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        
        # Active users
        active_users = User.objects.filter(last_login__date=today).count()
        new_users_today = User.objects.filter(date_joined__date=today).count()
        
        # Game rounds
        today_rounds = Transaction.objects.filter(
            created_at__date=today,
            game_round__isnull=False
        ).count()
        
        yesterday_rounds = Transaction.objects.filter(
            created_at__date=yesterday,
            game_round__isnull=False
        ).count()
        
        rounds_change = self.calculate_percentage_change(today_rounds, yesterday_rounds)
        
        # Total profit
        total_profit = float(today_deposits) - float(today_withdrawals)
        yesterday_profit = float(yesterday_deposits) - float(yesterday_withdrawals)
        profit_change = self.calculate_percentage_change(total_profit, yesterday_profit)
        
        return Response({
            'today': {
                'date': today.strftime('%Y-%m-%d'),
                'deposits': float(today_deposits),
                'withdrawals': float(today_withdrawals),
                'transactions': today_transactions,
                'active_users': active_users,
                'new_users': new_users_today,
                'rounds': today_rounds,
                'profit': total_profit
            },
            'changes': {
                'deposits': deposit_change,
                'withdrawals': withdrawal_change,
                'transactions': transaction_change,
                'rounds': rounds_change,
                'profit': profit_change
            },
            'pending': {
                'deposits': pending_deposits,
                'withdrawals': pending_withdrawals,
                'total': pending_deposits + pending_withdrawals,
                'deposit_amount': float(pending_deposit_amount),
                'withdraw_amount': float(pending_withdraw_amount)
            },
            'summary': {
                'total_users': User.objects.count(),
                'total_deposits_all_time': float(Deposit.objects.filter(status='approved').aggregate(total=Sum('amount'))['total'] or Decimal('0')),
                'total_withdrawals_all_time': float(WithdrawRequest.objects.filter(status='approved').aggregate(total=Sum('amount'))['total'] or Decimal('0')),
                'total_transactions_all_time': Transaction.objects.count(),
                'total_rounds_all_time': Transaction.objects.filter(game_round__isnull=False).count()
            }
        })
    
    def calculate_percentage_change(self, current, previous):
        """Calculate percentage change between two values"""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return ((current - previous) / abs(previous)) * 100.0


class TransactionAnalyticsView(APIView):
    """Get transaction analytics for charts"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        end_date = date.today()
        start_date = end_date - timedelta(days=days-1)
        
        # Get transaction data by day
        analytics_data = []
        current_date = start_date
        
        while current_date <= end_date:
            # Get transactions for this day
            deposits = Deposit.objects.filter(
                status='approved', created_at__date=current_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            withdrawals = WithdrawRequest.objects.filter(
                status='approved', created_at__date=current_date
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            
            transactions = Transaction.objects.filter(created_at__date=current_date).count()
            
            analytics_data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'day': current_date.strftime('%a'),
                'deposits': float(deposits),
                'withdrawals': float(withdrawals),
                'transactions': transactions,
                'net_flow': float(deposits) - float(withdrawals)
            })
            
            current_date += timedelta(days=1)
        
        # Get transaction type distribution
        transaction_types = Transaction.objects.filter(
            created_at__date__gte=start_date, created_at__date__lte=end_date
        ).values('transaction_type').annotate(
            count=Count('id'),
            total=Sum('amount')
        ).order_by('-total')
        
        type_distribution = []
        for ttype in transaction_types:
            type_distribution.append({
                'type': ttype['transaction_type'],
                'type_display': dict(Transaction.TransactionType.choices).get(ttype['transaction_type'], ttype['transaction_type']),
                'count': ttype['count'],
                'total': float(ttype['total'] or 0)
            })
        
        # Get status distribution
        status_distribution = Transaction.objects.filter(
            created_at__date__gte=start_date, created_at__date__lte=end_date
        ).values('status').annotate(
            count=Count('id')
        ).order_by('-count')
        
        status_data = []
        for status in status_distribution:
            status_data.append({
                'status': status['status'],
                'status_display': dict(Transaction.TransactionStatus.choices).get(status['status'], status['status']),
                'count': status['count']
            })
        
        return Response({
            'daily_analytics': analytics_data,
            'transaction_type_distribution': type_distribution,
            'status_distribution': status_data,
            'period': {
                'days': days,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')
            }
        })


class UserAnalyticsView(APIView):
    """Get user analytics and statistics"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        end_date = date.today()
        start_date = end_date - timedelta(days=days-1)
        
        # Get user growth data
        user_growth = []
        current_date = start_date
        
        while current_date <= end_date:
            new_users = User.objects.filter(date_joined__date=current_date).count()
            active_users = User.objects.filter(last_login__date=current_date).count()
            
            user_growth.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'new_users': new_users,
                'active_users': active_users,
                'total_users': User.objects.filter(date_joined__date__lte=current_date).count()
            })
            
            current_date += timedelta(days=1)
        
        # Get user transaction stats
        top_active_users = Transaction.objects.filter(
            created_at__date__gte=start_date, created_at__date__lte=end_date
        ).values('user__username', 'user__email', 'user__date_joined').annotate(
            transaction_count=Count('id'),
            total_deposits=Sum('amount', filter=Q(transaction_type='deposit')),
            total_withdrawals=Sum('amount', filter=Q(transaction_type='withdraw'))
        ).order_by('-transaction_count')[:10]
        
        active_users_list = []
        for user in top_active_users:
            active_users_list.append({
                'username': user['user__username'],
                'email': user['user__email'],
                'joined_date': user['user__date_joined'],
                'transaction_count': user['transaction_count'],
                'total_deposits': float(user['total_deposits'] or 0),
                'total_withdrawals': float(user['total_withdrawals'] or 0),
                'net_balance': float((user['total_deposits'] or 0) - (user['total_withdrawals'] or 0))
            })
        
        # Get all users with their balances
        users = User.objects.all()[:50]  # Limit to 50 users for performance
        users_data = []
        for user in users:
            wallet = getattr(user, 'wallet', None)
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'phone_number': getattr(user, 'phone_number', ''),
                'balance': float(wallet.balance) if wallet else 0.0,
                'is_active': user.is_active,
                'date_joined': user.date_joined,
                'last_login': user.last_login
            })
        
        # Get user registration sources (if available)
        total_users = User.objects.count()
        users_today = User.objects.filter(date_joined__date=end_date).count()
        users_this_week = User.objects.filter(date_joined__date__gte=end_date - timedelta(days=7)).count()
        users_this_month = User.objects.filter(date_joined__date__gte=end_date - timedelta(days=30)).count()
        
        return Response({
            'user_growth': user_growth,
            'top_active_users': active_users_list,
            'users': users_data,
            'summary': {
                'total_users': total_users,
                'users_today': users_today,
                'users_this_week': users_this_week,
                'users_this_month': users_this_month,
                'active_users_today': User.objects.filter(last_login__date=end_date).count(),
                'active_users_this_week': User.objects.filter(last_login__date__gte=end_date - timedelta(days=7)).count()
            }
        })


class RecentActivityView(APIView):
    """Get recent activity data for admin dashboard"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        limit = int(request.query_params.get('limit', 20))
        
        # Check if user is agent
        if hasattr(request.user, 'agent_profile'):
            # Agent: only see their own activity
            agent = request.user.agent_profile
            
            # Get agent's deposits
            recent_deposits = Deposit.objects.filter(
                payment_account__agent=agent
            ).order_by('-created_at')[:limit]
            
            # Get agent's withdrawals
            recent_withdrawals = WithdrawRequest.objects.filter(
                payment_account__agent=agent
            ).order_by('-created_at')[:limit]
            
            # Combine and sort by timestamp
            all_activities = []
            
            for deposit in recent_deposits:
                all_activities.append({
                    'type': 'deposit',
                    'id': deposit.id,
                    'user': deposit.user.username,
                    'amount': float(deposit.amount),
                    'status': deposit.status,
                    'timestamp': deposit.created_at,
                    'description': f'Deposit via {deposit.payment_account.get_payment_method_display() if deposit.payment_account else "Unknown"}'
                })
            
            for withdrawal in recent_withdrawals:
                all_activities.append({
                    'type': 'withdrawal',
                    'id': withdrawal.id,
                    'user': withdrawal.user.username,
                    'amount': float(withdrawal.amount),
                    'status': withdrawal.status,
                    'timestamp': withdrawal.created_at,
                    'description': f'Withdrawal to {withdrawal.account_name}'
                })
            
        else:
            # Admin/Superuser: see all activity
            recent_deposits = Deposit.objects.all().order_by('-created_at')[:limit]
            recent_withdrawals = WithdrawRequest.objects.all().order_by('-created_at')[:limit]
            recent_transactions = Transaction.objects.all().order_by('-created_at')[:limit]
            
            # Combine and sort by timestamp
            all_activities = []
            
            for deposit in recent_deposits:
                all_activities.append({
                    'type': 'deposit',
                    'id': deposit.id,
                    'user': deposit.user.username,
                    'amount': float(deposit.amount),
                    'status': deposit.status,
                    'timestamp': deposit.created_at,
                    'description': f'Deposit via {deposit.payment_account.get_payment_method_display() if deposit.payment_account else "Unknown"}'
                })
            
            for withdrawal in recent_withdrawals:
                all_activities.append({
                    'type': 'withdrawal',
                    'id': withdrawal.id,
                    'user': withdrawal.user.username,
                    'amount': float(withdrawal.amount),
                    'status': withdrawal.status,
                    'timestamp': withdrawal.created_at,
                    'description': f'Withdrawal to {withdrawal.account_name}'
                })
            
            for transaction in recent_transactions:
                all_activities.append({
                    'type': 'transaction',
                    'id': transaction.id,
                    'user': transaction.user.username,
                    'amount': float(transaction.amount),
                    'status': transaction.status,
                    'timestamp': transaction.created_at,
                    'description': transaction.description or f'{transaction.get_transaction_type_display()}'
                })
        
        # Sort by timestamp and limit
        all_activities.sort(key=lambda x: x['timestamp'], reverse=True)
        all_activities = all_activities[:limit]
        
        return Response({
            'activities': all_activities,
            'total_count': len(all_activities)
        })


class DashboardDataView(APIView):
    """Get all data needed for admin dashboard in one endpoint"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request):
        # Get quick stats
        quick_stats = QuickStatsView().get(request).data
        
        # Get recent activity
        recent_activity = RecentActivityView().get(request).data
        
        # Combine all data
        return Response({
            'quick_stats': quick_stats,
            'recent_activity': recent_activity['activities'][:10],
            'timestamp': datetime.now().isoformat()
        })


class DepositViewSet(viewsets.ModelViewSet):
    serializer_class = DepositSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Deposit.objects.all().order_by('-created_at')
        
        # Check if user is an agent
        try:
            agent = Agent.objects.get(user=self.request.user)
            # Return deposits for this agent's payment accounts
            return Deposit.objects.filter(payment_account__agent=agent).order_by('-created_at')
        except Agent.DoesNotExist:
            # Return user's own deposits
            return Deposit.objects.filter(user=self.request.user).order_by('-created_at')
    
    def get_permissions(self):
        # Allow both admin and agent to approve/reject
        if self.action in ['approve', 'reject']:
            return [IsAgentOrAdmin()]
        return [IsAuthenticated()]
    
    def create(self, request, *args, **kwargs):
        """
        Handle deposit creation with file upload
        """
        # Prepare data for serializer
        data = {}
        
        # Copy text fields from request.POST
        if hasattr(request, 'POST') and request.POST:
            for key in request.POST:
                data[key] = request.POST[key]
        
        # Copy files from request.FILES
        if hasattr(request, 'FILES') and request.FILES:
            for key in request.FILES:
                data[key] = request.FILES[key]
        
        # Handle payment_account conversion
        if 'payment_account' in data and isinstance(data['payment_account'], str):
            try:
                data['payment_account'] = int(data['payment_account'])
            except (ValueError, TypeError):
                pass
        
        # Handle amount conversion
        if 'amount' in data and isinstance(data['amount'], str):
            try:
                from decimal import Decimal
                data['amount'] = Decimal(data['amount'])
            except (ValueError, TypeError):
                pass
        
        # Create serializer with prepared data
        serializer = self.get_serializer(data=data)
        
        if serializer.is_valid():
            # Save with user
            serializer.save(user=request.user)
            
            # Create transaction record
            Transaction.objects.create(
                user=request.user,
                amount=serializer.validated_data['amount'],
                transaction_type='deposit',
                status='pending',
                description=f'Deposit via {serializer.validated_data.get("payment_account", "Unknown")}'
            )
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_deposits(self, request):
        """Get current user's deposits"""
        deposits = Deposit.objects.filter(user=request.user).order_by('-created_at')
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            deposits = deposits.filter(status=status_filter)
        
        # Filter by date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                deposits = deposits.filter(created_at__date__gte=start, created_at__date__lte=end)
            except:
                pass
        
        # Apply pagination
        page = self.paginate_queryset(deposits)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(deposits, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a deposit (admin or agent)"""
        deposit = self.get_object()
        
        # Check if user has permission to approve this deposit
        # Admin can approve any deposit
        if request.user.is_staff or request.user.is_superuser:
            pass
        else:
            # Agent can only approve deposits for their payment accounts
            try:
                agent = Agent.objects.get(user=request.user)
                if deposit.payment_account.agent != agent:
                    return Response(
                        {'error': 'You can only approve deposits for your payment accounts'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except (Agent.DoesNotExist, AttributeError):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = DepositApprovalSerializer(data=request.data)
        
        if serializer.is_valid():
            notes = serializer.validated_data.get('notes', '')
            deposit.approve(request.user, notes)
            return Response({'message': 'አስገባቱ ተፈቅዷል'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a deposit (admin or agent)"""
        deposit = self.get_object()
        
        # Check if user has permission to reject this deposit
        # Admin can reject any deposit
        if request.user.is_staff or request.user.is_superuser:
            pass
        else:
            # Agent can only reject deposits for their payment accounts
            try:
                agent = Agent.objects.get(user=request.user)
                if deposit.payment_account.agent != agent:
                    return Response(
                        {'error': 'You can only reject deposits for your payment accounts'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except (Agent.DoesNotExist, AttributeError):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = DepositApprovalSerializer(data=request.data)
        
        if serializer.is_valid():
            notes = serializer.validated_data.get('notes', '')
            deposit.reject(request.user, notes)
            return Response({'message': 'አስገባቱ ውድቅ ተደርጓል'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WithdrawRequestViewSet(viewsets.ModelViewSet):
    serializer_class = WithdrawRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Admin/Staff can see all withdrawals
        if user.is_staff or user.is_superuser:
            return WithdrawRequest.objects.all().order_by('-created_at')
        
        # Check if user is an agent
        try:
            agent = Agent.objects.get(user=user)
            # Agent sees withdrawals for their payment accounts
            return WithdrawRequest.objects.filter(payment_account__agent=agent).order_by('-created_at')
        except Agent.DoesNotExist:
            # Regular user sees their own withdrawals
            return WithdrawRequest.objects.filter(user=user).order_by('-created_at')
    
    def get_permissions(self):
        # Allow both admin and agent to approve/reject
        if self.action in ['approve', 'reject']:
            return [IsAgentOrAdmin()]
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
        user = self.request.user
        amount = serializer.validated_data['amount']
        
        # Check wallet balance and deduct immediately
        wallet = Wallet.objects.get(user=user)
        if amount > wallet.balance:
            raise serializers.ValidationError({"error": "በቂ ሒሳብ የለዎትም"})
        
        # Deduct from wallet
        wallet.balance -= amount
        wallet.save()
        
        # Create transaction record
        Transaction.objects.create(
            user=user,
            amount=amount,
            transaction_type='withdraw_request',
            status='pending',
            description=f'Withdrawal request to {serializer.validated_data["account_number"]}'
        )
        
        serializer.save(user=user)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_requests(self, request):
        """Get current user's withdrawal requests"""
        withdraw_requests = WithdrawRequest.objects.filter(user=request.user).order_by('-created_at')
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            withdraw_requests = withdraw_requests.filter(status=status_filter)
        
        # Filter by date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                withdraw_requests = withdraw_requests.filter(created_at__date__gte=start, created_at__date__lte=end)
            except:
                pass
        
        # Apply pagination
        page = self.paginate_queryset(withdraw_requests)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(withdraw_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a withdraw request (admin or agent)"""
        withdraw_request = self.get_object()
        
        if withdraw_request.status != 'pending':
            return Response(
                {'error': 'ይህ ጥያቄ አስቀድሞ ተሰርቷል'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user has permission to approve this withdrawal
        # Admin can approve any withdrawal
        if request.user.is_staff or request.user.is_superuser:
            pass
        else:
            # Agent can only approve withdrawals for their payment accounts
            try:
                agent = Agent.objects.get(user=request.user)
                if withdraw_request.payment_account.agent != agent:
                    return Response(
                        {'error': 'You can only approve withdrawals for your payment accounts'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except (Agent.DoesNotExist, AttributeError):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = DepositApprovalSerializer(data=request.data)
        
        if serializer.is_valid():
            notes = serializer.validated_data.get('notes', '')
            withdraw_request.approve(request.user, notes)
            return Response({'message': 'የገንዘብ ማውጣት ጥያቄ ተፈቅዷል'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a withdraw request (admin or agent)"""
        withdraw_request = self.get_object()
        
        if withdraw_request.status != 'pending':
            return Response(
                {'error': 'ይህ ጥያቄ አስቀድሞ ተሰርቷል'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user has permission to reject this withdrawal
        # Admin can reject any withdrawal
        if request.user.is_staff or request.user.is_superuser:
            pass
        else:
            # Agent can only reject withdrawals for their payment accounts
            try:
                agent = Agent.objects.get(user=request.user)
                if withdraw_request.payment_account.agent != agent:
                    return Response(
                        {'error': 'You can only reject withdrawals for your payment accounts'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except (Agent.DoesNotExist, AttributeError):
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        serializer = DepositApprovalSerializer(data=request.data)
        
        if serializer.is_valid():
            notes = serializer.validated_data.get('notes', '')
            withdraw_request.reject(request.user, notes)
            return Response({'message': 'የገንዘብ ማውጣት ጥያቄ ውድቅ ተደርጓል'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['transaction_type', 'status']
    ordering_fields = ['created_at', 'amount']
    ordering = ['-created_at']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Transaction.objects.all()
        
        # Check if user is an agent
        try:
            agent = Agent.objects.get(user=self.request.user)
            # Return transactions for users who use this agent's payment accounts
            user_ids = Deposit.objects.filter(
                payment_account__agent=agent
            ).values_list('user_id', flat=True).distinct()
            
            withdraw_user_ids = WithdrawRequest.objects.filter(
                payment_account__agent=agent
            ).values_list('user_id', flat=True).distinct()
            
            all_user_ids = list(set(list(user_ids) + list(withdraw_user_ids)))
            return Transaction.objects.filter(user_id__in=all_user_ids)
        except Agent.DoesNotExist:
            # Return user's own transactions
            return Transaction.objects.filter(user=self.request.user)

class AgentPlayersView(APIView):
    """Get players for a specific agent"""
    permission_classes = [IsAgentOrAdmin]
    
    def get(self, request, agent_id=None):
        try:
            if agent_id:
                agent = Agent.objects.get(id=agent_id)
            else:
                # If no agent_id provided, get current user's agent profile
                agent = Agent.objects.get(user=request.user)
            
            # Get players for this agent (users with agent_id matching agent's username)
            players = User.objects.filter(agent_id=agent.user.username)
            
            players_data = []
            for player in players:
                # Get player's wallet balance
                wallet = Wallet.objects.filter(user=player).first()
                balance = wallet.balance if wallet else Decimal('0')
                
                # Get player's total deposits and withdrawals
                total_deposits = Deposit.objects.filter(
                    user=player,
                    payment_account__agent=agent
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                
                total_withdrawals = WithdrawRequest.objects.filter(
                    user=player,
                    payment_account__agent=agent
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                
                players_data.append({
                    'id': player.id,
                    'username': player.username,
                    'email': player.email,
                    'phone_number': getattr(player, 'phone_number', ''),
                    'balance': float(balance),
                    'total_deposits': float(total_deposits),
                    'total_withdrawals': float(total_withdrawals),
                    'net_balance': float(balance),
                    'is_active': player.is_active,
                    'date_joined': player.date_joined,
                    'last_login': player.last_login
                })
            
            return Response({
                'agent': {
                    'id': agent.id,
                    'username': agent.user.username,
                    'name': f"{agent.user.first_name or ''} {agent.user.last_name or ''}".strip()
                },
                'players': players_data,
                'total_players': len(players_data)
            })
            
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'},
                status=status.HTTP_404_NOT_FOUND
            )