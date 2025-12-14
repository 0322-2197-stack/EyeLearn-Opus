# EyeLearn Docker Configuration
FROM php:8.1-cli

# Install PHP extensions
RUN docker-php-ext-install mysqli pdo pdo_mysql && docker-php-ext-enable mysqli

# Copy application files
COPY . /var/www/html/

# Set working directory
WORKDIR /var/www/html

# Set permissions
RUN mkdir -p /var/www/html/uploads/images \
    && chmod -R 755 /var/www/html \
    && chmod -R 777 /var/www/html/uploads

# Expose port (Railway will set $PORT)
EXPOSE 80


# Debug: Echo before starting server
CMD echo "Starting PHP server on port $PORT" && php -S 0.0.0.0:${PORT:-80} -t /var/www/html /var/www/html/router.php
