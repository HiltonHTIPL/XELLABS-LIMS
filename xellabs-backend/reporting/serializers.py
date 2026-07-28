from rest_framework import serializers
from .models import Report, ReportTemplate, DEFAULT_COA_FIELDS


class ReportTemplateSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ReportTemplate
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_logo_url(self, obj):
        return obj.get_logo_url()

    def create(self, validated_data):
        if not validated_data.get("fields"):
            validated_data["fields"] = DEFAULT_COA_FIELDS
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ReportSerializer(serializers.ModelSerializer):
    report_id        = serializers.CharField(required=False, allow_blank=True)
    generated_by_name = serializers.SerializerMethodField(read_only=True)
    sample_id        = serializers.SerializerMethodField(read_only=True)
    client_name      = serializers.SerializerMethodField(read_only=True)
    client_id        = serializers.SerializerMethodField(read_only=True)
    sample_type_name = serializers.SerializerMethodField(read_only=True)
    collection_date  = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Report
        fields = "__all__"
        read_only_fields = ("generated_by", "created_at", "published_at")

    def get_generated_by_name(self, obj):
        return obj.generated_by.get_full_name() or obj.generated_by.username if obj.generated_by_id else None

    def get_sample_id(self, obj):
        return obj.sample.sample_id if obj.sample_id else None

    def get_client_name(self, obj):
        if obj.sample_id and obj.sample.client_id:
            return obj.sample.client.name if hasattr(obj.sample, 'client') else None
        return None

    def get_client_id(self, obj):
        return obj.sample.client_id if obj.sample_id else None

    def get_sample_type_name(self, obj):
        if obj.sample_id and obj.sample.sample_type_id:
            return obj.sample.sample_type.name if hasattr(obj.sample, 'sample_type') else None
        return None

    def get_collection_date(self, obj):
        return str(obj.sample.collection_date) if obj.sample_id and obj.sample.collection_date else None

    def create(self, validated_data):
        import uuid
        if not validated_data.get("report_id"):
            validated_data["report_id"] = f"RPT-{uuid.uuid4().hex[:8].upper()}"
        validated_data["generated_by"] = self.context["request"].user
        return super().create(validated_data)
