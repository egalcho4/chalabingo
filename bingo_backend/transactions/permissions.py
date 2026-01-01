# permissions.py
from rest_framework.permissions import BasePermission

class IsAgent(BasePermission):
    """Check if user is an agent"""
    def has_permission(self, request, view):
        return hasattr(request.user, 'agent_profile') and request.user.agent_profile.is_active

class IsAdminOrAgent(BasePermission):
    """Check if user is admin or agent"""
    def has_permission(self, request, view):
        if request.user.is_staff:
            return True
        return hasattr(request.user, 'agent_profile') and request.user.agent_profile.is_active