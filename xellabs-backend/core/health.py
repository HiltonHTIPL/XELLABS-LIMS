"""
Health check and readiness endpoints for load balancers, Docker healthchecks, and monitoring.
"""
import logging
from django.db import connection, OperationalError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


def _db_ok():
    try:
        connection.ensure_connection()
        return True
    except OperationalError:
        return False


def _cache_ok():
    try:
        from django.core.cache import cache
        cache.set("_health_probe", "1", timeout=5)
        return cache.get("_health_probe") == "1"
    except Exception:
        return False


class HealthView(APIView):
    """
    GET /api/health/
    Returns 200 if the service is up (liveness probe).
    Returns 503 if a critical dependency (DB) is down.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db = _db_ok()
        cache = _cache_ok()
        healthy = db  # DB is the critical dependency; cache degradation is non-fatal

        data = {
            "status": "ok" if healthy else "degraded",
            "checks": {
                "database": "ok" if db else "error",
                "cache": "ok" if cache else "degraded",
            },
        }
        return Response(data, status=200 if healthy else 503)


class ReadinessView(APIView):
    """
    GET /api/health/ready/
    Kubernetes/Docker readiness probe — returns 200 only when all dependencies are healthy.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db = _db_ok()
        cache = _cache_ok()
        ready = db and cache

        data = {
            "ready": ready,
            "checks": {
                "database": "ok" if db else "error",
                "cache": "ok" if cache else "error",
            },
        }
        return Response(data, status=200 if ready else 503)
