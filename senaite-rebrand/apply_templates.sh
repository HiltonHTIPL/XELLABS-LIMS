#!/bin/bash
# Run with: docker exec --user root senaite bash /tmp/apply_templates.sh
# (after docker cp *.pt senaite:/tmp/ for each template file)
set -e

BASE="/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/browser"

TOOLBAR_PT="${BASE}/viewlets/templates/toolbar.pt"
FOOTER_PT="${BASE}/viewlets/templates/footer.pt"
COLOPHON_PT="${BASE}/viewlets/templates/colophon.pt"
FRONTPAGE_PT="${BASE}/frontpage/templates/frontpage.pt"

# Backup originals
[ -f "${TOOLBAR_PT}.bak" ] || cp "$TOOLBAR_PT" "${TOOLBAR_PT}.bak"
[ -f "${FOOTER_PT}.bak" ] || cp "$FOOTER_PT" "${FOOTER_PT}.bak"
[ -f "${COLOPHON_PT}.bak" ] || cp "$COLOPHON_PT" "${COLOPHON_PT}.bak"
[ -f "${FRONTPAGE_PT}.bak" ] || cp "$FRONTPAGE_PT" "${FRONTPAGE_PT}.bak"
echo "Backups done"

# Apply rebranded versions
cp /tmp/toolbar.pt "$TOOLBAR_PT"
echo "toolbar.pt applied"

cp /tmp/footer.pt "$FOOTER_PT"
echo "footer.pt applied"

cp /tmp/colophon.pt "$COLOPHON_PT"
echo "colophon.pt applied"

cp /tmp/frontpage.pt "$FRONTPAGE_PT"
echo "frontpage.pt applied"

echo "ALL TEMPLATES APPLIED"
