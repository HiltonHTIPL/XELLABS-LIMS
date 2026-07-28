#!/bin/bash
# Re-applies the custom plone.restapi deserializer for
# SampleType.admitted_sticker_templates after a SENAITE container recreation.
# See CLAUDE.md section 16b for background — the legacy @@API/senaite/v1
# create/update endpoints silently drop retention_period and
# admitted_sticker_templates (no adapter for DurationField/DataGridField on
# that path); this file adds the missing plone.restapi field deserializer so
# those two fields can be set via a direct PATCH to the object's own URL.
set -e

EGG=/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg
ADAPTERS_DIR=$EGG/senaite/core/adapters

cp /tmp/sampletype_stickers_deserializer.py "$ADAPTERS_DIR/sampletype_stickers_deserializer.py"

python2.7 - <<'PYEOF'
path = "/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/adapters/configure.zcml"
with open(path, 'r') as f:
    content = f.read()

marker = '  <!-- Sticker adapter for Samples -->'
insertion = '''  <!-- Custom deserializer for SampleType.admitted_sticker_templates —
       plone.restapi has no built-in deserializer for this DataGridField,
       causing PATCH/POST to always fail schema validation. -->
  <adapter factory=".sampletype_stickers_deserializer.SampleTypeStickerTemplatesFieldDeserializer" />

'''
if 'sampletype_stickers_deserializer' not in content:
    content = content.replace(marker, insertion + marker)
    with open(path, 'w') as f:
        f.write(content)
    print('patched configure.zcml')
else:
    print('configure.zcml already patched')
PYEOF

echo "Done — restart the senaite container to load the new adapter."
