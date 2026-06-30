import logging
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import ListAPIView, RetrieveUpdateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Client, Tenant
from .serializers import ClientSerializer, UserSerializer, TenantSerializer, TenantLogoSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


class UserMeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
        })


class ClientViewSet(ModelViewSet):
    """CRUD for Clients, scoped to the authenticated user's tenant."""
    serializer_class = ClientSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'tenant']
    search_fields = ['name', 'client_id', 'email', 'contact_person']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        user = self.request.user
        if user.tenant_id:
            return Client.objects.filter(tenant=user.tenant)
        return Client.objects.all()

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class TenantListView(ListAPIView):
    """Public list of tenants (slug + name only) — used by login page."""
    serializer_class = TenantSerializer
    authentication_classes = []
    permission_classes = []
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['slug', 'schema_name']
    queryset = Tenant.objects.filter(is_active=True).prefetch_related('domains')


class TenantUsersView(ListAPIView):
    """List all users belonging to a specific tenant."""
    serializer_class = UserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined']
    ordering = ['username']

    def get_queryset(self):
        tenant_id = self.kwargs['tenant_id']
        return User.objects.filter(tenant_id=tenant_id)


class TenantDetailView(RetrieveUpdateAPIView):
    """Retrieve or update a tenant (includes nested domains)."""
    serializer_class = TenantSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Tenant.objects.prefetch_related('domains').all()


class TenantLogoView(APIView):
    """Upload or delete the tenant logo."""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, tenant_id):
        return Tenant.objects.get(pk=tenant_id)

    def post(self, request, tenant_id):
        tenant = self.get_object(tenant_id)
        serializer = TenantLogoSerializer(tenant, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'logo': request.build_absolute_uri(tenant.logo.url) if tenant.logo else None})
        return Response(serializer.errors, status=400)

    def delete(self, request, tenant_id):
        tenant = self.get_object(tenant_id)
        if tenant.logo:
            tenant.logo.delete(save=True)
        return Response({'logo': None})
