from rest_framework import serializers
from .models import StorageLocation, Reagent, Standard, Solvent, Lot, InventoryTransaction, ExpiryAlert


class StorageLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorageLocation
        fields = "__all__"
        read_only_fields = ('senaite_uid', 'senaite_path', 'label_code')

    def validate(self, attrs):
        """Enforce StorageLocation.ALLOWED_PARENT_TYPES here (not in the model's
        save()) so a violation comes back as a clean field-level 400, not an
        uncaught Django ValidationError -> 500. Falls back to the existing
        instance's current value for any field a PATCH didn't include."""
        location_type = attrs.get(
            'location_type', getattr(self.instance, 'location_type', None)
        )
        if 'parent' in attrs:
            parent = attrs['parent']
        else:
            parent = getattr(self.instance, 'parent', None)

        allowed = StorageLocation.ALLOWED_PARENT_TYPES.get(location_type, set())
        type_label = dict(StorageLocation.LOCATION_TYPES).get(location_type, location_type)
        if parent:
            if parent.location_type not in allowed:
                parent_label = dict(StorageLocation.LOCATION_TYPES).get(parent.location_type, parent.location_type)
                raise serializers.ValidationError({
                    'parent': f"A '{type_label}' cannot be placed under a '{parent_label}'.",
                })
        elif allowed:
            raise serializers.ValidationError({
                'parent': f"A '{type_label}' requires a parent location.",
            })
        return attrs


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
