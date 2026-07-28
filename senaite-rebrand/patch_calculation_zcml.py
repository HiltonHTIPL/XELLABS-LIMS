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
    "  <!-- Custom views bypassing Calculation.Formula's broken\n"
    "       request.form-based validator (formulavalidator) when writing via\n"
    "       the JSON REST API. See calculation_views.py docstring. -->\n"
    "  <browser:page\n"
    "      name=\"create-calculation\"\n"
    "      for=\"bika.lims.interfaces.ICalculations\"\n"
    "      class=\".calculation_views.CreateCalculationView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"update-calculation\"\n"
    "      for=\"bika.lims.interfaces.calculation.ICalculation\"\n"
    "      class=\".calculation_views.UpdateCalculationView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"test-calculation\"\n"
    "      for=\"bika.lims.interfaces.calculation.ICalculation\"\n"
    "      class=\".calculation_views.TestCalculationView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "\n"
)

if "calculation_views" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml")
else:
    print("already patched")
