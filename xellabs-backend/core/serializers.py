from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Client, Tenant, Domain

User = get_user_model()


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ['id', 'domain', 'is_primary']


class TenantSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'slug', 'schema_name',
            'email', 'phone', 'address', 'logo',
            'is_active', 'created_at', 'domains',
        ]
        read_only_fields = ['schema_name', 'created_at']


class TenantLogoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = ['logo']


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'role', 'is_active', 'date_joined']
        read_only_fields = ['date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class ClientSerializer(serializers.ModelSerializer):
    tenant_detail = TenantSerializer(source='tenant', read_only=True)

    class Meta:
        model = Client
        fields = [
            # Core identifiers
            'id', 'name', 'client_id',
            # Organisation contact
            'email', 'phone', 'fax', 'mobile',
            # Primary contact person
            'contact_person', 'salutation',
            'contact_first_name', 'contact_last_name',
            'contact_email', 'contact_phone',
            'contact_job_title', 'contact_department',
            # Addresses
            'address', 'physical_address', 'postal_address', 'billing_address',
            # Financial
            'tax_number', 'account_number',
            'bank_name', 'bank_branch', 'swift_code', 'iban', 'nib',
            'bulk_discount', 'member_discount',
            # Notes & sync
            'remarks', 'senaite_uid',
            # Meta
            'tenant', 'tenant_detail', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'senaite_uid']
