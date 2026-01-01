from rest_framework import serializers
from .models import (
    PaymentAccount, Wallet, Deposit, 
    WithdrawRequest, Transaction
)
from django.core.validators import MinValueValidator

from users.models import *
class PaymentAccountSerializer(serializers.ModelSerializer):
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    agent_info = serializers.SerializerMethodField(read_only=True)
    availability = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PaymentAccount
        fields = [
            'id', 'agent', 'agent_info', 'payment_method', 'payment_method_display',
            'account_name', 'account_number', 'phone_number', 'bank_name', 'qr_code',
            'min_amount', 'max_amount', 'instructions', 'is_active', 'created_at',
            'updated_at', 'availability'
        ]
        read_only_fields = ['created_at', 'updated_at', 'availability']
    
    def get_agent_info(self, obj):
        """Get agent information"""
        if obj.agent and hasattr(obj.agent, 'user'):
            return {
                'id': obj.agent.id,
                'name': obj.agent.user.get_full_name() or obj.agent.user.username,
                'username': obj.agent.user.username,
                'is_super_admin': False
            }
        return {
            'id': None,
            'name': 'Super Admin',
            'username': None,
            'is_super_admin': True
        }
    
    def get_availability(self, obj):
        """Get availability based on current request context"""
        request = self.context.get('request')
        if not request:
            return {'deposit': False, 'withdraw': False}
        
        operation = request.query_params.get('operation')
        user = request.user
        
        result = {
            'deposit': obj.is_active and obj.min_amount > 0,
            'withdraw': obj.is_active
        }
        
        # For withdraw, do additional checks
        if operation == 'withdraw' and user.is_authenticated:
            # Check mobile money accounts have phone number
            if obj.payment_method in ['telebirr', 'cbe_birr']:
                result['withdraw'] = result['withdraw'] and bool(obj.phone_number)
            
            # Check user's balance (optional)
            try:
                from wallet.models import Wallet
                wallet = Wallet.objects.get(user=user)
                result['withdraw'] = result['withdraw'] and obj.min_amount <= wallet.balance
            except:
                pass
        
        return result

class WalletSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Wallet
        fields = ['id', 'user', 'balance', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']

# serializers.py - Update DepositSerializer

# serializers.py - Make sure your DepositSerializer has these fields

class DepositSerializer(serializers.ModelSerializer):
    payment_account_detail = PaymentAccountSerializer(source='payment_account', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Deposit
        fields = [
            'id', 'user', 'amount', 'payment_account', 'payment_account_detail',
            'account_name', 'account_number', 'phone_number', 'proof_image',
            'status', 'status_display', 'admin_notes', 'created_at'
        ]
        read_only_fields = ['user', 'status', 'admin_notes', 'created_at']
    
    def validate(self, data):
        payment_account = data.get('payment_account')
        amount = data.get('amount')
        
        if not payment_account:
            raise serializers.ValidationError({"payment_account": "የክፍያ አካውንት ይምረጡ"})
        
        if not amount:
            raise serializers.ValidationError({"amount": "መጠን ያስገቡ"})
        
        # Check if account is active
        if not payment_account.is_active:
            raise serializers.ValidationError({"payment_account": "ይህ የክፍያ አካውንት በአሁኑ ጊዜ አይሰራም"})
        
        # Check amount limits
        if amount < payment_account.min_amount:
            raise serializers.ValidationError({
                "amount": f"ዝቅተኛ መጠን: {payment_account.min_amount} ብር"
            })
        
        if amount > payment_account.max_amount:
            raise serializers.ValidationError({
                "amount": f"ከፍተኛ መጠን: {payment_account.max_amount} ብር"
            })
        
        return data

class DepositApprovalSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500)

class WithdrawRequestSerializer(serializers.ModelSerializer):
    payment_account_detail = PaymentAccountSerializer(source='payment_account', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = WithdrawRequest
        fields = [
            'id', 'user', 'amount', 'payment_account', 'payment_account_detail',
            'account_name', 'account_number', 'phone_number', 'status',
            'status_display', 'admin_notes', 'created_at'
        ]
        read_only_fields = ['user', 'status', 'admin_notes', 'created_at']
    
    def validate(self, data):
        request = self.context.get('request')
        payment_account = data.get('payment_account')
        amount = data.get('amount')
        account_number = data.get('account_number')
        
        if not payment_account:
            raise serializers.ValidationError({"payment_account": "የክፍያ አካውንት ይምረጡ"})
        
        # Check if account is active
        if not payment_account.is_active:
            raise serializers.ValidationError({"payment_account": "ይህ የክፍያ አካውንት በአሁኑ ጊዜ አይሰራም"})
        
        # Check wallet balance
        if request and request.user:
            wallet = request.user.wallet
            if amount > wallet.balance:
                raise serializers.ValidationError({"amount": "በቂ ሒሳብ የለዎትም"})
        
        # Check amount limits
        if amount < payment_account.min_amount:
            raise serializers.ValidationError({
                "amount": f"ዝቅተኛ መጠን: {payment_account.min_amount} ብር"
            })
        
        if amount > payment_account.max_amount:
            raise serializers.ValidationError({
                "amount": f"ከፍተኛ መጠን: {payment_account.max_amount} ብር"
            })
        
        # Validate account number
        if not account_number:
            raise serializers.ValidationError({
                "account_number": "አካውንት ቁጥር ያስገቡ"
            })
        
        # Validate phone number for mobile money
        if payment_account.payment_method in ['telebirr', 'cbe_birr']:
            phone_number = data.get('phone_number')
            if not phone_number:
                raise serializers.ValidationError({
                    "phone_number": f"ለ{payment_account.get_payment_method_display()} ስልክ ቁጥር ያስገቡ"
                })
        
        return data

class TransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'user', 'amount', 'transaction_type', 'type_display',
            'status', 'status_display', 'description', 'reference_id',
            'created_at'
        ]
        read_only_fields = ['user', 'created_at']