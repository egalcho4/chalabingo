# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.core.cache import cache
from asgiref.sync import sync_to_async, async_to_sync
import asyncio
from .models import TelegramUser, TelegramBot, AgentBotLink, Agent, Profile
from .serializers import TelegramUserSerializer, AgentBotLinkSerializer
import requests
import json
import secrets
import uuid
from django.conf import settings

class TelegramBotWebhookView(APIView):
    """Handle Telegram bot webhook"""
    authentication_classes = []
    permission_classes = []
    
    def post(self, request):
        update = request.data
        
        # Process the update asynchronously
        try:
            # Use async_to_sync to run async function in sync context
            async_to_sync(self.process_update_async)(update)
            return Response({'status': 'ok'})
        except Exception as e:
            print(f"Error processing update: {str(e)}")
            return Response({'status': 'error', 'message': str(e)}, status=400)
    
    async def process_update_async(self, update):
        """Async version of process_update"""
        if 'message' in update:
            message = update['message']
            chat_id = message['chat']['id']
            
            # Check if this is a start command with referral code
            if 'text' in message and message['text'].startswith('/start'):
                command_parts = message['text'].split()
                referral_code = command_parts[1] if len(command_parts) > 1 else None
                
                # Check if user is already registered using sync_to_async
                telegram_user = await sync_to_async(
                    TelegramUser.objects.filter(telegram_id=chat_id).first,
                    thread_sensitive=True
                )()
                
                if telegram_user:
                    # User already registered - send PLAY GAME button
                    user_data = await self.prepare_login_data(telegram_user.user)
                    await self.send_play_game_button_async(chat_id, user_data)
                else:
                    # User not registered - show SHARE CONTACT button
                    if referral_code:
                        await self.handle_referral_start_async(chat_id, message, referral_code)
                    else:
                        await self.handle_start_async(chat_id, message)
            
            elif 'contact' in message:
                # User shared contact
                await self.handle_contact_share_async(chat_id, message)
        
        elif 'callback_query' in update:
            callback_query = update['callback_query']
            await self.handle_callback_query_async(callback_query)
    
    async def handle_start_async(self, chat_id, message):
        """Handle /start command for new users"""
        # Send welcome message with contact share button
        welcome_text = "👋 እንኳን ወደ ቢንጎ ጨዋታ በደህና መጡ!\n\nለምዝገባ እባክዎ የእርስዎን ስልክ ቁጥር ያጋሩ።"
        
        keyboard = {
            "keyboard": [[{
                "text": "📱 ስልክ ቁጥር አጋር",
                "request_contact": True
            }]],
            "resize_keyboard": True,
            "one_time_keyboard": True
        }
        
        await self.send_message_async(chat_id, welcome_text, keyboard)
    
    async def handle_referral_start_async(self, chat_id, message, referral_code):
        """Handle /start command with referral code for new users"""
        try:
            # Find agent by referral code using sync_to_async
            agent_link = await sync_to_async(
                AgentBotLink.objects.get,
                thread_sensitive=True
            )(referral_code=referral_code, is_active=True)
            
            welcome_text = f"👋 ሰላም! በአጋር {agent_link.agent.user.username} ተመዝግበዋል።\n\nለምዝገባ እባክዎ የእርስዎን ስልክ ቁጥር ያጋሩ።"
            
            keyboard = {
                "keyboard": [[{
                    "text": "📱 ስልክ ቁጥር አጋር",
                    "request_contact": True
                }]],
                "resize_keyboard": True,
                "one_time_keyboard": True
            }
            
            # Store agent info in session data (we'll use a simple cache)
            cache_key = f"telegram_session_{chat_id}"
            cache.set(cache_key, {
                'referral_code': referral_code,
                'agent_id': agent_link.agent.id,
                'agent_phone': agent_link.agent.phone_number,
                'agent_name': agent_link.agent.user.username
            }, timeout=300)
            
            await self.send_message_async(chat_id, welcome_text, keyboard)
                
        except AgentBotLink.DoesNotExist:
            # Invalid referral code, show regular start
            await self.handle_start_async(chat_id, message)
    
    async def handle_contact_share_async(self, chat_id, message):
        """Handle contact sharing"""
        contact = message['contact']
        telegram_id = contact.get('user_id')
        phone_number = contact.get('phone_number')
        first_name = contact.get('first_name', '')
        last_name = contact.get('last_name', '')
        telegram_username = message['chat'].get('username', '')
        
        # Check if user already exists using sync_to_async
        telegram_user = await sync_to_async(
            TelegramUser.objects.filter(telegram_id=telegram_id).first,
            thread_sensitive=True
        )()
        
        if telegram_user:
            # User already registered - send PLAY GAME button
            user_data = await self.prepare_login_data(telegram_user.user)
            await self.send_play_game_button_async(chat_id, user_data)
            return
        
        # Get referral data from cache
        cache_key = f"telegram_session_{chat_id}"
        session_data = cache.get(cache_key, {})
        referral_code = session_data.get('referral_code')
        agent_id = session_data.get('agent_id')
        agent_phone = session_data.get('agent_phone')
        
        # Register new user
        try:
            telegram_user = await self.register_telegram_user_async(
                telegram_id=telegram_id,
                phone_number=phone_number,
                first_name=first_name,
                last_name=last_name,
                username=telegram_username,
                referral_code=referral_code,
                agent_id=agent_id,
                agent_phone=agent_phone
            )
            
            # Clear session data
            cache.delete(cache_key)
            
            # Send PLAY GAME button
            user_data = await self.prepare_login_data(telegram_user.user)
            await self.send_play_game_button_async(chat_id, user_data)
            
        except Exception as e:
            print(f"Error registering user: {str(e)}")
            error_text = "❌ ምዝገባ አልተሳካም። እባክዎ ቆይተው ይሞክሩ።"
            await self.send_message_async(chat_id, error_text)
    
    async def register_telegram_user_async(self, telegram_id, phone_number, first_name, last_name, username, referral_code=None, agent_id=None, agent_phone=None):
        """Async version of register_telegram_user"""
        try:
            # Use a thread to run the synchronous registration
            return await asyncio.to_thread(
                self.register_telegram_user_sync,
                telegram_id, phone_number, first_name, last_name, 
                username, referral_code, agent_id, agent_phone
            )
        except Exception as e:
            print(f"Error in async registration: {str(e)}")
            raise
    
    def register_telegram_user_sync(self, telegram_id, phone_number, first_name, last_name, username, referral_code=None, agent_id=None, agent_phone=None):
        """Synchronous version of register_telegram_user"""
        try:
            from users.serializers import RegisterSerializer
            
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
                    phone_number=phone_number
                )
                
                # Link to agent if referral exists
                if referral_code and agent_id:
                    try:
                        agent = Agent.objects.get(id=agent_id)
                        telegram_user.agent = agent
                        telegram_user.agent_referral_code = referral_code
                        telegram_user.save()
                        
                        # Update user's agent fields
                        existing_user.agent_id = agent_phone
                        existing_user.save()
                        
                        # Update agent referral count
                        agent_link = AgentBotLink.objects.get(referral_code=referral_code)
                        agent_link.total_referrals += 1
                        agent_link.save()
                        
                        print(f"✅ Linked existing user to agent: {agent.user.username}")
                    except (Agent.DoesNotExist, AgentBotLink.DoesNotExist) as e:
                        print(f"⚠️ Could not link to agent: {str(e)}")
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
                    error_msg = "\n".join([f"{k}: {v[0]}" for k, v in serializer.errors.items()])
                    raise ValueError(f"Validation failed:\n{error_msg}")
                
                user = serializer.save()
                
                # Create telegram profile
                telegram_user = TelegramUser.objects.create(
                    user=user,
                    telegram_id=telegram_id,
                    first_name=first_name,
                    last_name=last_name,
                    username=username,
                    phone_number=phone_number,
                    agent_referral_code=referral_code,
                )
                
                # Link to agent if referral exists
                if referral_code and agent_id:
                    try:
                        agent = Agent.objects.get(id=agent_id)
                        telegram_user.agent = agent
                        telegram_user.save()
                        
                        # Update agent referral count
                        agent_link = AgentBotLink.objects.get(referral_code=referral_code)
                        agent_link.total_referrals += 1
                        agent_link.save()
                        
                        print(f"✅ Created new user and linked to agent: {agent.user.username}")
                    except (Agent.DoesNotExist, AgentBotLink.DoesNotExist) as e:
                        print(f"⚠️ Could not link to agent: {str(e)}")
            
            # Generate referral link
            unique_id = uuid.uuid4().hex[:8]
            bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', 'your_bot')
            telegram_user.referral_link = f"https://t.me/{bot_username}?start={unique_id}"
            telegram_user.save()
            
            print(f"✅ Registered Telegram user: {telegram_user.first_name} ({phone_number})")
            return telegram_user
            
        except Exception as e:
            print(f"❌ Error registering telegram user: {str(e)}")
            raise
    
    async def prepare_login_data(self, user):
        """Generate secure auto-login token"""
        login_token = secrets.token_urlsafe(32)
        
        # Store token with user credentials in cache (expires in 10 minutes)
        cache_key = f'telegram_auto_login_{login_token}'
        cache.set(cache_key, {
            'user_id': user.id,
            'username': user.username,
            'password': 'players@123'
        }, timeout=600)
        
        # Create auto-login URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://bingo.fanoshomecaretreatment.com')
        auto_login_url = f"{frontend_url}/auto-login?token={login_token}"
        
        return {
            'username': user.username,
            'password': 'players@123',
            'url': auto_login_url,
            'token': login_token
        }
    
    async def send_play_game_button_async(self, chat_id, user_data):
        """Send message with play game button"""
        message_text = (
            "✅ **ምዝገባዎ ተሳክቷል!** 🎉\n\n"
            "አሁን ጨዋታውን ለመጫወት ከዚህ በታች ያለውን አገናኝ ይጫኑ።\n"
            "ወደ ጨዋታው በራስ-ሰር ይገባሉ! 🎮\n\n"
            f"**የተጠቃሚ ስም:** `{user_data['username']}`\n"
            f"**የይለፍ ቃል:** `{user_data['password']}`"
        )
        
        # Create inline keyboard markup
        keyboard = {
            "inline_keyboard": [[
                {
                    "text": "🎮 አሁን ጨዋታ ይጫወቱ",
                    "url": user_data['url']
                }
            ]]
        }
        
        await self.send_message_async(chat_id, message_text, keyboard)
    
    async def send_message_async(self, chat_id, text, reply_markup=None):
        """Send message through Telegram bot"""
        bot_token = settings.TELEGRAM_BOT_TOKEN
        if not bot_token:
            print("❌ TELEGRAM_BOT_TOKEN not set in settings.py")
            return None
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        
        payload = {
            'chat_id': chat_id,
            'text': text,
            'parse_mode': 'Markdown'
        }
        
        if reply_markup:
            payload['reply_markup'] = json.dumps(reply_markup)
        
        try:
            # Use aiohttp or httpx for async requests in production
            # For now, use sync requests but run in thread
            response = await asyncio.to_thread(
                requests.post, url, json=payload
            )
            return response.json()
        except Exception as e:
            print(f"❌ Error sending message: {str(e)}")
            return None
    
    async def handle_callback_query_async(self, callback_query):
        """Handle callback queries"""
        # Implement if needed
        pass

