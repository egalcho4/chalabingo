from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import *
import uuid
import random
class TelegramUserSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    agent_name = serializers.CharField(source='agent.user.username', read_only=True)
    
    class Meta:
        model = TelegramUser
        fields = [
            'id', 'telegram_id', 'first_name', 'last_name', 'username',
            'phone_number', 'agent', 'agent_name', 'referral_link',
            'is_active', 'created_at', 'user_username'
        ]

class AgentBotLinkSerializer(serializers.ModelSerializer):
    agent_username = serializers.CharField(source='agent.user.username', read_only=True)
    bot_link = serializers.SerializerMethodField()
    
    class Meta:
        model = AgentBotLink
        fields = [
            'id', 'agent', 'agent_username', 'bot_username',
            'referral_code', 'total_referrals', 'is_active',
            'created_at', 'bot_link'
        ]
    
    def get_bot_link(self, obj):
        return f"https://t.me/{obj.bot_username}?start={obj.referral_code}"

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ('username', 'password', 'password2', 'email', 'first_name', 'last_name','user_type','agent_id')
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "የይለፍ ቃል አይዛመድም"})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ('bio', 'phone', 'birth_date', 'profile_image', 
                 'address', 'city', 'country', 'created_at', 'updated_at')
        read_only_fields = ('created_at', 'updated_at')

class UserProfileSerializer(serializers.ModelSerializer):
    # Include profile information
    profile = ProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 
                 'is_staff', 'profile','user_type')
        read_only_fields = ('id', 'is_staff')

# Add these serializers to your serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import Agent, Profile
from decimal import Decimal

class AgentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    is_active_user = serializers.BooleanField(source='user.is_active', read_only=True)
    user_type = serializers.CharField(source='user.user_type', read_only=True)
    
    class Meta:
        model = Agent
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone_number', 'commission_rate', 'is_active', 
            'is_active_user', 'total_earnings', 'created_at', 'updated_at',
            'user_type'
        ]
        read_only_fields = ['total_earnings', 'created_at', 'updated_at', 'user_type']

class CreateAgentSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        style={'input_type': 'password'},
        min_length=6
    )
    password2 = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'}
    )
    first_name = serializers.CharField(max_length=30, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=30, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=True)
    commission_rate = serializers.CharField(required=False)  # Accept string first
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    user_type = serializers.CharField(required=False, default='agent')
    
    def validate_commission_rate(self, value):
        """Convert string to Decimal"""
        if not value:
            return Decimal('10.00')  # Default
        
        try:
            rate = Decimal(str(value))
            if rate < Decimal('0.00') or rate > Decimal('100.00'):
                raise serializers.ValidationError("Commission rate must be between 0 and 100.")
            return rate
        except (ValueError, InvalidOperation):
            raise serializers.ValidationError("Invalid commission rate format. Use numbers like '10.00'.")
    
    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username already exists.")
        return value
    
    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email already exists.")
        return value
    
    def validate(self, attrs):
        # Check passwords match
        password = attrs.get('password')
        password2 = attrs.get('password2')
        
        if password and password2 and password != password2:
            raise serializers.ValidationError({
                "password": "Passwords do not match.",
                "password2": "Passwords do not match."
            })
        
        return attrs
    def generate_numeric_uuid(self,length=8):
        """Generate a numeric-only UUID of specified length"""
        # Generate random digits
        numbers = [str(random.randint(0, 9)) for _ in range(length)]
        return ''.join(numbers)


    def create(self, validated_data):
        print("Creating agent with validated data:", validated_data)
        
        # Extract data
        username = validated_data['username']
        email = validated_data['email']
        password = validated_data['password']
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        phone_number = validated_data['phone_number']
        commission_rate = validated_data.get('commission_rate', Decimal('10.00'))
        address = validated_data.get('address', '')
        user_type = validated_data.get('user_type', 'agent')
        
        print(f"Creating user: {username}, email: {email}, user_type: {user_type}")
        
        try:
            # Create user with user_type
            # Usage in your code
            ag_id = self.generate_numeric_uuid() 

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                agent_id=ag_id,
                user_type=user_type  # This should be a field in your User model
            )
            print(f"User created successfully: {user.id}")
        except Exception as e:
            print(f"Error creating user: {str(e)}")
            raise serializers.ValidationError(f"Error creating user: {str(e)}")
        
        try:
            # Create agent
            agent = Agent.objects.create(
                user=user,
                phone_number=phone_number,
                commission_rate=commission_rate,
                is_active=True
            )
            print(f"Agent created successfully: {agent.id}")
        except Exception as e:
            print(f"Error creating agent: {str(e)}")
            # Clean up user if agent creation fails
            user.delete()
            raise serializers.ValidationError(f"Error creating agent: {str(e)}")
        
        # Update or create profile
        try:
            profile, created = Profile.objects.get_or_create(
                user=user,
                defaults={
                    'user_type': user_type,
                    'phone': phone_number,
                    'address': address
                }
            )
            if not created:
                profile.user_type = user_type
                profile.phone = phone_number
                profile.address = address
                profile.save()
            print(f"Profile updated: {profile.id}")
        except Exception as e:
            print(f"Warning: Could not update profile: {str(e)}")
            # Don't fail if profile update fails
        
        return agent

class AgentAnalyticsSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    phone_number = serializers.CharField()
    commission_rate = serializers.FloatField()
    total_deposits = serializers.FloatField()
    total_withdrawals = serializers.FloatField()
    total_transactions = serializers.IntegerField()
    agent_commission = serializers.FloatField()
    admin_earnings = serializers.FloatField()
    total_earnings = serializers.FloatField()

# users/serializers.py
from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    full_name = serializers.SerializerMethodField()
    user_type = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'user_type', 'is_active', 'date_joined',
            'last_login', 'is_staff', 'is_superuser'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']
    
    def get_full_name(self, obj):
        return f"{obj.first_name or ''} {obj.last_name or ''}".strip() or obj.username
    
    def get_user_type(self, obj):
        # Determine user type based on attributes
        if hasattr(obj, 'agent_profile') or hasattr(obj, 'agent'):
            return 'agent'
        elif obj.is_superuser:
            return 'superuser'
        elif obj.is_staff:
            return 'admin'
        else:
            return 'player'