# geez_bingo_backend/celery.py
import os
from celery import Celery
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'bingo_backend.settings')

app = Celery('geez_bingo_backend')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Schedule periodic tasks
app.conf.beat_schedule = {
    'process-game-round-every-second': {
        'task': 'bingo.tasks.process_game_round',
        'schedule': 1.0,  # Every second
    },
    'update-player-counts-every-5-seconds': {
        'task': 'bingo.tasks.update_player_counts',
        'schedule': 5.0,  # Every 5 seconds
    },
}