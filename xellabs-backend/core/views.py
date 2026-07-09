import json
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
from .permissions import IsLabManagerOrAbove, IsSuperAdmin
from .serializers import ClientSerializer, UserSerializer, StaffUserSerializer, TenantSerializer, TenantLogoSerializer

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
            'is_superuser': user.is_superuser,
        })


class UserViewSet(ModelViewSet):
    """CRUD for staff accounts (admin, lab_manager, analyst, reviewer, receptionist).
    Client accounts are managed exclusively via ClientViewSet — never through this endpoint."""
    serializer_class = StaffUserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsLabManagerOrAbove]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined']
    ordering = ['username']

    def get_queryset(self):
        from .serializers import STAFF_ROLES
        user = self.request.user
        qs = User.objects.filter(role__in=STAFF_ROLES)
        if user.tenant_id:
            qs = qs.filter(tenant=user.tenant)
        return qs

    def perform_create(self, serializer):
        from django.utils.crypto import get_random_string
        from rest_framework.exceptions import ValidationError as DRFValidationError

        username = serializer.validated_data.get('username', '').strip()
        if not username:
            raise DRFValidationError({'username': ['Username is required.']})
        if User.objects.filter(username__iexact=username).exists():
            raise DRFValidationError({'username': [f'A user with username "{username}" already exists.']})

        temp_password = get_random_string(20)
        user = serializer.save(tenant=self.request.user.tenant)
        user.set_password(temp_password)
        user.save(update_fields=['password'])
        logger.info("Created staff user '%s' with role '%s' by '%s'.", user.username, user.role, self.request.user.username)
        # Surfaced once in the create response, same one-time-reveal pattern as
        # ClientViewSet.perform_create — never logged, never returned again.
        self.request._created_staff_password = temp_password

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        password = getattr(request, '_created_staff_password', None)
        if password:
            response.data['login_password'] = password
        return response


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
        from rest_framework.exceptions import ValidationError as DRFValidationError

        # Normalise client_id to uppercase so "hl-01" and "HL-01" are the same
        client_id_val = serializer.validated_data.get('client_id', '').upper()

        # Check uniqueness before hitting the DB so we return a clean 400, not a 500
        if client_id_val and Client.objects.filter(client_id=client_id_val).exists():
            raise DRFValidationError({'client_id': [f'A client with ID "{client_id_val}" already exists.']})

        # A client is a customer record of the current lab — it belongs to the
        # logged-in user's tenant. No login account is created here: credentials
        # only exist for tenant admins (TenantManagementViewSet). Legacy client
        # logins created by the old flow keep working via ClientResetPasswordView.
        serializer.save(tenant=self.request.user.tenant, client_id=client_id_val)


