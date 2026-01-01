from django.db import models


from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
USER_TYPE_CHOICES = (
        ('admin', 'Admin'),
        ('agent', 'Agent'),
        ('player', 'Player'),
        ('viewer', 'Viewer'),
    )
user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default='player')
agent_id=models.CharField(max_length=100,null=True)
agent_id.contribute_to_class(User,"agent_id")
agent_phone = models.CharField(max_length=20, blank=True, null=True)
agent_phone.contribute_to_class(User,"agent_phone")
    
user_type.contribute_to_class(User,"user_type")


class Agent(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='transaction_agent_profile')
    phone_number = models.CharField(max_length=20)
    commission_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2,
        default=10.00,
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    address = models.CharField(max_length=255,blank=True)
    is_active = models.BooleanField(default=True)
    total_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Agent: {self.user.username}"
    
    class Meta:
        ordering = ['-created_at']
class Profile(models.Model):
    """Extended user profile model"""
    USER_TYPES = (
        ('admin', 'Admin'),
        ('agent', 'Agent'),
        ('player', 'Player'),
        ('viewer', 'Viewer'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    user_type = models.CharField(max_length=10, choices=USER_TYPES, default='player')
    agent=models.ForeignKey(Agent,on_delete=models.CASCADE,related_name="palyer_agent",null=True)
    # Additional fields you might want
    bio = models.TextField(max_length=500, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    profile_image = models.ImageField(upload_to='profile_images/', null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f'{self.user.username} Profile'

# Signal to create/update profile when User is created/updated
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()



class TelegramUser(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='telegram_profile')
    telegram_id = models.BigIntegerField(unique=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255, blank=True, null=True)
    username = models.CharField(max_length=255, blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    agent = models.ForeignKey(Agent, on_delete=models.SET_NULL, null=True, blank=True, related_name='referrals')
    referral_link = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    agent_referral_code=models.CharField(max_length=255,null=True)
    
    def __str__(self):
        return f"{self.first_name} (@{self.username})"
    
    def generate_referral_link(self):
        """Generate unique referral link for sharing"""
        unique_id = uuid.uuid4().hex[:8]
        self.referral_link = f"t.me/{self.username}_bot?start={unique_id}"
        return self.referral_link
    
    class Meta:
        ordering = ['-created_at']

class TelegramBot(models.Model):
    name = models.CharField(max_length=255)
    bot_token = models.CharField(max_length=255)
    webhook_url = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.name

class BotMessage(models.Model):
    bot = models.ForeignKey(TelegramBot, on_delete=models.CASCADE)
    message_type = models.CharField(max_length=50)  # welcome, registered, error, etc.
    content = models.TextField()
    language = models.CharField(max_length=10, default='en')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['bot', 'message_type', 'language']

class  AgentBotLink(models.Model):
    agent = models.OneToOneField(Agent, on_delete=models.CASCADE, related_name='bot_link')
    bot_username = models.CharField(max_length=255)
    referral_code = models.CharField(max_length=50, unique=True)
    total_referrals = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.agent.user.username}'s Bot Link"