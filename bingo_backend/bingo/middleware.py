# bingo/middleware.py
from django.db import connection
from django.utils import timezone
import time

class QueryOptimizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Start timer
        start_time = time.time()
        
        # Process request
        response = self.get_response(request)
        
        # Log slow queries
        if hasattr(connection, 'queries'):
            query_time = sum(float(q['time']) for q in connection.queries)
            if query_time > 0.5:  # Log queries slower than 500ms
                print(f"⚠️ SLOW QUERIES ({query_time:.3f}s) on {request.path}:")
                for q in connection.queries:
                    if float(q['time']) > 0.1:
                        print(f"  {q['time']}s: {q['sql'][:100]}...")
        
        # Add query count to response headers in debug mode
        if hasattr(connection, 'queries'):
            response['X-Query-Count'] = len(connection.queries)
            response['X-Query-Time'] = f"{(time.time() - start_time):.3f}s"
        
        return response