class ClientResetPasswordView(APIView):
    """
    POST /api/clients/{id}/reset-password/  { new_password }
    Admin-only: reset the login password for the user account linked to a client.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, client_id):
        from django_tenants.utils import schema_context
        from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError

        if request.user.role not in ('admin', 'lab_manager'):
            raise PermissionDenied("Only admins and lab managers can reset client passwords.")

        new_password = request.data.get('new_password', '').strip()
        if len(new_password) < 8:
            raise DRFValidationError({'new_password': ['Password must be at least 8 characters.']})

        try:
            client = Client.objects.get(pk=client_id)
        except Client.DoesNotExist:
            return Response({'detail': 'Client not found.'}, status=404)

        username = client.client_id or ''
        if not username:
            return Response({'detail': 'This client has no linked user account.'}, status=400)

        with schema_context('public'):
            try:
                user = User.objects.get(username=username)
                user.set_password(new_password)
                user.save()
                logger.info("Password reset for client user '%s' by '%s'.", username, request.user.username)
                return Response({'detail': f"Password for {username} updated successfully."})
            except User.DoesNotExist:
                return Response({'detail': f'No user account found for username "{username}".'}, status=404)


class TenantListView(ListAPIView):
    """Public list of tenants (slug + name only) — used by login page."""
    serializer_class = TenantSerializer
    authentication_classes = []
    permission_classes = []
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['slug', 'schema_name']
    queryset = Tenant.objects.filter(is_active=True).prefetch_related('domains')


class TenantUsersView(ListAPIView):
    """List all users belonging to a specific tenant. Superadmin only."""
    serializer_class = UserSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'date_joined']
    ordering = ['username']

    def get_queryset(self):
        tenant_id = self.kwargs['tenant_id']
        return User.objects.filter(tenant_id=tenant_id)


class TenantDetailView(RetrieveUpdateAPIView):
    """Retrieve or update a tenant (includes nested domains). Superadmin only."""
    serializer_class = TenantSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = Tenant.objects.prefetch_related('domains').all()

    def get_object(self):
        from django_tenants.utils import schema_context
        with schema_context('public'):
            return super().get_object()

    def update(self, request, *args, **kwargs):
        from django_tenants.utils import schema_context
        with schema_context('public'):
            return super().update(request, *args, **kwargs)


class TenantLogoView(APIView):
    """Upload or delete the tenant logo. Superadmin only."""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self, tenant_id):
        from django.shortcuts import get_object_or_404
        from django_tenants.utils import schema_context
        with schema_context('public'):
            return get_object_or_404(Tenant, pk=tenant_id)

    def post(self, request, tenant_id):
        from django_tenants.utils import schema_context
        with schema_context('public'):
            tenant = self.get_object(tenant_id)
            serializer = TenantLogoSerializer(tenant, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                logo_url = request.build_absolute_uri(tenant.logo.url) if tenant.logo else None
                return Response({'logo': logo_url})
            return Response(serializer.errors, status=400)

    def delete(self, request, tenant_id):
        from django_tenants.utils import schema_context
        with schema_context('public'):
            tenant = self.get_object(tenant_id)
            if tenant.logo:
                tenant.logo.delete(save=True)
        return Response({'logo': None})


def _stream_import(rows, row_importer):
    """
    Shared NDJSON generator for the streaming import endpoints. Yields one JSON line
    per row as {"type": "progress", ...} while processing, then a final
    {"type": "done", ...} line with the aggregate counts and full row log.
    Each line is newline-terminated so the client can split on '\\n' as chunks arrive.
    """
    total = len(rows)
    results = []
    created = failed = skipped = 0

    for i, (row_num, row) in enumerate(rows, start=1):
        if not (row.get('title') or '').strip():
            result = {'row': row_num, 'ok': None, 'title': None, 'error': 'Missing Title'}
        else:
            result = {'row': row_num, **row_importer(row)}

        results.append(result)
        if result['ok'] is True:
            created += 1
        elif result['ok'] is None:
            skipped += 1
        else:
            failed += 1

        yield json.dumps({
            'type': 'progress', 'processed': i, 'total': total, 'row': result,
        }) + '\n'

    yield json.dumps({
        'type': 'done', 'created': created, 'failed': failed, 'skipped': skipped, 'rows': results,
    }) + '\n'


def _log_tenant_audit(request, action, tenant, extra=None):
    """AuditEvent for tenant lifecycle actions — never blocks the operation itself."""
    try:
        from django.contrib.contenttypes.models import ContentType
        from audittrail.models import AuditEvent
        AuditEvent.objects.create(
            user=request.user,
            action=action,
            content_type=ContentType.objects.get_for_model(Tenant),
            object_id=tenant.pk,
            object_repr=f"Tenant: {tenant.name} ({tenant.slug})",
            ip_address=request.META.get('REMOTE_ADDR'),
            extra_data=extra or {},
        )
    except Exception:
        logger.exception("Failed to write tenant audit event for '%s'.", tenant.slug)


class TenantManagementViewSet(ModelViewSet):
    """
    Superadmin-only tenant lifecycle: /api/tenant-management/
    Creating a tenant provisions its schema + domains (Tenant.save) and a
    tenant-admin account whose temporary password is returned once in the
    create response — same one-time-reveal pattern as ClientViewSet.
    No destroy: tenants are deactivated (is_active=False), never deleted,
    because dropping a schema is irreversible.
    """
    serializer_class = TenantSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'slug', 'email']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']  # no PUT/DELETE

    def get_queryset(self):
        return Tenant.objects.prefetch_related('domains').all()

    def perform_create(self, serializer):
        from django.utils.crypto import get_random_string
        from django.utils.text import slugify
        from django_tenants.utils import schema_context
        from rest_framework.exceptions import ValidationError as DRFValidationError

        with schema_context('public'):
            name = serializer.validated_data.get('name', '').strip()
            slug = slugify(serializer.validated_data.get('slug', '') or name)
            if not slug:
                raise DRFValidationError({'slug': ['A valid slug is required.']})
            if Tenant.objects.filter(slug=slug).exists():
                raise DRFValidationError({'slug': [f'A tenant with slug "{slug}" already exists.']})

            tenant = serializer.save(slug=slug, schema_name=slug)

            admin_username = f"{slug}-admin"
            temp_password = get_random_string(20)
            if not User.objects.filter(username__iexact=admin_username).exists():
                User.objects.create_user(
                    username=admin_username,
                    email=serializer.validated_data.get('email', ''),
                    password=temp_password,
                    role='admin',
                    tenant=tenant,
                )
                # One-time reveal in the create response — never logged or stored.
                self.request._created_tenant_admin_username = admin_username
                self.request._created_tenant_admin_password = temp_password

            _log_tenant_audit(self.request, 'create', tenant,
                              extra={'admin_account': admin_username})

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        username = getattr(request, '_created_tenant_admin_username', None)
        password = getattr(request, '_created_tenant_admin_password', None)
        if username:
            response.data['admin_username'] = username
            response.data['admin_password'] = password
        return response

    def perform_update(self, serializer):
        from django_tenants.utils import schema_context
        with schema_context('public'):
            was_active = serializer.instance.is_active
            tenant = serializer.save()
            if was_active != tenant.is_active:
                _log_tenant_audit(self.request, 'update', tenant,
                                  extra={'is_active': tenant.is_active})


class SenaiteInstrumentImportView(APIView):
    """POST /api/senaite-import/instruments/ — bulk-create SENAITE Instruments from an uploaded .xlsx/.csv file."""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsLabManagerOrAbove]
    parser_classes = [MultiPartParser]

    def post(self, request):
        from django.http import StreamingHttpResponse
        from .excel_import import read_excel_rows
        from .senaite_service import import_instrument_row

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file uploaded.'}, status=400)

        try:
            rows = read_excel_rows(file_obj, required_columns={'title'})
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        response = StreamingHttpResponse(
            _stream_import(rows, import_instrument_row),
            content_type='application/x-ndjson',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class SenaiteStorageLocationImportView(APIView):
    """POST /api/senaite-import/storage-locations/ — bulk-create SENAITE Storage Locations from an uploaded .xlsx/.csv file."""
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsLabManagerOrAbove]
    parser_classes = [MultiPartParser]

    def post(self, request):
        from django.http import StreamingHttpResponse
        from .excel_import import read_excel_rows
        from .senaite_service import import_storage_location_row

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file uploaded.'}, status=400)

        try:
            rows = read_excel_rows(file_obj, required_columns={'title'})
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        response = StreamingHttpResponse(
            _stream_import(rows, import_storage_location_row),
            content_type='application/x-ndjson',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class SenaiteMasterDataDeleteView(APIView):
    """
    POST /api/senaite-import/delete/  { "uids": ["uid1", "uid2", ...] }
    Deactivates one or more SENAITE objects (Instruments, Storage Locations, or any
    other portal_type) by UID — used by the Instrument List / Storage List delete flow.
    """
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsLabManagerOrAbove]

    def post(self, request):
        from .senaite_service import delete_object

        uids = request.data.get('uids')
        if not uids or not isinstance(uids, list):
            return Response({'detail': 'Provide a non-empty "uids" list.'}, status=400)

        results = [delete_object(uid) for uid in uids]
        deleted = sum(1 for r in results if r['ok'])
        failed = len(results) - deleted
        return Response({'deleted': deleted, 'failed': failed, 'results': results})
