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
    && chmod -R 755 /var/www/html

# Expose port 80
EXPOSE 80

# Configure Apache
RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

# Start Apache
CMD ["apache2-foreground"]
