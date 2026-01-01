# bingo/management/commands/monitor_game.py
import subprocess
import time
import signal
import sys
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Monitor and auto-restart game engine if it fails'
    
    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('🔍 Starting game engine monitor...'))
        
        max_restarts = 10
        restart_count = 0
        process = None
        
        while restart_count < max_restarts:
            try:
                self.stdout.write(self.style.SUCCESS(
                    f'🚀 Starting game engine (attempt {restart_count + 1}/{max_restarts})...'
                ))
                
                # Start the lightweight engine
                process = subprocess.Popen([
                    'python', 'manage.py', 'run_game_light',
                    '--min-interval', '3.0'
                ])
                
                # Wait for process to complete
                process.wait()
                return_code = process.returncode
                
                if return_code == 0:
                    self.stdout.write(self.style.SUCCESS('✅ Game engine stopped normally'))
                    break
                elif return_code == 130:  # SIGINT/Ctrl+C
                    self.stdout.write(self.style.WARNING('⚠️ Game engine interrupted'))
                    break
                else:
                    self.stdout.write(self.style.ERROR(
                        f'❌ Game engine crashed with code {return_code}'
                    ))
                    restart_count += 1
                    
                    # Exponential backoff
                    wait_time = min(60, 2 ** restart_count)
                    self.stdout.write(self.style.WARNING(
                        f'⏳ Waiting {wait_time}s before restart...'
                    ))
                    time.sleep(wait_time)
                    
            except KeyboardInterrupt:
                if process:
                    process.terminate()
                self.stdout.write(self.style.WARNING('🛑 Monitor stopped by user'))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Monitor error: {e}'))
                restart_count += 1
                time.sleep(10)
        
        if restart_count >= max_restarts:
            self.stdout.write(self.style.ERROR('❌ Maximum restarts reached'))