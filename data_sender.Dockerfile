# data_sender.Dockerfile
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing pyc files and buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy data_sender code
COPY data_sender /app/

# Expose port (optional, not strictly needed)
EXPOSE 8000

# Run the data_sender script
CMD ["python", "send_data.py"]