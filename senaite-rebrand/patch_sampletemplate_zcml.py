path = "/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/adapters/configure.zcml"
with open(path, "r") as f:
    content = f.read()

marker = "  <!-- Sticker adapter for Samples -->"
insertion = (
    "  <!-- Custom deserializer for SampleTemplate.partitions/services -\n"
    "       plone.restapi has no built-in deserializer for List(value_type=\n"
    "       DataGridRow(...)) fields, causing PATCH/POST to always fail\n"
    "       schema validation. -->\n"
    "  <adapter factory=\".sampletemplate_datagrid_deserializer.SampleTemplateDataGridFieldDeserializer\" />\n"
    "\n"
)

if "sampletemplate_datagrid_deserializer" not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml")
else:
    print("already patched")
