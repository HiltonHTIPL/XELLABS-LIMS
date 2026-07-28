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
    "  <!-- Custom views bypassing the broken Address country/state/district\n"
    "       inline_field_validator on LabContact (from Person) and the\n"
    "       Laboratory singleton (from Organisation). Same root cause/bypass as\n"
    "       client_address_views.py. See labcontact_lab_views.py docstring. -->\n"
    "  <browser:page\n"
    "      name=\"create-labcontact-safe\"\n"
    "      for=\"bika.lims.interfaces.ILabContacts\"\n"
    "      class=\".labcontact_lab_views.CreateLabContactView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"update-labcontact-safe\"\n"
    "      for=\"bika.lims.interfaces.ILabContact\"\n"
    "      class=\".labcontact_lab_views.UpdateLabContactView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"update-laboratory-safe\"\n"
    "      for=\"bika.lims.interfaces.ILaboratory\"\n"
    "      class=\".labcontact_lab_views.UpdateLaboratoryView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "\n"
)

if "labcontact_lab_views" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml for labcontact/laboratory views")
else:
    print("already patched")
