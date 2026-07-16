#!/bin/bash
# One-time bootstrap for issuing the first real Let's Encrypt certificate.
#
# nginx's config always references /etc/letsencrypt/live/$DOMAIN_NAME/ for
# its cert, so it refuses to start at all until that path exists — but
# Certbot needs nginx running on port 80 to complete the HTTP-01 challenge.
# This script breaks that chicken-and-egg loop: put a throwaway self-signed
# cert at the expected path so nginx starts, request the real cert (nginx's
# port-80 block is already serving the ACME challenge path), delete the
# throwaway cert, then reload nginx onto the real one.
#
# Run once from /opt/xellabs-lims after the proxy stack's first `up -d`:
#   ./nginx/init-letsencrypt.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DOMAIN_NAME:-}" ] || [ -z "${CERTBOT_EMAIL:-}" ]; then
  # docker compose only auto-loads .env for compose-file interpolation, not
  # into this shell — source it explicitly so we can use the same values.
  if [ -f .env ]; then
    set -a; source .env; set +a
  fi
fi
if [ -z "${DOMAIN_NAME:-}" ]; then
  echo "DOMAIN_NAME is not set (add it to .env)" >&2
  exit 1
fi
if [ -z "${CERTBOT_EMAIL:-}" ]; then
  echo "CERTBOT_EMAIL is not set (add it to .env)" >&2
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.proxy.yml)

echo "### Creating a temporary self-signed certificate for $DOMAIN_NAME ..."
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN_NAME && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem \
    -subj '/CN=localhost'"

echo "### Starting nginx (serving the temporary certificate for now) ..."
"${COMPOSE[@]}" up -d nginx

echo "### Deleting the temporary certificate ..."
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN_NAME && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN_NAME && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN_NAME.conf"

echo "### Requesting the real certificate from Let's Encrypt ..."
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN_NAME" \
  --email "$CERTBOT_EMAIL" \
  --rsa-key-size 2048 \
  --agree-tos \
  --no-eff-email

echo "### Reloading nginx onto the real certificate ..."
"${COMPOSE[@]}" exec nginx nginx -s reload

echo "### Done. Verify with: curl -I https://$DOMAIN_NAME/"