# Synchronous views (remain unchanged)
class TelegramAutoLoginAPIView(APIView):
    """API to handle Telegram auto-login tokens"""
    authentication_classes = []
    permission_classes = []
    
    def get(self, request):
        token = request.GET.get('token')
        
        if not token:
            return Response({
                'success': False,
                'error': 'Token is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        cache_key = f'telegram_auto_login_{token}'
        login_data = cache.get(cache_key)
        
        if not login_data:
            return Response({
                'success': False,
                'error': 'Invalid or expired token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get user
            from django.contrib.auth import authenticate
            user = authenticate(
                username=login_data['username'],
                password=login_data['password']
            )
            
            if user is None:
                return Response({
                    'success': False,
                    'error': 'Authentication failed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Generate token (if using DRF token auth)
            from rest_framework.authtoken.models import Token
            token_obj, created = Token.objects.get_or_create(user=user)
            
            # Clear the one-time token
            cache.delete(cache_key)
            
            # Return login credentials
            return Response({
                'success': True,
                'message': 'Auto-login successful',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'user_type': user.user_type,
                    'agent_id': user.agent_id,
                    'agent_phone': user.agent_phone,
                },
                'token': token_obj.key,
                'redirect_url': '/game/'  # Frontend should redirect here
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AgentBotLinkView(APIView):
    """Create bot link for agent"""
    permission_classes = [IsAdminUser]
    
    def post(self, request, agent_id):
        try:
            agent = Agent.objects.get(id=agent_id)
            
            # Check if bot link already exists
            bot_link, created = AgentBotLink.objects.get_or_create(
                agent=agent,
                defaults={
                    'bot_username': settings.TELEGRAM_BOT_USERNAME,
                    'referral_code': self.generate_referral_code(agent),
                    'is_active': True
                }
            )
            
            if not created:
                # Reactivate if inactive
                bot_link.is_active = True
                bot_link.save()
            
            serializer = AgentBotLinkSerializer(bot_link)
            return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Agent.DoesNotExist:
            return Response({'error': 'Agent not found'}, status=status.HTTP_404_NOT_FOUND)
    
    def generate_referral_code(self, agent):
        """Generate unique referral code"""
        import uuid
        return f"AG{agent.id}{uuid.uuid4().hex[:6].upper()}"

class GetAgentBotLinkView(APIView):
    """Get agent's bot link"""
    permission_classes = [IsAdminUser]
    
    def get(self, request, agent_id):
        try:
            bot_link = AgentBotLink.objects.get(agent_id=agent_id)
            bot_url = f"https://t.me/{bot_link.bot_username}?start={bot_link.referral_code}"
            
            return Response({
                'agent_id': agent_id,
                'agent_name': bot_link.agent.user.username,
                'bot_username': bot_link.bot_username,
                'referral_code': bot_link.referral_code,
                'bot_link': bot_url,
                'total_referrals': bot_link.total_referrals,
                'is_active': bot_link.is_active
            })
        except AgentBotLink.DoesNotExist:
            return Response({'error': 'Bot link not found for this agent'}, status=status.HTTP_404_NOT_FOUND)

class TelegramUsersView(APIView):
    """Get all telegram users"""
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        users = TelegramUser.objects.all().select_related('user', 'agent__user')
        serializer = TelegramUserSerializer(users, many=True)
        return Response(serializer.data)

class GenerateAgentBotLinkView(APIView):
    """Generate Telegram bot link for agent (updated)"""
    permission_classes = [IsAdminUser]
    
    def post(self, request, agent_id):
        try:
            agent = Agent.objects.get(id=agent_id)
            
            # Generate unique referral code
            referral_code = f"AGENT{agent.id}{uuid.uuid4().hex[:6].upper()}"
            
            # Create or update bot link
            bot_link, created = AgentBotLink.objects.update_or_create(
                agent=agent,
                defaults={
                    'referral_code': referral_code,
                    'bot_username': settings.TELEGRAM_BOT_USERNAME,
                    'is_active': True
                }
            )
            
            bot_url = f"https://t.me/{bot_link.bot_username}?start={referral_code}"
            
            return Response({
                'success': True,
                'agent': {
                    'id': agent.id,
                    'name': agent.user.username,
                    'phone': agent.phone_number
                },
                'bot_link': {
                    'id': bot_link.id,
                    'referral_code': bot_link.referral_code,
                    'url': bot_url,
                    'total_referrals': bot_link.total_referrals,
                    'is_active': bot_link.is_active,
                    'created_at': bot_link.created_at
                }
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Agent.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Agent not found'
            }, status=status.HTTP_404_NOT_FOUND)

class GetAgentReferralsView(APIView):
    """Get all referrals for an agent"""
    permission_classes = [IsAdminUser]
    
    def get(self, request, agent_id):
        try:
            agent = Agent.objects.get(id=agent_id)
            telegram_users = TelegramUser.objects.filter(agent=agent).select_related('user')
            
            referrals = []
            for user in telegram_users:
                referrals.append({
                    'id': user.id,
                    'telegram_id': user.telegram_id,
                    'phone_number': user.phone_number,
                    'name': f"{user.first_name} {user.last_name or ''}",
                    'username': user.username,
                    'registered_at': user.created_at,
                    'user_id': user.user.id,
                    'user_username': user.user.username,
                    'agent_id': user.user.agent_id,
                    'agent_phone': user.user.agent_phone
                })
            
            return Response({
                'success': True,
                'agent': {
                    'id': agent.id,
                    'name': agent.user.username,
                    'phone': agent.phone_number,
                    'total_referrals': len(referrals)
                },
                'referrals': referrals
            })
            
        except Agent.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Agent not found'
            }, status=status.HTTP_404_NOT_FOUND)