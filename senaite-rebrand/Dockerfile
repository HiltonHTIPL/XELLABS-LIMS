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

# Same root cause, different content type: SampleTemplate.partitions/services
# are List(value_type=DataGridRow(...)) fields with no restapi deserializer —
# see CLAUDE.md section 16b/16c.
COPY sampletemplate_datagrid_deserializer.py ${CORE}/adapters/sampletemplate_datagrid_deserializer.py
COPY patch_sampletemplate_zcml.py /tmp/patch_sampletemplate_zcml.py
RUN python2.7 /tmp/patch_sampletemplate_zcml.py

RUN chown senaite:senaite \
    ${CORE}/adapters/sampletype_stickers_deserializer.py \
    ${CORE}/adapters/sampletemplate_datagrid_deserializer.py \
    ${CORE}/adapters/configure.zcml

# Calculation.Formula's registered validator reads request.form["InterimFields"]
# (raw classic Zope form data), which plone.restapi's JSON body never
# populates — any formula referencing an interim keyword is rejected via every
# REST path. Custom views call bika.lims.api.create()/edit(), which set AT
# fields via their mutators (bypassing field.validate() and its validators=
# list entirely) — see calculation_views.py docstring.
COPY calculation_views.py ${CORE}/adapters/calculation_views.py
COPY patch_calculation_zcml.py /tmp/patch_calculation_zcml.py
RUN python2.7 /tmp/patch_calculation_zcml.py
RUN chown senaite:senaite \
    ${CORE}/adapters/calculation_views.py \
    ${CORE}/adapters/configure.zcml

# Client's Address fields (PhysicalAddress/PostalAddress/BillingAddress,
# inherited from the shared Organisation base class) have a country/state/
# district validator ("inline_field_validator" in bika/lims/validators.py)
# that reads kwargs['REQUEST'].get(...) — REQUEST is always None via
# obj.validate(data=True), the call every REST path (legacy jsonapi AND
# plone.restapi's own PATCH) uses, so any non-blank Country/State/District
# crashes on every save. Same bypass pattern as calculation_views.py — see
# client_address_views.py docstring.
COPY client_address_views.py ${CORE}/adapters/client_address_views.py
COPY patch_client_address_zcml.py /tmp/patch_client_address_zcml.py
RUN python2.7 /tmp/patch_client_address_zcml.py
RUN chown senaite:senaite \
    ${CORE}/adapters/client_address_views.py \
    ${CORE}/adapters/configure.zcml

# Same broken Address validator affects LabContact (from Person) and the
# Laboratory singleton (from Organisation). Custom views bypass it via mutators,
# and also handle base64 image uploads (Signature / AccreditationBodyLogo) —
# see labcontact_lab_views.py docstring.
COPY labcontact_lab_views.py ${CORE}/adapters/labcontact_lab_views.py
COPY patch_labcontact_lab_zcml.py /tmp/patch_labcontact_lab_zcml.py
RUN python2.7 /tmp/patch_labcontact_lab_zcml.py
RUN chown senaite:senaite \
    ${CORE}/adapters/labcontact_lab_views.py \
    ${CORE}/adapters/configure.zcml

# Worksheet flow: the AT Worksheet marks `Analyses` required, so generic REST
# create fails ("Analyses is required"). These custom views replicate SENAITE's
# native empty-create + applyWorksheetTemplate flow (auto-fills routine/QC/
# duplicate slots) and return JSON — see worksheet_views.py docstring.
COPY worksheet_views.py ${CORE}/adapters/worksheet_views.py
COPY patch_worksheet_zcml.py /tmp/patch_worksheet_zcml.py
RUN python2.7 /tmp/patch_worksheet_zcml.py
RUN chown senaite:senaite \
    ${CORE}/adapters/worksheet_views.py \
    ${CORE}/adapters/configure.zcml

# Analysis.calculateResult() (the real formula-from-interim-fields engine) only
# ever fires via SENAITE's own JS-driven AJAX call on interim-cell-change — a
# flat REST write of {Result, InterimFields} never triggers it. This view
# invokes the real method directly so a Calculation-backed Analysis (e.g. Soil
# Calcium and Magnesium: [CA]+[MG]) actually computes its Result from entered
# interim values — see analysis_calculate_view.py docstring.
COPY analysis_calculate_view.py ${CORE}/adapters/analysis_calculate_view.py
COPY patch_analysis_calculate_zcml.py /tmp/patch_analysis_calculate_zcml.py
RUN python2.7 /tmp/patch_analysis_calculate_zcml.py
RUN chown senaite:senaite \
    ${CORE}/adapters/analysis_calculate_view.py \
    ${CORE}/adapters/configure.zcml

# Pushes our Django-side AnalysisSpecification's per-service ranges onto a
# live AnalysisRequest via SENAITE's own real setResultsRange() (confirmed by
# reading analysisrequest.py directly) so isOutOfRange()/getResultsRange()
# work exactly as they would for a native Specification-linked sample - see
# analysisrequest_specification_view.py docstring.
COPY analysisrequest_specification_view.py ${CORE}/adapters/analysisrequest_specification_view.py
COPY patch_analysisrequest_specification_zcml.py /tmp/patch_analysisrequest_specification_zcml.py
RUN python2.7 /tmp/patch_analysisrequest_specification_zcml.py
RUN chown senaite:senaite \
    ${CORE}/adapters/analysisrequest_specification_view.py \
    ${CORE}/adapters/configure.zcml

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
