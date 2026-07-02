import logging
from django.contrib.auth import get_user_model, authenticate
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.generics import ListAPIView, RetrieveUpdateAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend

from .models import Client, Tenant
from .serializers import ClientSerializer, UserSerializer, TenantSerializer, TenantLogoSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


class FlexibleTokenView(APIView):
    """
    POST /api/auth/login/  { username, password }
    Accepts username OR email in the 'username' field.
    Returns { token }.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()

        if not identifier or not password:
            return Response({'non_field_errors': ['Must include username and password.']}, status=400)

        # Resolve identifier to the exact stored username (case-insensitive for both email and username)
        username = identifier
        if '@' in identifier:
            # Email lookup
            try:
                user_obj = User.objects.get(email__iexact=identifier)
                username = user_obj.username
            except User.DoesNotExist:
                return Response({'non_field_errors': ['No account found with that email address.']}, status=400)
            except User.MultipleObjectsReturned:
                logger.error("Duplicate accounts share email '%s' (case-insensitive) — data integrity issue.", identifier)
                return Response({'non_field_errors': ['Multiple accounts found for that email. Contact support.']}, status=400)
        else:
            # Case-insensitive username lookup (e.g. "liji" → "LIJI")
            try:
                user_obj = User.objects.get(username__iexact=identifier)
                username = user_obj.username
            except User.DoesNotExist:
                pass
            except User.MultipleObjectsReturned:
                logger.error("Duplicate accounts share username '%s' (case-insensitive) — data integrity issue.", identifier)
                return Response({'non_field_errors': ['Multiple accounts found for that username. Contact support.']}, status=400)

        user = authenticate(request=request, username=username, password=password)
        if not user:
            return Response({'non_field_errors': ['Invalid credentials.']}, status=400)
        if not user.is_active:
            return Response({'non_field_errors': ['This account is disabled.']}, status=400)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key})


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
        from django.utils.text import slugify
        from django_tenants.utils import schema_context

        name = serializer.validated_data.get('name', '')
        client_id_val = serializer.validated_data.get('client_id', '')
        email = serializer.validated_data.get('email', '')

        # Derive a unique slug from client_id (preferred) or name
        raw = client_id_val or name
        slug = slugify(raw) or 'client'

        # Tenant and User live in the public schema — must switch context before creating them.
        # The request arrives scoped to a tenant schema (e.g. hl-01); without this wrapper
        # django-tenants raises "Can't create tenant outside the public schema."
        with schema_context('public'):
            tenant, _ = Tenant.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'schema_name': slug},
            )

            username = client_id_val or slug
            if not User.objects.filter(username=username).exists():
                from django.utils.crypto import get_random_string
                temp_password = get_random_string(20)
                User.objects.create_user(
                    username=username,
                    email=email,
                    password=temp_password,
                    role='client',
                    tenant=tenant,
                )
                # TODO: email temp_password (or a password-reset link) to the client contact.
                # Logged here only so the account isn't left completely inaccessible until
                # that email flow is built — do not log this in production once it exists.
                logger.info("Created client user '%s' with a temporary password.", username)

        serializer.save(tenant=tenant)


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
        from django.shortcuts import get_object_or_404
        return get_object_or_404(Tenant, pk=tenant_id)

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
