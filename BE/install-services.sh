#!/bin/bash
set -e

# ============================================================================
# Systemd Service Installation Script
# ============================================================================
# This script installs the AI Learning App as systemd services
# Must be run with sudo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Installing AI Learning App Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Create log directory
echo "📁 Creating log directory..."
mkdir -p /var/log/ai-learning-app
chown ubuntu:ubuntu /var/log/ai-learning-app

# Copy service files
echo "📋 Copying service files..."
cp ai-learning-app.service /etc/systemd/system/
cp celery-worker.service /etc/systemd/system/

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "✅ Enabling services..."
systemctl enable ai-learning-app.service
systemctl enable celery-worker.service

# Start services
echo "🚀 Starting services..."
systemctl start ai-learning-app.service
systemctl start celery-worker.service

# Check status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Service Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
systemctl status ai-learning-app.service --no-pager
systemctl status celery-worker.service --no-pager

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Installation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Useful commands:"
echo "  sudo systemctl status ai-learning-app"
echo "  sudo systemctl restart ai-learning-app"
echo "  sudo systemctl stop ai-learning-app"
echo "  sudo journalctl -u ai-learning-app -f"
echo "  sudo tail -f /var/log/ai-learning-app/app.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
