from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    report_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Report
        fields = "__all__"
        read_only_fields = ("generated_by", "created_at", "published_at")

    def create(self, validated_data):
        import uuid
        if not validated_data.get("report_id"):
            validated_data["report_id"] = f"RPT-{uuid.uuid4().hex[:8].upper()}"
        validated_data["generated_by"] = self.context["request"].user
        return super().create(validated_data)
