#!/bin/bash
# Changes HTML comments and admin-page senaite.com links
# Run with: docker exec --user root senaite bash /tmp/apply_rebrand_comments.sh
set -e

CORE="/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg"
IMPRESS="/home/senaite/senaitelims/eggs/cp27mu/senaite.impress-2.6.0-py2.7.egg"

# ── HTML comments in skins/senaite_templates ─────────────────────────────────
for f in \
  "$CORE/senaite/core/skins/senaite_templates/edit_macros.pt" \
  "$CORE/senaite/core/skins/senaite_templates/base_view.pt" \
  "$CORE/senaite/core/skins/senaite_templates/tinymce_wysiwyg_support.pt" \
  "$CORE/senaite/core/skins/senaite_templates/base.pt" \
  "$CORE/senaite/core/skins/senaite_templates/senaite_widgets/field.pt"; do
  [ -f "${f}.bak" ] || cp "$f" "${f}.bak"
  sed -i 's|<!-- SENAITE |<!-- XelLabs |g' "$f"
  echo "Updated comments: $f"
done

# ── main_template: legacy resource comments ───────────────────────────────────
for f in \
  "$CORE/senaite/core/browser/main_template/templates/main_template.pt" \
  "$CORE/senaite/core/browser/main_template/templates/ajax_main_template.pt"; do
  [ -f "${f}.bak" ] || cp "$f" "${f}.bak"
  sed -i 's|<!-- SENAITE legacy resouces -->|<!-- XelLabs legacy resources -->|g' "$f"
  sed -i 's|<!-- SENAITE legacy JS -->|<!-- XelLabs legacy JS -->|g' "$f"
  sed -i 's|<!-- SENAITE legacy CSS -->|<!-- XelLabs legacy CSS -->|g' "$f"
  echo "Updated comments: $f"
done

# ── impress publish.pt comment ────────────────────────────────────────────────
f="$IMPRESS/senaite/impress/templates/publish.pt"
[ -f "${f}.bak" ] || cp "$f" "${f}.bak"
sed -i 's|<!-- SENAITE IMPRESS|<!-- XelLabs LIMS|g' "$f"
echo "Updated comments: $f"

# ── senaite-overview.pt: remove external senaite.com social links ─────────────
OVERVIEW="$CORE/senaite/core/browser/install/templates/senaite-overview.pt"
# Already backed up in apply_rebrand_full.sh
sed -i 's|href="https://www.senaite.com" title="Website"|href="#" title="XelLabs Website"|g' "$OVERVIEW"
sed -i 's|href="https://community.senaite.com"|href="#"|g' "$OVERVIEW"
sed -i 's|href="https://gitter.im/senaite/Lobby"|href="#"|g' "$OVERVIEW"
sed -i 's|href="https://github.com/senaite"|href="#"|g' "$OVERVIEW"
sed -i 's|href="https://twitter.com/senaitelims"|href="#"|g' "$OVERVIEW"
sed -i "s|site_title=SENAITE LIMS|site_title=XelLabs LIMS|g" "$OVERVIEW"
echo "Updated senaite-overview.pt links"

echo ""
echo "ALL COMMENT/LINK CHANGES DONE"
