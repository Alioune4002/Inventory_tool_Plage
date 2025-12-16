import factory
from django.contrib.auth import get_user_model
from accounts.models import Tenant, UserProfile, Service
from products.models import Product

User = get_user_model()


class TenantFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Tenant

    name = factory.Sequence(lambda n: f"Tenant {n}")
    domain = "food"

    @factory.post_generation
    def default_service(self, create, extracted, **kwargs):
        if not create:
            return
        Service.objects.get_or_create(tenant=self, name="Principal")


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")
    password = factory.PostGenerationMethodCall("set_password", "password123")

    @factory.post_generation
    def profile(self, create, extracted, **kwargs):
        if not create:
            return
        tenant = extracted or TenantFactory()
        UserProfile.objects.create(user=self, tenant=tenant, role="owner")


class ServiceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Service

    tenant = factory.SubFactory(TenantFactory)
    name = factory.Sequence(lambda n: f"Service {n}")


class ProductFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Product

    tenant = factory.SubFactory(TenantFactory)
    service = factory.LazyAttribute(lambda obj: Service.objects.get_or_create(tenant=obj.tenant, name="Principal")[0])
    name = factory.Sequence(lambda n: f"Product {n}")
    category = "sec"
    purchase_price = "1.00"
    selling_price = "2.00"
    tva = "5.5"
    dlc = None
    quantity = 10
    barcode = factory.Sequence(lambda n: f"1234567890{n}")
    inventory_month = "2025-01"
