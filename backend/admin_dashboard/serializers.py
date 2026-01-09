from rest_framework import serializers


class TrackVisitSerializer(serializers.Serializer):
    page = serializers.ChoiceField(choices=["landing", "pos", "kds"])


class SetTestAccountSerializer(serializers.Serializer):
    is_test_account = serializers.BooleanField()
