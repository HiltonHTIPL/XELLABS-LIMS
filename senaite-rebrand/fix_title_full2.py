"""
Set SENAITE site title to XelLabs via the Plone site-controlpanel form.
Uses Basic Auth + CSRF token extraction + full form field replay.

Run with: docker exec senaite python2.7 /tmp/fix_title_full2.py
(after docker cp fix_title_full2.py senaite:/tmp/)
"""
import urllib2
import urllib
import base64
import re

auth = base64.b64encode('admin:admin')

def make_req(url, data=None):
    req = urllib2.Request(url, data)
    req.add_header('Authorization', 'Basic ' + auth)
    if data:
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    return urllib2.urlopen(req)

BASE = 'http://localhost:8080/senaite'

print('Fetching site-controlpanel...')
r = make_req(BASE + '/@@site-controlpanel')
html = r.read()

form_data = {}

# Extract all <input> fields
for m in re.finditer(r'<input([^>]*)>', html):
    attrs = m.group(1)
    name_m = re.search(r'name="([^"]*)"', attrs)
    value_m = re.search(r'value="([^"]*)"', attrs)
    type_m = re.search(r'type="([^"]*)"', attrs)
    if name_m:
        name = name_m.group(1)
        value = value_m.group(1) if value_m else ''
        input_type = type_m.group(1) if type_m else 'text'
        if input_type in ('submit', 'button', 'image', 'reset'):
            continue
        if input_type == 'checkbox' and 'checked' not in attrs:
            continue
        form_data[name] = value

# Extract all <select> fields with selected option values
for sel_m in re.finditer(r'<select([^>]*)>(.*?)</select>', html, re.DOTALL):
    sel_attrs = sel_m.group(1)
    sel_content = sel_m.group(2)
    name_m = re.search(r'name="([^"]*)"', sel_attrs)
    if name_m:
        sel_name = name_m.group(1)
        selected_m = re.search(r'<option([^>]*selected[^>]*)>', sel_content)
        if selected_m:
            val_m = re.search(r'value="([^"]*)"', selected_m.group(1))
            form_data[sel_name] = val_m.group(1) if val_m else ''
        else:
            first_m = re.search(r'<option([^>]*)>', sel_content)
            if first_m:
                val_m = re.search(r'value="([^"]*)"', first_m.group(1))
                if val_m:
                    form_data[sel_name] = val_m.group(1)

print('Extracted ' + str(len(form_data)) + ' form fields')
print('Current site_title: ' + form_data.get('form.widgets.site_title', '?'))

# Override just the site title
form_data['form.widgets.site_title'] = 'XelLabs'
form_data['form.buttons.save'] = 'Save'
form_data.pop('form.buttons.cancel', None)

data = urllib.urlencode(list(form_data.items()))
resp = make_req(BASE + '/@@site-controlpanel', data)
resp_html = resp.read()
print('Save: HTTP ' + str(resp.getcode()))
errs = re.findall(r'class="error"[^>]*>([^<]{1,100})<', resp_html)
if errs:
    print('Errors: ' + str(errs))
else:
    print('No errors - saved successfully')

# Verify
r = make_req(BASE)
html = r.read()
t_start = html.find('<title>')
t_end = html.find('</title>')
print('Page title: ' + html[t_start:t_end+8])
