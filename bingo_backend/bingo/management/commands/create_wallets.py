# transactions/management/commands/create_wallets.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from transactions.models import Wallet

class Command(BaseCommand):
    help = 'Create wallets for all users who don\'t have one'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--balance',
            type=float,
            default=0.00,
            help='Initial balance for new wallets (default: 1000.00)'
        )
        parser.add_argument(
            '--admin-balance',
            type=float,
            default=10000.00,
            help='Initial balance for admin users (default: 10000.00)'
        )
    
    def handle(self, *args, **options):
        balance = options['balance']
        admin_balance = options['admin_balance']
        created_count = 0
        
        # Get all users without wallets
        users_without_wallets = User.objects.filter(wallet__isnull=True)
        
        self.stdout.write(f"Found {users_without_wallets.count()} users without wallets")
        
        for user in users_without_wallets:
            # Determine balance based on user status
            initial_balance = admin_balance if user.is_superuser or user.is_staff else balance
            
            # Create wallet
            Wallet.objects.create(
                user=user,
                balance=initial_balance
            )
            created_count += 1
            
            self.stdout.write(self.style.SUCCESS(
                f'✅ Created wallet for {user.username} with {initial_balance} ETB'
            ))
        
        self.stdout.write(self.style.SUCCESS(
            f'\n🎉 Created {created_count} wallets successfully!'
        ))