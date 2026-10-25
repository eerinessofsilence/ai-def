from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("main", "0053_seed_arms_catalogue")]
    operations = [migrations.AddField(model_name="armsimage", name="alt", field=models.JSONField(blank=True, default=dict))]
