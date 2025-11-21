from django.db import models


class Product(models.Model):
    code = models.CharField(max_length=8)
    title = models.CharField(max_length=200)
    stock = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.code} - {self.title}"
