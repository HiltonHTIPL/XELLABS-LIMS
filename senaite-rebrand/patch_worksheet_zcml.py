path = "/home/senaite/senaitelims/eggs/cp27mu/senaite.core-2.6.0-py2.7.egg/senaite/core/adapters/configure.zcml"
with open(path, "r") as f:
    content = f.read()

if "xmlns:browser" not in content:
    content = content.replace(
        'xmlns:zcml="http://namespaces.zope.org/zcml"',
        'xmlns:zcml="http://namespaces.zope.org/zcml"\n'
        '    xmlns:browser="http://namespaces.zope.org/browser"',
    )

insertion = (
    "  <!-- Custom JSON views for the Worksheet flow. The AT Worksheet marks\n"
    "       `Analyses` required, so generic REST create fails; these replicate\n"
    "       SENAITE's native empty-create + applyWorksheetTemplate flow. See\n"
    "       worksheet_views.py docstring. -->\n"
    "  <browser:page\n"
    "      name=\"create-worksheet\"\n"
    "      for=\"bika.lims.interfaces.IWorksheetFolder\"\n"
    "      class=\".worksheet_views.CreateWorksheetView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"apply-worksheet-template\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.ApplyWorksheetTemplateView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"worksheet-info\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.WorksheetInfoView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"add-worksheet-analyses\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.AddAnalysesView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"remove-worksheet-analyses\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.RemoveAnalysesView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"add-worksheet-duplicate\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.AddDuplicateView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"add-worksheet-reference\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.AddReferenceView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"update-worksheet\"\n"
    "      for=\"bika.lims.interfaces.IWorksheet\"\n"
    "      class=\".worksheet_views.UpdateWorksheetView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "  <browser:page\n"
    "      name=\"lab-analysts\"\n"
    "      for=\"bika.lims.interfaces.IWorksheetFolder\"\n"
    "      class=\".worksheet_views.LabAnalystsView\"\n"
    "      permission=\"cmf.ModifyPortalContent\"\n"
    "      />\n"
    "\n"
)

if "worksheet_views" not in content:
    content = content.replace("</configure>", insertion + "</configure>")
    with open(path, "w") as f:
        f.write(content)
    print("patched configure.zcml (worksheet views)")
else:
    print("already patched (worksheet views)")
