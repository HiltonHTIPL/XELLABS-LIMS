#!/bin/bash
# Run with: docker exec --user root senaite bash /tmp/apply_rebrand.sh
# (after docker cp apply_rebrand.sh senaite:/tmp/ and docker cp logo.pt senaite:/tmp/ and docker cp xellabs_overrides.css senaite:/tmp/)
set -e

LOGO_PT='/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/browser/viewlets/templates/logo.pt'
CSS_BUNDLE='/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/browser/static/bundles/senaite.core.css'

# Backup originals (only on first run)
[ -f "${LOGO_PT}.bak" ] || cp "$LOGO_PT" "${LOGO_PT}.bak"
[ -f "${CSS_BUNDLE}.bak" ] || cp "$CSS_BUNDLE" "${CSS_BUNDLE}.bak"
echo "Backups ready"

# Replace logo template
cp /tmp/logo.pt "$LOGO_PT"
echo "Logo template replaced"

# Append CSS overrides (avoid double-append)
if ! grep -q 'XelLabs White-Label' "$CSS_BUNDLE"; then
    cat /tmp/xellabs_overrides.css >> "$CSS_BUNDLE"
    echo "CSS overrides appended"
else
    echo "CSS overrides already present, skipping"
fi

echo "ALL DONE"
