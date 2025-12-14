# EyeLearn Docker Configuration
FROM php:8.1-apache

# Install PHP extensions
RUN docker-php-ext-install mysqli pdo pdo_mysql && docker-php-ext-enable mysqli

# Disable all MPM modules first
RUN a2dismod mpm_event mpm_worker mpm_prefork 2>/dev/null || true

# Enable only mpm_prefork
RUN a2enmod mpm_prefork

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Copy application files
COPY . /var/www/html/

# Set permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html \
    && mkdir -p /var/www/html/uploads/images \
    && chmod -R 777 /var/www/html/uploads

# Configure Apache for Railway (dynamic port support)
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Allow .htaccess overrides
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Create startup script for dynamic port
RUN echo '#!/bin/bash\n\
PORT=${PORT:-80}\n\
sed -i "s/Listen 80/Listen $PORT/g" /etc/apache2/ports.conf\n\
sed -i "s/:80/:$PORT/g" /etc/apache2/sites-enabled/*.conf\n\
apache2-foreground' > /usr/local/bin/start-apache.sh \
    && chmod +x /usr/local/bin/start-apache.sh

# Expose port (Railway will override with $PORT)
EXPOSE 80

# Start Apache with dynamic port support
CMD ["/usr/local/bin/start-apache.sh"]
