from django.db import models

class Product(models.Model):
    CATEGORIES = (
        ('sec', 'Sec'),
        ('frais', 'Frais'),
        ('non_perissable', 'Non périssable'),
        ('portants', 'Portants'),
        ('articles_de_plage', 'Articles de plage'),
    )

    name = models.CharField(max_length=100)
    category = models.CharField(max_length=50, choices=CATEGORIES)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    tva = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    dlc = models.DateField(null=True, blank=True)
    quantity = models.IntegerField()
    barcode = models.CharField(max_length=50, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    inventory_month = models.CharField(max_length=7, null=True, blank=True)  # Format: YYYY-MM

    def __str__(self):
        return self.name