#!/bin/sh
set -e

# Optimize caches
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Start the application
exec php artisan serve --host=0.0.0.0 --port="${PORT:-8000}"
