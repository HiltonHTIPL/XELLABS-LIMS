#!/bin/bash
# Full XelLabs rebrand — replaces ALL user-visible SENAITE text
# Run with: docker exec --user root senaite bash /tmp/apply_rebrand_full.sh
set -e

CORE="/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg"
IMPRESS="/home/senaite/senaitelims/eggs/cp27mu/senaite.impress-2.6.0-py2.7.egg"

# ── 1. Legacy frontpage (bika/lims) ──────────────────────────────────────────
BIKA_FP="$CORE/bika/lims/browser/templates/senaite-frontpage.pt"
[ -f "${BIKA_FP}.bak" ] || cp "$BIKA_FP" "${BIKA_FP}.bak"
cat > "$BIKA_FP" << 'FRONTPAGE_EOF'
<html xmlns="http://www.w3.org/1999/xhtml"
      metal:use-macro="here/main_template/macros/master"
      i18n:domain="senaite.core">

  <metal:content-title fill-slot="content-title">
    <a href=""
       style="float:right;"
       tal:condition="python: not view.is_anonymous_user() and view.is_dashboard_enabled()"
       i18n:translate=""
       tal:attributes="href string:${portal_url}?redirect_to=dashboard">
      Switch to dashboard
    </a>
    <h1 class="documentFirstHeading">
      <img tal:attributes="src view/icon"/> Welcome to XelLabs LIMS
    </h1>
  </metal:content-title>

  <metal:content-description fill-slot="content-description">
    <div class="documentDescription"></div>
  </metal:content-description>

  <metal:content-core fill-slot="content-core">
    <div class="container">
      <h2>XelLabs — Laboratory Information Management System</h2>
      <p>XelLabs LIMS is an enterprise-grade Laboratory Information Management System
        built for high speed, excellent performance and regulatory compliance.
      </p>
    </div>
    <div class="container">
      <div class="col-md-12">
        <div class="features-list row">
          <div class="col-md-6 cell width-1:2 position-0">
            <h1>Features</h1>
            <ul>
              <li>Clean User Interface</li>
              <li>Rich UI components</li>
              <li>Integrated JSON API</li>
            </ul>
          </div>
          <div class="col-md-6 cell width-1:2 position-1:2">
            <h1>Specifications</h1>
            <ul>
              <li>HIPAA-compliant audit trail</li>
              <li>Built on Plone CMS</li>
              <li>Fully configurable workflows</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </metal:content-core>

</html>
FRONTPAGE_EOF
echo "bika frontpage.pt applied"

# ── 2. SENAITE IMPRESS publish page title ────────────────────────────────────
IMPRESS_PT="$IMPRESS/senaite/impress/templates/publish.pt"
[ -f "${IMPRESS_PT}.bak" ] || cp "$IMPRESS_PT" "${IMPRESS_PT}.bak"
sed -i 's|<title i18n:translate="">SENAITE IMPRESS</title>|<title i18n:translate="">XelLabs LIMS</title>|g' "$IMPRESS_PT"
sed -i 's|<!-- SENAITE IMPRESS HTML head -->|<!-- XelLabs LIMS HTML head -->|g' "$IMPRESS_PT"
echo "impress publish.pt applied"

# ── 3. main_template meta generator tag ──────────────────────────────────────
MAIN_TPL="$CORE/senaite/core/browser/main_template/templates/main_template.pt"
[ -f "${MAIN_TPL}.bak" ] || cp "$MAIN_TPL" "${MAIN_TPL}.bak"
sed -i 's|content="SENAITE - https://www.senaite.com"|content="XelLabs LIMS"|g' "$MAIN_TPL"
echo "main_template.pt meta generator updated"

# ── 4. Install / setup pages (admin Zope UI) ─────────────────────────────────
ADDSITE="$CORE/senaite/core/browser/install/templates/senaite-addsite.pt"
[ -f "${ADDSITE}.bak" ] || cp "$ADDSITE" "${ADDSITE}.bak"
sed -i 's|Install SENAITE LIMS|Install XelLabs LIMS|g' "$ADDSITE"
sed -i 's|Create SENAITE Site|Create XelLabs Site|g' "$ADDSITE"
echo "senaite-addsite.pt applied"

OVERVIEW="$CORE/senaite/core/browser/install/templates/senaite-overview.pt"
[ -f "${OVERVIEW}.bak" ] || cp "$OVERVIEW" "${OVERVIEW}.bak"
sed -i 's|Welcome to SENAITE|Welcome to XelLabs LIMS|g' "$OVERVIEW"
sed -i 's|View your SENAITE site|View your XelLabs LIMS site|g' "$OVERVIEW"
sed -i 's|You have multiple SENAITE sites:|You have multiple XelLabs LIMS sites:|g' "$OVERVIEW"
sed -i 's|No SENAITE site added yet|No XelLabs LIMS site added yet|g' "$OVERVIEW"
sed -i 's|Your SENAITE site has not been added yet:|Your XelLabs LIMS site has not been added yet:|g' "$OVERVIEW"
sed -i 's|You can add another SENAITE site:|You can add another XelLabs LIMS site:|g' "$OVERVIEW"
sed -i 's|value="SENAITE LIMS"|value="XelLabs LIMS"|g' "$OVERVIEW"
sed -i 's|value="Create a new SENAITE site"|value="Create a new XelLabs LIMS site"|g' "$OVERVIEW"
sed -i 's|title="SENAITE community"|title="XelLabs community"|g' "$OVERVIEW"
echo "senaite-overview.pt applied"

echo ""
echo "ALL DONE — restarting Zope to flush template cache..."
