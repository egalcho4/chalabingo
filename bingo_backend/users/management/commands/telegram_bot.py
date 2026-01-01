# management/commands/setup_telegram_bot.py
from django.core.management.base import BaseCommand
from django.conf import settings
from users.models import TelegramBot, BotMessage
import requests
import json

class Command(BaseCommand):
    help = 'Setup Telegram bot webhook and default messages'
    
    def handle(self, *args, **options):
        self.stdout.write('Setting up Telegram bot...')
        
        bot_token = settings.TELEGRAM_BOT_TOKEN
        webhook_url = f"{settings.WEBHOOK_URL}/api/telegram/webhook/"
        
        # Set webhook
        url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
        payload = {
            'url': webhook_url
        }
        
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            self.stdout.write(self.style.SUCCESS('Webhook set successfully!'))
            
            # Get bot info
            bot_info_url = f"https://api.telegram.org/bot{bot_token}/getMe"
            bot_info = requests.get(bot_info_url).json()
            
            if bot_info['ok']:
                bot_username = bot_info['result']['username']
                
                # Create or update bot record
                bot, created = TelegramBot.objects.get_or_create(
                    name='Main Bot',
                    defaults={
                        'bot_token': bot_token,
                        'webhook_url': webhook_url,
                        'is_active': True
                    }
                )
                
                # Set default messages
                default_messages = [
                    {
                        'message_type': 'welcome',
                        'content': '👋 Welcome to our platform!\n\nPlease share your contact to register:',
                        'language': 'en'
                    },
                    {
                        'message_type': 'registered',
                        'content': '✅ Registration successful!\n\nYou can now login to our platform with:\n📱 Phone: {phone}\n🔑 Password: players@123',
                        'language': 'en'
                    },
                    {
                        'message_type': 'error',
                        'content': '❌ An error occurred. Please try again.',
                        'language': 'en'
                    },
                    {
                        'message_type': 'already_registered',
                        'content': '✅ You\'re already registered!',
                        'language': 'en'
                    }
                ]
                
                for msg in default_messages:
                    BotMessage.objects.update_or_create(
                        bot=bot,
                        message_type=msg['message_type'],
                        language=msg['language'],
                        defaults={'content': msg['content']}
                    )
                
                self.stdout.write(self.style.SUCCESS(f'Bot setup complete! Username: @{bot_username}'))
                
        else:
            self.stdout.write(self.style.ERROR(f'Failed to set webhook: {response.text}'))