FROM senaite/senaite:v2.6.0

USER root

ENV CORE=/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core
ENV BASE=${CORE}/browser

# Custom plone.restapi field deserializer for SampleType.admitted_sticker_templates —
# see CLAUDE.md section 16b. Neither the legacy @@API/senaite/v1 endpoints nor
# plone.restapi's own generic deserializer can write this DataGridField; this
# adapter bypasses schema validation and writes through the object's own mutator.
COPY sampletype_stickers_deserializer.py ${CORE}/adapters/sampletype_stickers_deserializer.py
COPY patch_sampletype_stickers_zcml.py /tmp/patch_sampletype_stickers_zcml.py
RUN python2.7 /tmp/patch_sampletype_stickers_zcml.py
RUN chown senaite:senaite ${CORE}/adapters/sampletype_stickers_deserializer.py ${CORE}/adapters/configure.zcml

# Replace branding templates
COPY logo.pt          ${BASE}/viewlets/templates/logo.pt
COPY toolbar.pt       ${BASE}/viewlets/templates/toolbar.pt
COPY footer.pt        ${BASE}/viewlets/templates/footer.pt
COPY colophon.pt      ${BASE}/viewlets/templates/colophon.pt
COPY frontpage.pt     ${BASE}/frontpage/templates/frontpage.pt

# Append XelLabs CSS overrides to the bundled stylesheet
COPY xellabs_overrides.css /tmp/xellabs_overrides.css
RUN cat /tmp/xellabs_overrides.css >> ${BASE}/static/bundles/senaite.core.css

# Ensure all branded files are owned by the senaite user
RUN chown senaite:senaite \
    ${BASE}/viewlets/templates/logo.pt \
    ${BASE}/viewlets/templates/toolbar.pt \
    ${BASE}/viewlets/templates/footer.pt \
    ${BASE}/viewlets/templates/colophon.pt \
    ${BASE}/frontpage/templates/frontpage.pt \
    ${BASE}/static/bundles/senaite.core.css

# Stay as root — base entrypoint calls gosu/su to drop to senaite at runtime
