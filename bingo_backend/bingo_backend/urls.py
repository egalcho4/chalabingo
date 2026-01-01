# urls.py - UPDATED COMPLETE VERSION

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework import routers

from transactions import views
from users.views import RegisterView, UserProfileView

from bingo.views import *
from bingo import gamerun as game
router = routers.DefaultRouter()

# Register viewsets
router.register(r'payment-accounts', views.PaymentAccountViewSet, basename='payment-account')
router.register(r'wallet', views.WalletViewSet, basename='wallet')
router.register(r'deposits', views.DepositViewSet, basename='deposit')
router.register(r'withdraw-requests', views.WithdrawRequestViewSet, basename='withdraw-request')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')

router.register(r'rounds', GameRoundViewSet, basename='gameround')
router.register(r'cards', BingoCardViewSet, basename='bingocard')
#router.register(r'payment-accounts', views.PaymentAccountViewSet, basename='payment-account')



# API endpoints
api_urls = [
path('users/', views.UserListView.as_view(), name='user-list'),
    
    # Agent management - FIX THESE PATHS
  
    path('agent-dashboard/', views.AgentDashboardView.as_view(), name='agent-dashboard'),

path('agents/my-deposits/', views.AgentMyDepositsView.as_view(), name='agent-my-deposits'),
    path('agents/my-withdrawals/', views.AgentMyWithdrawalsView.as_view(), name='agent-my-withdrawals'),
path('game-engine/start/', game.start_game_engine, name='start_engine'),
    path('game-engine/stop/', game.stop_game_engine, name='stop_engine'),
    path('game-engine/status/', game.get_engine_status, name='engine_status'),
    path('game-engine/tick/', game.run_single_tick, name='run_tick'),
    path('register_payment/',views.register_account,name="register_account"),
    path('agent-dashboard/', views.AgentDashboardView.as_view(), name='agent-dashboard'),
    
    # Add other agent endpoints
    path('agent-my-deposits/', views.AgentMyDepositsView.as_view(), name='agent-my-deposits'),
    path('agent-my-withdrawals/', views.AgentMyWithdrawalsView.as_view(), name='agent-my-withdrawals'),
    # Authentication
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/profile/', UserProfileView.as_view(), name='user_profile'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
     path('admin/stats/', views.AdminStatsView.as_view(), name='admin-stats'),
    path('admin/quick-stats/', views.QuickStatsView.as_view(), name='quick-stats'),
    path('admin/transaction-analytics/', views.TransactionAnalyticsView.as_view(), name='transaction-analytics'),
    path('admin/user-analytics/', views.UserAnalyticsView.as_view(), name='user-analytics'),
     path('run-engine-command/', run_game_engine_command, name='run_engine_command'),

     #jfjf
     path('admin/stats/', views.AdminStatsView.as_view(), name='admin-stats'),
    path('admin/quick-stats/', views.QuickStatsView.as_view(), name='quick-stats'),
    path('admin/transaction-analytics/', views.TransactionAnalyticsView.as_view(), name='transaction-analytics'),
    path('admin/user-analytics/', views.UserAnalyticsView.as_view(), name='user-analytics'),
    path('admin/agent-analytics/', views.AgentAnalyticsView.as_view(), name='agent-analytics'),
    path('admin/recent-activity/', views.RecentActivityView.as_view(), name='recent-activity'),
    path('admin/dashboard-data/', views.DashboardDataView.as_view(), name='dashboard-data'),
    
    # For React Admin Component (compatible endpoints)
    path('admin/getStats/', views.AdminStatsView.as_view(), name='admin-get-stats'),
    path('admin/getRecentActivity/', views.RecentActivityView.as_view(), name='admin-get-recent-activity'),
    path('admin/getUsers/', views.UserAnalyticsView.as_view(), name='admin-get-users'),
    path('admin/getAgents/', views.AgentAnalyticsView.as_view(), name='admin-get-agents'),

     path('agents/', views.AgentListView.as_view(), name='agent-list'),
    path('agents/<int:pk>/', views.AgentDetailView.as_view(), name='agent-detail'),
    path('agents/analytics/', views.AgentAnalyticsView.as_view(), name='agent-analytics'),
    path('agents/dashboard/', views.AgentDashboardView.as_view(), name='agent-dashboard'),

    
   
         ]

# Combine all URLs
urlpatterns = [
path('api/status/', game_status, name='game-status'),
    path('api/poll/', poll_updates, name='poll-updates'),
    path('api/available-cards/', available_cards, name='available-cards'),
    path('api/player-count/', player_count, name='player-count'),
    path('api/lightweight-status/', lightweight_status, name='lightweight_status'),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),  # Router URLs (deposits, wallets, transactions, games)
   
    path('api/', include(api_urls)),      # Additional API endpoints
  
]

# Serve static and media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Optional: Add debug toolbar in development
if settings.DEBUG and 'debug_toolbar' in settings.INSTALLED_APPS:
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns