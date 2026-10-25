from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("portal", "0018_portalproduct_description_es_and_more")]
    operations = [migrations.AddField(model_name="portalproduct", name="available", field=models.BooleanField(default=True))]
