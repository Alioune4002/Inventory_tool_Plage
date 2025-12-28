import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import TenantFactory, UserFactory


def _auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def _csv_file():
    content = "name,quantity,unit,barcode\nFarine,2,kg,\nBeurre,1,pcs,\n"
    return SimpleUploadedFile("receipt.csv", content.encode("utf-8"), content_type="text/csv")


@pytest.mark.django_db
def test_receipt_import_solo_quota():
    tenant = TenantFactory()
    user = UserFactory(profile=tenant)
    client = _auth_client(user)

    res1 = client.post("/api/receipts/import/", {"file": _csv_file()}, format="multipart")
    assert res1.status_code == 201
    assert res1.data.get("lines")

    res2 = client.post("/api/receipts/import/", {"file": _csv_file()}, format="multipart")
    assert res2.status_code == 201

    res3 = client.post("/api/receipts/import/", {"file": _csv_file()}, format="multipart")
    assert res3.status_code == 403
    assert res3.data.get("code") == "LIMIT_RECEIPTS_IMPORT_MONTH"
