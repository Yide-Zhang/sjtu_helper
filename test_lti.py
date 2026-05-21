"""Test: complete login flow + LTI form submission + mlearning API"""
import urllib.request, urllib.parse, ssl, re, json, io, time, sys
import numpy as np
from PIL import Image
import onnxruntime as ort

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def http_get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=20, context=ctx)

def http_post(url, data, headers=None):
    h = {'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded'}
    if headers: h.update(headers)
    req = urllib.request.Request(url, data=data.encode() if isinstance(data, str) else data, headers=h)
    return urllib.request.urlopen(req, timeout=20, context=ctx)

print('=== 1. Canvas -> jAccount ===')
r = http_get('https://oc.sjtu.edu.cn/login/canvas')
html = r.read().decode()
m = re.search(r'href="(/login/openid_connect[^"]*)"', html)
if not m: print('ERROR: no jAccount link'); sys.exit(1)

r = http_get('https://oc.sjtu.edu.cn' + m.group(1))
r = http_get(r.url)  # Follow to jalogin
html = r.read().decode()

uuid = re.search(r'uuid:\s*"([^"]+)"', html).group(1)
print(f'UUID: {uuid}')

# Context
sid = re.search(r'sid:\s*"([^"]+)"', html).group(1)
client = re.search(r'client:\s*"([^"]+)"', html).group(1)
returl = re.search(r'returl:\s*"([^"]+)"', html).group(1)
se = re.search(r'se:\s*"([^"]+)"', html).group(1)

print('=== 2. Captcha ===')
cap_url = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}&t={int(time.time()*1000)}'
req = urllib.request.Request(cap_url, headers={
    'User-Agent': 'Mozilla/5.0', 'Referer': 'https://jaccount.sjtu.edu.cn/jaccount/jalogin'})
cap_data = urllib.request.urlopen(req, timeout=20, context=ctx).read()
print(f'Captcha: {len(cap_data)} bytes')

model = ort.InferenceSession('E:/SJTU/sjtu_helper/frontend/assets/nn_model.onnx')
img = Image.open(io.BytesIO(cap_data)).convert('L').resize((110, 40), Image.LANCZOS)
pixels = np.array(img, dtype=np.float32)
binary = np.where(pixels >= 156, 1.0, 0.0).astype(np.float32).reshape(1, 1, 40, 110)
outputs = model.run(None, {'input.1': binary})
chars = 'abcdefghijklmnopqrstuvwxyz'
captcha = ''
for i, o in enumerate(outputs):
    mx = int(np.argmax(o))
    if i == len(outputs)-1 and mx == o.shape[-1]-1: break
    if mx < len(chars): captcha += chars[mx]
print(f'Captcha text: [{captcha}]')

print('=== 3. Login ===')
data = urllib.parse.urlencode({
    'sid': sid, 'client': client, 'returl': returl, 'se': se,
    'v': '', 'uuid': uuid, 'user': 'yddd19952193983', 'pass': '20050018zxs',
    'captcha': captcha, 'lt': 'p'
})
r = http_post('https://jaccount.sjtu.edu.cn/jaccount/ulogin', data)
result = json.loads(r.read().decode())
if result.get('errno') != 0:
    print(f'FAIL: {result.get("error")}'); sys.exit(1)
print('OK: errno=0')

url = result['url']
if url.startswith('/'): url = 'https://jaccount.sjtu.edu.cn' + url

print('=== 4. Redirect to Canvas ===')
r = http_get(url)
for i in range(8):
    if '/login/' in r.url or '/oauth2/' in r.url:
        print(f'  Follow {i+1}: {r.url[:70]}...')
        r = http_get(r.url)
    else:
        break
print(f'Final URL: {r.url[:70]}')

print('=== 5. LTI tool ===')
r = http_get('https://oc.sjtu.edu.cn/courses/87080/external_tools/6650')
if '/login' in r.url:
    print('FAIL: no Canvas session')
    # Print all cookies we have
    print(f'Response URL: {r.url}')
    sys.exit(1)
lti_html = r.read().decode(errors='ignore')
print(f'OK: page loaded ({len(lti_html)} bytes)')

print('=== 6. Submit LTI form ===')
# Find ALL forms
forms = re.findall(r'<form[^>]+action="([^"]+)"[^>]*>', lti_html)
print(f'Forms found: {len(forms)}')

if not forms:
    print('No form found - maybe already redirected?')
    sys.exit(1)

action = forms[0].replace('&amp;', '&')
print(f'Action: {action[:80]}')

# Get all input fields from ALL forms
all_inputs = re.findall(r'<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"', lti_html)
print(f'Total inputs: {len(all_inputs)}')

# Find the form that goes to mlearning
mlearning_forms = [f for f in forms if 'mlearning' in f]
if mlearning_forms:
    action = mlearning_forms[0].replace('&amp;', '&')
    print(f'Using mlearning form: {action[:80]}')
else:
    action = forms[0].replace('&amp;', '&')
    print(f'Using first form (may not be mlearning)')

# Build form data
form_data = {}
for name, val in all_inputs:
    form_data[name] = val
print(f'Form data keys: {list(form_data.keys())[:5]}')

# Submit
try:
    encoded = urllib.parse.urlencode(form_data).encode()
    req = urllib.request.Request(action, data=encoded, headers={
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded'
    })
    r = urllib.request.urlopen(req, timeout=20, context=ctx)
    print(f'Submit: status={r.status}')
    print(f'URL: {r.url[:80]}')
    
    # Read body
    body = r.read(5000).decode(errors='ignore')
    
    if 'token=' in r.url:
        tok = re.search(r'token=([^&"\']+)', r.url).group(1)
        print(f'\nTOKEN FOUND: {tok[:60]}...')
    elif 'rollcall' in r.url:
        print(f'Redirected to rollcall: {r.url[:80]}')
        # Try API with this session
        print('\n=== 7. Test rollcall API ===')
        r2 = http_get('https://mlearning.sjtu.edu.cn/lms-lti-rollcall-sjtu/rollcall/existentB?courseCode=87080')
        print(f'API: {r2.read().decode()[:200]}')
    else:
        print(f'Response title hint: {re.search(r"<title>([^<]+)", body).group(1) if re.search(r"<title>([^<]+)", body) else "none"}')
except Exception as e:
    print(f'Submit error: {e}')
    import traceback
    traceback.print_exc()
