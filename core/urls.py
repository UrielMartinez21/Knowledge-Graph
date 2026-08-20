from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include

urlpatterns = [
    path('favicon.ico', lambda r: HttpResponse(status=204)),
    path('admin/', admin.site.urls),
    path('', include('graph.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
