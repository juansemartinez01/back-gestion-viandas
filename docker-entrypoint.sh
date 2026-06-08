#!/bin/sh
set -e

echo "Running migrations..."
npm run db:migration:run

echo "Running seed..."
npm run db:seed

echo "Starting app..."
exec node dist/main.js
