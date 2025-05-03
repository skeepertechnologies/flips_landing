# # gis/Dockerfile
# FROM python:3.9-slim

# # Set environment variables
# ENV PYTHONDONTWRITEBYTECODE=1
# ENV PYTHONUNBUFFERED=1

# # Set working directory
# WORKDIR /app

# # Install system dependencies
# RUN apt-get update && apt-get install -y \
#     libgdal-dev \
#     gdal-bin \
#     python3-gdal \
#     && apt-get clean && rm -rf /var/lib/apt/lists/*

# # Install Python dependencies
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# # Copy gis folder contents
# COPY . /app/

# # Set permissions
# # RUN chmod -R 755 /app

# # Set Google Application Credentials
# ENV GOOGLE_APPLICATION_CREDENTIALS="/app/key.json"

# # Expose port
# EXPOSE 8001

# # Run server
# # CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]
# CMD ["gunicorn", "gis.wsgi:application", "--bind", "0.0.0.0:8001"]
