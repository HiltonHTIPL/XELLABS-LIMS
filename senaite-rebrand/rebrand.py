import urllib2
import urllib
import cookielib

jar = cookielib.CookieJar()
opener = urllib2.build_opener(urllib2.HTTPCookieProcessor(jar))

# Login
data = urllib.urlencode({'__ac_name': 'admin', '__ac_password': 'admin', 'form.submitted': '1'})
try:
    opener.open('http://localhost:8080/senaite/login', data)
    print('Logged in')
except Exception as e:
    print('Login error: ' + str(e))

# Change site title via site-controlpanel
data = urllib.urlencode({
    'site_title': 'XelLabs',
    'site_description': 'XelLabs Laboratory Information Management System',
    'form.submitted': '1',
    'form.button.save': 'Save'
})
try:
    resp = opener.open('http://localhost:8080/senaite/@@site-controlpanel', data)
    print('Site title changed: ' + str(resp.getcode()))
except Exception as e:
    print('Title error: ' + str(e))

print('Rebranding complete')
