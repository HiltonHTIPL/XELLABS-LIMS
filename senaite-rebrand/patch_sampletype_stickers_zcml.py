path = "/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/adapters/configure.zcml"
with open(path, "r") as f:
    content = f.read()

marker = "  <!-- Sticker adapter for Samples -->"
insertion = (
    "  <!-- Custom deserializer for SampleType.admitted_sticker_templates -\n"
    "       plone.restapi has no built-in deserializer for this DataGridField,\n"
    "       causing PATCH/POST to always fail schema validation. -->\n"
    "  <adapter factory=\".sampletype_stickers_deserializer.SampleTypeStickerTemplatesFieldDeserializer\" />\n"
    "\n"
)

if "sampletype_stickers_deserializer" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml")
else:
    print("already patched")
