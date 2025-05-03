
# urls.py
from django.urls import path
from .views import analyze_roi, home_engine
from . import  views


urlpatterns = [
    path("", views.home, name="home"),
    path('home', home_engine, name='home_engine'),  # Add this line for the empty path
    path('analyze-roi/', analyze_roi, name='analyze_roi'),
]



