# Base image
FROM nginx:alpine

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy all files to the Nginx server's document root
COPY . /usr/share/nginx/html/

# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt
# Expose port
EXPOSE 80
