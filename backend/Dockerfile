FROM php:8.3-cli-alpine

# Install OS dependencies and PHP extensions
RUN apk add --no-cache \
    postgresql-dev \
    libzip-dev \
    zip \
    unzip \
    bash \
    icu-dev \
    oniguruma-dev \
    && docker-php-ext-install pdo_pgsql mbstring bcmath intl zip

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy application files
COPY . .

# Install dependencies (no dev, optimize autoloader, no interaction, prefer dist)
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Set permissions
RUN chmod -R 775 storage bootstrap/cache \
    && chmod +x start.sh

# Expose port (Railway will provide $PORT)
EXPOSE 8000

# Start command
# Catatan: php artisan serve digunakan di sini untuk deployment testing awal
# dan menangani trafik ringan karena konfigurasinya yang sederhana.
# Ini bukan server production yang ideal (seperti Nginx/PHP-FPM atau FrankenPHP).
CMD ["./start.sh"]
