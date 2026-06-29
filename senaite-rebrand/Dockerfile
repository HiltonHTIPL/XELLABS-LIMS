FROM senaite/senaite:v2.6.0

USER root

ENV BASE=/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/browser

# Replace branding templates
COPY logo.pt          ${BASE}/viewlets/templates/logo.pt
COPY toolbar.pt       ${BASE}/viewlets/templates/toolbar.pt
COPY footer.pt        ${BASE}/viewlets/templates/footer.pt
COPY colophon.pt      ${BASE}/viewlets/templates/colophon.pt
COPY frontpage.pt     ${BASE}/frontpage/templates/frontpage.pt

# Append XelLabs CSS overrides to the bundled stylesheet
COPY xellabs_overrides.css /tmp/xellabs_overrides.css
RUN cat /tmp/xellabs_overrides.css >> ${BASE}/static/bundles/senaite.core.css

# Fix ownership so the base entrypoint chown does not fail
RUN chown senaite:senaite \
    ${BASE}/viewlets/templates/logo.pt \
    ${BASE}/viewlets/templates/toolbar.pt \
    ${BASE}/viewlets/templates/footer.pt \
    ${BASE}/viewlets/templates/colophon.pt \
    ${BASE}/frontpage/templates/frontpage.pt \
    ${BASE}/static/bundles/senaite.core.css

USER senaite
