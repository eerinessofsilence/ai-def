from django.contrib.admin.apps import AdminConfig


class AIDefAdminConfig(AdminConfig):
    default_site = "aidef.admin_site.AIDefAdminSite"
