#!/bin/bash
# ============================================================
# Xellabs LIMS — WSL Startup Script
# Run this in your WSL (Ubuntu-22.04) terminal:
#   bash /mnt/c/Users/Hilton/xellabs-lims/start-wsl.sh
# ============================================================

set -e
PROJECT="/mnt/c/Users/Hilton/xellabs-lims"
REBRAND="$PROJECT/senaite-rebrand"
CONTAINER="senaite"

echo "=============================="
echo " Xellabs LIMS — WSL Startup"
echo "=============================="

# ── Step 1: PostgreSQL ──────────────────────────────────────
echo ""
echo "[1/3] Starting PostgreSQL..."
sudo service postgresql start
sudo service postgresql status | grep -q "online\|running" && echo "  ✓ PostgreSQL running" || echo "  ✗ PostgreSQL failed to start"

# ── Step 2: Redis ───────────────────────────────────────────
echo ""
echo "[2/3] Starting Redis..."
sudo service redis-server start
sudo service redis-server status | grep -q "running" && echo "  ✓ Redis running" || echo "  ✗ Redis failed to start"

# ── Step 3: SENAITE Docker container ───────────────────────
echo ""
echo "[3/3] Starting SENAITE container..."

# Check if container exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    STATUS=$(docker inspect --format '{{.State.Status}}' $CONTAINER)
    if [ "$STATUS" = "running" ]; then
        echo "  ✓ SENAITE already running"
    else
        echo "  Starting existing container..."
        docker start $CONTAINER
        echo "  ✓ SENAITE started (white-label preserved)"
    fi
else
    echo "  Container not found — creating from cached image..."
    docker run -d --name $CONTAINER -p 8080:8080 \
        -e SITE=senaite -e ADMIN_USER=admin -e ADMIN_PASSWORD=admin \
        senaite/senaite:v2.6.0

    echo "  Waiting for Zope to start (~90 seconds)..."
    until docker logs $CONTAINER 2>&1 | grep -q "Zope Ready to handle requests"; do
        sleep 8
        printf "."
    done
    echo ""
    echo "  Applying XelLabs white-label branding..."

    for f in logo.pt toolbar.pt footer.pt colophon.pt frontpage.pt xellabs_overrides.css apply_rebrand.sh apply_templates.sh fix_title_full2.py; do
        docker cp "$REBRAND/$f" "$CONTAINER:/tmp/"
    done

    docker exec --user root $CONTAINER bash /tmp/apply_rebrand.sh
    docker exec --user root $CONTAINER bash /tmp/apply_templates.sh
    docker exec $CONTAINER python2.7 /tmp/fix_title_full2.py
    docker restart $CONTAINER

    echo "  Waiting for Zope to restart..."
    until docker logs $CONTAINER 2>&1 | grep -q "Zope Ready to handle requests"; do
        sleep 8
        printf "."
    done
    echo ""
    echo "  ✓ SENAITE started + white-label applied"
fi

echo ""
echo "=============================="
echo " All WSL services started!"
echo "=============================="
echo ""
echo " SENAITE → http://localhost:8080/senaite  (admin / admin)"
echo " Waiting for Zope if freshly started:"
echo "   docker logs -f senaite"
echo ""
echo " Now run start-django.ps1 in PowerShell to start Django."
