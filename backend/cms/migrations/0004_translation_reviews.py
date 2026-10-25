from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("cms", "0003_media_metadata")]
    operations = [migrations.AddField(model_name="document", name="translation_reviews", field=models.JSONField(blank=True, default=dict))]
