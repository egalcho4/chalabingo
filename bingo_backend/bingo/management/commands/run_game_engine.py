# bingo/management/commands/run_game.py - FIXED VERSION
import time
import os
import sys
import signal
import threading
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.db import connection
from django.db import close_old_connections
from bingo.game_engine import BingoGameEngine

# Disable verbose logging
import logging
logging.getLogger('django.db.backends').setLevel(logging.ERROR)

class ResourceMonitor:
    """Lightweight resource monitoring"""
    @staticmethod
    def is_cpu_overloaded(threshold=80):
        """Check if CPU usage is too high"""
        try:
            if os.name == 'posix':  # Linux/Unix
                with open('/proc/loadavg', 'r') as f:
                    load = f.read().split()[0]
                    # Simple load check (1min average)
                    cpu_count = os.cpu_count() or 1
                    return float(load) > threshold/100 * cpu_count
        except:
            pass
        return False
    
    @staticmethod
    def get_memory_usage():
        """Get memory usage percentage"""
        try:
            if os.name == 'posix':
                with open('/proc/meminfo', 'r') as f:
                    lines = f.readlines()
                    meminfo = {}
                    for line in lines[:3]:  # Only read first 3 lines for speed
                        parts = line.split()
                        if len(parts) >= 2:
                            meminfo[parts[0].rstrip(':')] = int(parts[1])
                    
                    if 'MemTotal' in meminfo and 'MemAvailable' in meminfo:
                        total = meminfo['MemTotal']
                        available = meminfo['MemAvailable']
                        used_percent = 100 - (available * 100 / total)
                        return used_percent
        except:
            pass
        return 0

class Command(BaseCommand):
    help = 'Run the bingo game engine (Fixed for cPanel)'
    
    def __init__(self):
        super().__init__()
        self.shutdown_flag = threading.Event()
        self.start_time = None
        self.max_runtime_hours = 13
        self.restart_file = '/tmp/bingo_engine_restart.flag'
        
    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=float,
            default=3.0,
            help='Tick interval in seconds'
        )
        parser.add_argument(
            '--memory-limit',
            type=int,
            default=85,
            help='Memory usage limit percentage before restart'
        )
        parser.add_argument(
            '--auto-restart',
            action='store_true',
            default=True,
            help='Auto-restart after 13 hours'
        )
        parser.add_argument(
            '--debug',
            action='store_true',
            default=False,
            help='Enable debug output'
        )
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.shutdown_flag.set()
    
    def should_restart(self):
        """Check if we should restart based on runtime or flags"""
        # Check runtime limit
        if self.start_time:
            try:
                runtime = datetime.now() - self.start_time
                if runtime >= timedelta(hours=self.max_runtime_hours):
                    self.stdout.write(self.style.WARNING(
                        f'⏰ Runtime limit reached ({self.max_runtime_hours}h), restarting...'
                    ))
                    return True
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Runtime check error: {e}'))
        
        # Check restart flag file
        try:
            if os.path.exists(self.restart_file):
                os.remove(self.restart_file)
                self.stdout.write(self.style.WARNING('🔄 Restart flag detected, restarting...'))
                return True
        except:
            pass
        
        # Check resource usage
        try:
            mem_usage = ResourceMonitor.get_memory_usage()
            if mem_usage > 85:  # Memory threshold
                self.stdout.write(self.style.WARNING(
                    f'💾 High memory usage ({mem_usage:.1f}%), restarting...'
                ))
                return True
        except:
            pass
        
        try:
            if ResourceMonitor.is_cpu_overloaded():
                self.stdout.write(self.style.WARNING('🔥 High CPU load, restarting...'))
                return True
        except:
            pass
        
        return False
    
    def setup_restart_signal(self):
        """Setup file-based restart signaling"""
        restart_script = '''#!/bin/bash
# Trigger bingo engine restart
touch /tmp/bingo_engine_restart.flag
echo "Restart signal sent at $(date)" >> /tmp/bingo_engine.log
'''
        try:
            script_path = os.path.expanduser('~/restart_bingo.sh')
            with open(script_path, 'w') as f:
                f.write(restart_script)
            os.chmod(script_path, 0o755)
            if self.debug:
                self.stdout.write(self.style.SUCCESS(f'📝 Restart script: {script_path}'))
        except:
            pass
    
    def handle(self, *args, **options):
        # Setup signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        self.interval = max(options['interval'], 2.0)
        self.memory_limit = options['memory_limit']
        self.auto_restart = options['auto_restart']
        self.debug = options['debug']
        
        # Setup restart mechanism
        self.setup_restart_signal()
        
        self.stdout.write(self.style.SUCCESS(
            f'🚀 Starting Bingo Engine v2.0\n'
            f'   Tick: {self.interval}s | Memory limit: {self.memory_limit}% | '
            f'Auto-restart: {self.max_runtime_hours}h'
        ))
        
        # Main restart loop
        while not self.shutdown_flag.is_set():
            try:
                self.run_engine_session()
                
                if self.auto_restart and not self.shutdown_flag.is_set():
                    self.stdout.write(self.style.WARNING('🔄 Restarting engine in 5 seconds...'))
                    for i in range(5, 0, -1):
                        if self.shutdown_flag.is_set():
                            break
                        self.stdout.write(f"   {i}...")
                        time.sleep(1)
                else:
                    break
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Session failed: {e}'))
                if not self.shutdown_flag.is_set():
                    time.sleep(10)
    
    def run_engine_session(self):
        """Run a single engine session"""
        self.start_time = datetime.now()
        engine = None
        tick_count = 0
        stats_interval = 20
        consecutive_errors = 0
        max_consecutive_errors = 10
        
        try:
            engine = BingoGameEngine()
            
            session_end_time = self.start_time + timedelta(hours=self.max_runtime_hours)
            self.stdout.write(self.style.SUCCESS(
                f'⏰ Session started, will run until: {session_end_time.strftime("%H:%M")}'
            ))
            
            while not self.shutdown_flag.is_set():
                try:
                    # Check if we should restart
                    if self.should_restart():
                        break
                    
                    # Close old database connections
                    close_old_connections()
                    
                    # Process game tick
                    engine.process_tick()
                    
                    consecutive_errors = 0
                    tick_count += 1
                    
                    # Print stats occasionally
                    if self.debug and tick_count % stats_interval == 0:
                        runtime = datetime.now() - self.start_time
                        self.stdout.write(self.style.SUCCESS(
                            f'📊 Tick: {tick_count} | Runtime: {str(runtime).split(".")[0]}'
                        ))
                        engine.print_stats()
                    
                    # Adaptive sleep
                    sleep_time = self.interval
                    time.sleep(sleep_time)
                    
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    consecutive_errors += 1
                    if self.debug:
                        self.stdout.write(self.style.ERROR(f'⚠️ Tick error: {e}'))
                    
                    if consecutive_errors >= max_consecutive_errors:
                        self.stdout.write(self.style.ERROR('🔴 Too many errors, restarting session...'))
                        break
                    
                    # Exponential backoff on errors
                    time.sleep(min(self.interval * (consecutive_errors * 0.5), 10))
                    
        except KeyboardInterrupt:
            raise
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Engine session error: {e}'))
        finally:
            # Cleanup
            if engine:
                try:
                    engine.cleanup()
                except:
                    pass
            
            session_end = datetime.now()
            try:
                runtime = session_end - self.start_time
                self.stdout.write(self.style.WARNING(
                    f'⏹️ Session ended after {str(runtime).split(".")[0]} | Total ticks: {tick_count}'
                ))
            except:
                self.stdout.write(self.style.WARNING('⏹️ Session ended'))