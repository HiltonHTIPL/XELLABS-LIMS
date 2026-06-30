from rest_framework import serializers
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert


class StorageLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorageLocation
        fields = "__all__"


class ReagentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reagent
        fields = "__all__"


class StandardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Standard
        fields = "__all__"


class SolventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Solvent
        fields = "__all__"


class LotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lot
        fields = "__all__"
        read_only_fields = ("created_by", "received_date")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class InventoryTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryTransaction
        fields = "__all__"
        read_only_fields = ("created_by", "created_at")

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ExpiryAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpiryAlert
        fields = "__all__"
        read_only_fields = ("acknowledged_by", "created_at")
