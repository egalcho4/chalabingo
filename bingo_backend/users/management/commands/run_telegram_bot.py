# management/commands/run_telegram_bot.py
import os
import django
import asyncio
import secrets
import uuid
import signal
import sys
from datetime import datetime, timedelta
from asgiref.sync import sync_to_async
from django.core.cache import cache

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_project.settings')
django.setup()

from django.core.management.base import BaseCommand
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from django.conf import settings
from django.contrib.auth import get_user_model
from users.serializers import RegisterSerializer
from users.models import TelegramUser, AgentBotLink, Agent

User = get_user_model()

class Command(BaseCommand):
    help = 'Run Telegram bot with polling for registration and auto-login (3-hour runtime)'
    
    def __init__(self):
        super().__init__()
        self.shutdown_event = asyncio.Event()
        self.application = None
        self.start_time = None
        
    def handle(self, *args, **options):
        asyncio.run(self.main())
    
    async def main(self):
        """Main async function to run the bot for 3 hours"""
        self.stdout.write('Starting Telegram bot (will run for 3 hours)...')
        
        # Check if bot token is configured
        if not hasattr(settings, 'TELEGRAM_BOT_TOKEN') or not settings.TELEGRAM_BOT_TOKEN:
            self.stdout.write(self.style.ERROR('TELEGRAM_BOT_TOKEN not found in settings.py'))
            self.stdout.write('Please add: TELEGRAM_BOT_TOKEN = "your_bot_token_here"')
            return
        
        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, lambda s, f: asyncio.create_task(self.shutdown()))
        signal.signal(signal.SIGTERM, lambda s, f: asyncio.create_task(self.shutdown()))
        
        # Create application
        self.application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
        
        # Add handlers
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(MessageHandler(filters.CONTACT, self.contact_handler))
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.text_handler))
        
        # Start the bot
        await self.application.initialize()
        await self.application.start()
        
        self.start_time = datetime.now()
        self.stdout.write(f'✅ Bot started at {self.start_time}')
        self.stdout.write('✅ Bot is running. Will auto-stop after 12 hours...')
        
        # Start polling
        await self.application.updater.start_polling()
        
        # Set up timer for 3 hours
        shutdown_task = asyncio.create_task(self.schedule_shutdown(13 * 3600))  # 3 hours in seconds
        
        try:
            # Wait for shutdown signal or timeout
            await self.shutdown_event.wait()
        finally:
            # Cleanup
            await self.cleanup()
            
            # Calculate runtime
            end_time = datetime.now()
            runtime = end_time - self.start_time
            self.stdout.write(f'🛑 Bot stopped at {end_time}')
            self.stdout.write(f'⏱️ Total runtime: {runtime}')
    
    async def schedule_shutdown(self, seconds: int):
        """Schedule shutdown after specified seconds"""
        await asyncio.sleep(seconds)
        self.stdout.write('⏰ 3-hour runtime completed. Shutting down...')
        await self.shutdown()
    
    async def shutdown(self):
        """Graceful shutdown"""
        if not self.shutdown_event.is_set():
            self.shutdown_event.set()
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.application:
            if self.application.updater.running:
                await self.application.updater.stop()
            await self.application.stop()
            await self.application.shutdown()
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command with or without referral code"""
        chat_id = update.effective_chat.id
        
        # Check if user already exists using sync_to_async with select_related
        telegram_user = await sync_to_async(
            lambda: TelegramUser.objects.select_related('user').filter(telegram_id=chat_id).first()
        )()
        
        if telegram_user:
            # User already registered - send PLAY GAME button
            user_data = await self.prepare_login_data(telegram_user)
            await self.send_play_game_button(update, user_data)
            return
        
        # User not registered - handle new user flow
        if context.args:
            referral_code = context.args[0]
            context.user_data['referral_code'] = referral_code
            
            try:
                # Use sync_to_async for database query
                agent_link = await sync_to_async(
                    lambda: AgentBotLink.objects.select_related('agent__user').get(
                        referral_code=referral_code, 
                        is_active=True
                    )
                )()
                
                welcome_text = (
                    f"👋 ሰላም! በአጋር {agent_link.agent.user.username} ተመዝግበዋል።\n\n"
                    "ለምዝገባ እባክዎ የእርስዎን ስልክ ቁጥር ያጋሩ።\n\n"
                    "📱 'ስልክ ቁጥር አጋር' ን ይጫኑ።"
                )
                
                # Store agent info in context
                context.user_data['agent_id'] = agent_link.agent.id
                context.user_data['agent_phone'] = agent_link.agent.phone_number
                context.user_data['agent_username'] = agent_link.agent.user.username
                
            except AgentBotLink.DoesNotExist:
                welcome_text = (
                    "👋 እንኳን ወደ ቢንጎ ጨዋታ በደህና መጡ!\n\n"
                    "ለምዝገባ እባክዎ የእርስዎን ስልክ ቁጥር ያጋሩ።\n\n"
                    "📱 'ስልክ ቁጥር አጋር' ን ይጫኑ።"
                )
        else:
            welcome_text = (
                "👋 እንኳን ወደ ቢንጎ ጨዋታ በደህና መጡ!\n\n"
                "ለምዝገባ እባክዎ የእርስዎን ስልክ ቁጥር ያጋሩ።\n\n"
                "📱 'ስልክ ቁጥር አጋር' ን ይጫኑ።"
            )
        
        # Create contact share button
        contact_button = KeyboardButton("📱 ስልክ ቁጥር አጋር", request_contact=True)
        reply_markup = ReplyKeyboardMarkup([[contact_button]], resize_keyboard=True, one_time_keyboard=True)
        
        await update.message.reply_text(welcome_text, reply_markup=reply_markup)
    
    async def contact_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle contact sharing and registration"""
        contact = update.message.contact
        telegram_id = contact.user_id
        phone_number = contact.phone_number
        first_name = contact.first_name or ""
        last_name = contact.last_name or ""
        telegram_username = update.effective_user.username or ""
        
        # Check if user already exists using sync_to_async with select_related
        telegram_user = await sync_to_async(
            lambda: TelegramUser.objects.select_related('user').filter(telegram_id=telegram_id).first()
        )()
        
        if telegram_user:
            # User already registered, send auto-login button
            user_data = await self.prepare_login_data(telegram_user)
            await self.send_play_game_button(update, user_data)
            return
        
        # Get referral code and agent info from context
        referral_code = context.user_data.get('referral_code')
        agent_id = context.user_data.get('agent_id')
        agent_phone = context.user_data.get('agent_phone')
        agent_username = context.user_data.get('agent_username')
        
        # Register user
        try:
            telegram_user = await asyncio.to_thread(
                self.register_user_sync, 
                telegram_id, phone_number, first_name, last_name, 
                telegram_username, referral_code, agent_id, agent_phone
            )
            
            self.stdout.write(f"✅ User created: {telegram_user.user.username}")
            
            # Prepare and send login button
            user_data = await self.prepare_login_data(telegram_user)
            await self.send_play_game_button(update, user_data)
            
        except Exception as e:
            self.stdout.write(f"❌ Registration failed: {str(e)}")
            await update.message.reply_text("❌ ምዝገባ አልተሳካም። እባክዎ ቆይተው ይሞክሩ።")
    
    def register_user_sync(self, telegram_id, phone_number, first_name, last_name, username, referral_code=None, agent_id=None, agent_phone=None):
        """Synchronous helper to create user"""
        # Check if user already exists by phone
        existing_user = User.objects.filter(username=phone_number).first()
        
        if existing_user:
            # User exists, create telegram profile
            telegram_user = TelegramUser.objects.create(
                user=existing_user,
                telegram_id=telegram_id,
                first_name=first_name,
                last_name=last_name,
                username=username,
                phone_number=phone_number,
                agent_referral_code=referral_code
            )
            user = existing_user
        else:
            # Prepare registration data
            registration_data = {
                'username': phone_number,
                'password': 'players@123',
                'password2': 'players@123',
                'email': f"{phone_number}@telegram.user",
                'first_name': first_name,
                'last_name': last_name,
                'user_type': 'player',
                'agent_id': agent_phone if agent_phone else None,
                'agent_phone': agent_phone if agent_phone else None,
                'phone': phone_number,
            }
            
            # Create user using RegisterSerializer
            serializer = RegisterSerializer(data=registration_data)
            if not serializer.is_valid():
                error_details = "\n".join([f"{k}: {v}" for k, v in serializer.errors.items()])
                raise ValueError(f"Validation failed:\n{error_details}")
            
            user = serializer.save()
            
            # Create telegram profile
            telegram_user = TelegramUser.objects.create(
                user=user,
                telegram_id=telegram_id,
                first_name=first_name,
                last_name=last_name,
                username=username,
                phone_number=phone_number,
                agent_referral_code=referral_code
            )
        
       
      
        if referral_code :
            try:
                usert=User.objects.get(username=referral_code)
                agent = Agent.objects.get(user=usert)
                telegram_user.agent = agent
                telegram_user.save()
                users=User.objects.get(username=phone_number)
                users.agent_id=referral_code
                users.save()
                
                if AgentBotLink.DoesNotExist:
                    ag=AgentBotLink(referral_code=referral_code,agent=agent,bot_username="chalabingo_Bot")
                    ag.save()
            
                
                # Update agent referral count
                agent_link = AgentBotLink.objects.get(agent=agent)
                agent_link.total_referrals += 1
                agent_link.save()
                
                # Update user's agent_id field
                user.agent_id = agent_phone
                user.save()
                
                print(f"✅ User linked to agent: {agent.user.username}")
            except (Agent.DoesNotExist, AgentBotLink.DoesNotExist) as e:
                print(f"⚠️ Could not link to agent: {str(e)}")
        
        # Generate referral link
        unique_id = uuid.uuid4().hex[:8]
        bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', 'your_bot')
        telegram_user.referral_link = f"https://t.me/{bot_username}?start={unique_id}"
        telegram_user.save()
        
        return telegram_user
    
    async def prepare_login_data(self, telegram_user):
        """Generate JWT token and create login URL using simplejwt"""
        try:
            # Import JWT token classes
            from rest_framework_simplejwt.tokens import RefreshToken
            
            # Get user object with select_related
            user = await sync_to_async(
                lambda: User.objects.get(id=telegram_user.user_id)
            )()
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            # Create login URL
            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://bingo.fanoshomecaretreatment.com')
            
            # Method 1: Direct login URL with token as parameter
            login_url = f"{frontend_url}?token={access_token}"
            
            # Method 2: Alternative - using credentials in URL (less secure but works)
            # login_url = f"{frontend_url}/login?username={user.username}&password=players@123"
            
            return {
                'username': user.username,
                'password': 'players@123',
                'url': login_url,
                'token': access_token,
                'refresh_token': refresh_token,
                'user_id': user.id,
                'message': 'Ready to play! Click the button below to auto-login.'
            }
            
        except Exception as e:
            print(f"Error generating JWT: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Fallback - just send credentials without token
            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://bingo.fanoshomecaretreatment.com')
            return {
                'username': telegram_user.phone_number,
                'password': 'players@123',
                'url': frontend_url,
                'token': None,
                'message': 'Use manual login with the credentials below'
            }
    
    async def send_play_game_button(self, update, user_data):
        """Send message with play game button and login credentials"""
        
        # Prepare message text
        message_text = (
            "✅ **ምዝገባዎ ተሳክቷል!** 🎉\n\n"
            "አሁን ጨዋታውን ለመጫወት ከዚህ በታች ያለውን አገናኝ ይጫኑ።\n"
            "ወደ ጨዋታው በራስ-ሰር ይገባሉ! 🎮\n\n"
            "**የመግቢያ መረጃዎች:**\n"
            f"👤 **የተጠቃሚ ስም:** `{user_data['username']}`\n"
            f"🔑 **የይለፍ ቃል:** `{user_data['password']}`"

        )
        
        # Add token info if available
        if user_data.get('token'):
            message_text += "\n\n🔐 **ራስ-ሰር መግባት ተጠናቅቋል**"
            # Show first 10 chars of token for verification
            token_preview = user_data['token']#[:20] + "..."
            #message_text += f"\n**ቶከን:** ` http://localhost:5173/?token={token_preview}`"
        else:
            message_text += "\n\n⚠️ **አግድም:** መረጃዎችን በመጠቀም ይግቡ"
        
        # Create inline keyboard with game button
        keyboard = [[
            InlineKeyboardButton("🎮 አሁን ጨዋታ ይጫወቱ", url=user_data['url'])
        ]]
        
        # Add alternative login method if no token
        if not user_data.get('token'):
            keyboard.append([
                InlineKeyboardButton(
                    "🔗 ቀጥታ አገናኝ", 
                    url=f"{user_data['url']}/login"
                )
            ])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            message_text,
            parse_mode='Markdown',
            reply_markup=reply_markup,
            disable_web_page_preview=True
        )
    
    async def text_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle other text messages"""
        await update.message.reply_text(
            "እባክዎ ለምዝገባ 'ስልክ ቁጥር አጋር' የሚለውን ቁልፍ ይጠቀሙ።"
        )