path = "/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/adapters/configure.zcml"
with open(path, "r") as f:
    content = f.read()

if "xmlns:browser" not in content:
    content = content.replace(
        'xmlns:zcml="http://namespaces.zope.org/zcml"',
        'xmlns:zcml="http://namespaces.zope.org/zcml"\n'
        '    xmlns:browser="http://namespaces.zope.org/browser"',
    )

marker = "  <!-- Sticker adapter for Samples -->"
insertion = (
    "  <!-- Custom view invoking SENAITE's real Analysis.calculateResult()\n"
    "       engine over REST - see analysis_calculate_view.py docstring.\n"
    "       Registered for BOTH IRoutineAnalysis (regular samples) and\n"
    "       IReferenceAnalysis (Blank/Control QC rows) - ReferenceAnalysis\n"
    "       implements only IReferenceAnalysis, not IRoutineAnalysis, so a\n"
    "       Control row's Calculation-backed analysis 404'd without this\n"
    "       second registration (confirmed live). -->\n"
    "  <browser:page\n"
    "      name=\"calculate-analysis-result\"\n"
    "      for=\"bika.lims.interfaces.IRoutineAnalysis\"\n"
    "      class=\".analysis_calculate_view.CalculateAnalysisResultView\"\n"
    "      permission=\"senaite.core.permissions.EditResults\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"calculate-analysis-result\"\n"
    "      for=\"bika.lims.interfaces.IReferenceAnalysis\"\n"
    "      class=\".analysis_calculate_view.CalculateAnalysisResultView\"\n"
    "      permission=\"senaite.core.permissions.EditResults\"\n"
    "      />\n"
    "  <!-- SelfVerification is snapshotted onto each Analysis from its Service\n"
    "       at create time, not read live - updating the Service afterward\n"
    "       never affects already-created analyses, and the generic REST\n"
    "       v1/update path rejects writing this field directly. This view\n"
    "       bypasses that guard for backfilling pre-existing analyses.\n"
    "       Uses zope2.View (not senaite.core.permissions.EditResults, used by\n"
    "       the calculate-analysis-result views above) - EditResults is\n"
    "       explicitly revoked for every role once an analysis reaches\n"
    "       'to_be_verified' (confirmed live: even the admin service account\n"
    "       got Unauthorized), which is exactly the state this backfill needs\n"
    "       to run against. -->\n"
    "  <browser:page\n"
    "      name=\"set-self-verification\"\n"
    "      for=\"bika.lims.interfaces.IRoutineAnalysis\"\n"
    "      class=\".analysis_calculate_view.SetSelfVerificationView\"\n"
    "      permission=\"zope2.View\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"set-self-verification\"\n"
    "      for=\"bika.lims.interfaces.IReferenceAnalysis\"\n"
    "      class=\".analysis_calculate_view.SetSelfVerificationView\"\n"
    "      permission=\"zope2.View\"\n"
    "      />\n"
    "\n"
)

if "analysis_calculate_view" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml (analysis calculate view)")
else:
    print("already patched")
