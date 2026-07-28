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
    "  <!-- Custom view pushing Django-side Specification ranges onto a live\n"
    "       AnalysisRequest via SENAITE's real setResultsRange() - see\n"
    "       analysisrequest_specification_view.py docstring. -->\n"
    "  <browser:page\n"
    "      name=\"set-results-range\"\n"
    "      for=\"bika.lims.interfaces.IAnalysisRequest\"\n"
    "      class=\".analysisrequest_specification_view.SetResultsRangeView\"\n"
    "      permission=\"senaite.core.permissions.FieldEditSpecification\"\n"
    "      />\n"
    "\n"
)

if "analysisrequest_specification_view" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml (set-results-range view)")
else:
    print("already patched")
