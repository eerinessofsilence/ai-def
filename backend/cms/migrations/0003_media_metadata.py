from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cms", "0002_pages")]
    operations = [
        migrations.AddField(model_name="mediaasset", name="display_name", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="mediaasset", name="source_url", field=models.CharField(blank=True, max_length=500)),
    ]
