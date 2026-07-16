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
    "  <!-- Custom views bypassing Client's broken Address country/state/\n"
    "       district inline_field_validator (needs a REQUEST no REST path ever\n"
    "       supplies) when writing via the JSON REST API. See\n"
    "       client_address_views.py docstring. -->\n"
    "  <browser:page\n"
    "      name=\"create-client-safe\"\n"
    "      for=\"bika.lims.interfaces.IClientFolder\"\n"
    "      class=\".client_address_views.CreateClientView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"update-client-safe\"\n"
    "      for=\"bika.lims.interfaces.IClient\"\n"
    "      class=\".client_address_views.UpdateClientView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "\n"
)

if "client_address_views" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml for client address views")
else:
    print("already patched")
