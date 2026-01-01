# models.py - Add Agent model and update PaymentAccount

from django.db import models
from django.contrib.auth.models import User
from bingo.models import GameRound
import uuid
from users.models import Agent

class PaymentMethod(models.TextChoices):
    TELEBIRR = 'telebirr', 'TeleBirr'
    CBE_BIRR = 'cbe_birr', 'CBE Birr'
    BANK_TRANSFER = 'bank', 'Bank Transfer'
    AWASH_BANK = 'awash', 'Awash Bank'
    DASHE_BANK = 'dashen', 'Dashen Bank'
    BOA_BANK = 'boa', 'Bank of Abyssinia'
    ABYSSINIA_BANK = 'abyssinia', 'Abyssinia Bank'
    HIBRET_BANK = 'hibret', 'Hibret Bank'

class PaymentAccount(models.Model):
    """Admin registered payment accounts"""
    agent = models.ForeignKey(Agent, on_delete=models.SET_NULL, null=True, blank=True, related_name='payment_accounts')
    payment_method = models.CharField(max_length=50, choices=PaymentMethod.choices)
    account_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    bank_name = models.CharField(max_length=255, blank=True, null=True)
    qr_code = models.ImageField(upload_to='payment_qr_codes/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    min_amount = models.DecimalField(max_digits=10, decimal_places=2, default=10.00)
    max_amount = models.DecimalField(max_digits=10, decimal_places=2, default=50000.00)
    instructions = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
  
    class Meta:
        ordering = ['payment_method', 'account_name']
        verbose_name = 'Payment Account'
        verbose_name_plural = 'Payment Accounts'
    
    def __str__(self):
        return f"{self.get_payment_method_display()} - {self.account_name}"
class Wallet(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_at = models.DateTimeField(auto_now=True,null=True)
    
    def deposit(self, amount):
        self.balance += amount
        self.save()
        Transaction.objects.create(
            user=self.user,
            transaction_type='deposit',
            amount=amount,
            status='completed',
            reference=f"DEP-{uuid.uuid4().hex[:8]}",
            description="deposit",
            
        )
        
        return True
    
    def withdraw(self, amount):
        if self.balance >= amount:
            self.balance -= amount
            self.save()
            Transaction.objects.create(
                user=self.user,
                transaction_type='withdrawal',
                amount=amount,
                status='completed',
                reference=f"WTH-{uuid.uuid4().hex[:8]}",
                description=description or "withdraw",
                game_round=game_round
            )
            return True
        return False
    
    def __str__(self):
        return f"{self.user.username}'s Wallet - {self.balance}"

class Deposit(models.Model):
    class DepositStatus(models.TextChoices):
        PENDING = 'pending', 'በመጠበቅ ላይ'
        APPROVED = 'approved', 'ተፈቅዷል'
        REJECTED = 'rejected', 'ውድቅ ተደርጓል'
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='deposits')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_account = models.ForeignKey(PaymentAccount, on_delete=models.SET_NULL, null=True, related_name='deposits')
    account_name = models.CharField(max_length=255, blank=True, null=True)
    account_number = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    proof_image = models.ImageField(upload_to='deposit_proofs/')
    status = models.CharField(max_length=20, choices=DepositStatus.choices, default='pending')
    admin_notes = models.TextField(blank=True,null=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_deposits')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'አስገባት'
        verbose_name_plural = 'አስገባቶች'
    
    def approve(self, admin_user, notes=''):
        self.status = self.DepositStatus.APPROVED
        self.processed_by = admin_user
        self.admin_notes = notes
        self.save()
        
        # Add to wallet
        wallet = self.user.wallet
        wallet.deposit(self.amount)
        
        # Create transaction
        Transaction.objects.create(
            user=self.user,
            amount=self.amount,
            transaction_type='deposit',
            status='completed',
            description=f'Deposit via {self.payment_account.get_payment_method_display() if self.payment_account else "Unknown"}'
        )
    
    def reject(self, admin_user, notes=''):
        self.status = self.DepositStatus.REJECTED
        self.processed_by = admin_user
        self.admin_notes = notes
        self.save()
    # In models.py, add to Deposit class
    @property
    def transaction_id(self):
        """Get related transaction reference if exists"""
        try:
            # Find related transaction
            transaction = self.user.transactions.filter(
                amount=self.amount,
                transaction_type='deposit',
                created_at__gte=self.created_at
            ).first()
            return transaction.reference if transaction else ''
        except:
            return ''
    
    @property
    def status_display(self):
        return self.get_status_display()
    
    def __str__(self):
        return f"{self.user.username} - {self.amount} ({self.status})"

class WithdrawRequest(models.Model):
    class WithdrawStatus(models.TextChoices):
        PENDING = 'pending', 'በመጠበቅ ላይ'
        APPROVED = 'approved', 'ተፈቅዷል'
        REJECTED = 'rejected', 'ውድቅ ተደርጓል'
        PROCESSED = 'processed', 'ተካሂዷል'
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='withdraw_requests')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_account = models.ForeignKey(PaymentAccount, on_delete=models.SET_NULL, null=True, related_name='withdrawals')
    account_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=WithdrawStatus.choices, default='pending')
    admin_notes = models.TextField(blank=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_withdrawals')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'የገንዘብ ማውጣት ጥያቄ'
        verbose_name_plural = 'የገንዘብ ማውጣት ጥያቄዎች'
    
    def approve(self, admin_user, notes=''):
        self.status = self.WithdrawStatus.APPROVED
        self.processed_by = admin_user
        self.admin_notes = notes
        self.save()
        
        # Create transaction
        Transaction.objects.create(
            user=self.user,
            amount=self.amount,
            transaction_type='withdraw',
            status='completed',
            description=f'Withdrawal via {self.payment_account.get_payment_method_display() if self.payment_account else "Unknown"}'
        )
    
    def reject(self, admin_user, notes=''):
        self.status = self.WithdrawStatus.REJECTED
        self.processed_by = admin_user
        self.admin_notes = notes
        self.save()
        
        # Refund wallet
        wallet = self.user.wallet
        wallet.deposit(self.amount)
        
        # Create refund transaction
        Transaction.objects.create(
            user=self.user,
            amount=self.amount,
            transaction_type='refund',
            status='completed',
            description=f'Withdrawal refund: {notes}'
        )
    
    @property
    def status_display(self):
        return self.get_status_display()
    
    def __str__(self):
        return f"{self.user.username} - {self.amount} ({self.status})"

class Transaction(models.Model):
    class TransactionType(models.TextChoices):
        DEPOSIT = 'deposit', 'አስገባት'
        WITHDRAW = 'withdraw', 'ውጣ'
        WITHDRAW_REQUEST = 'withdraw_request', 'የገንዘብ ማውጣት ጥያቄ'
        REFUND = 'refund', 'መመለስ'
        PRIZE_WIN = 'prize_win', 'ሽልማት'
        GAME_PLAY = 'game_play', 'ጨዋታ'
    
    class TransactionStatus(models.TextChoices):
        PENDING = 'pending', 'በመጠበቅ ላይ'
        COMPLETED = 'completed', 'ተጠናቅቋል'
        FAILED = 'failed', 'አልተሳካም'
        CANCELLED = 'cancelled', 'ተሰርዟል'
    game_round=models.ForeignKey(GameRound,on_delete=models.CASCADE,null=True,related_name="game_round")
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    status = models.CharField(max_length=20, choices=TransactionStatus.choices, default='pending')
    description = models.TextField(blank=True)
    reference_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reference=models.CharField(max_length=250,null=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'ግብይት'
        verbose_name_plural = 'ግብይቶች'
    
    @property
    def type_display(self):
        return self.get_transaction_type_display()
    
    @property
    def status_display(self):
        return self.get_status_display()
    
    def __str__(self):
        return f"{self.user.username} - {self.amount} ({self.transaction_type})"








