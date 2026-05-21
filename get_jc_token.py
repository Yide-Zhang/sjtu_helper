"""
Get jAccount-Canvas token (session cookie) via full login flow.
Usage: python get_jc_token.py
"""

import urllib.request
import urllib.parse
import http.cookiejar
import re
import io
import sys
import os
import ssl
import json
import time

from PIL import Image
import numpy as np

# --- ONNX captcha model ---
CHARS = 'abcdefghijklmnopqrstuvwxyz'
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'frontend', 'assets', 'nn_model.onnx')

def load_model():
    import onnxruntime as ort
    return ort.InferenceSession(MODEL_PATH)

def preprocess(img):
    """Match the RN captcha.ts preprocessing exactly: grayscale → binary threshold (>=156)"""
    img = img.convert('L').resize((110, 40), Image.LANCZOS)
    pixels = np.array(img, dtype=np.float32)
    # Binary threshold at 156 (white >= 156 → 1.0, black < 156 → 0.0)
    binary = np.where(pixels >= 156, 1.0, 0.0).astype(np.float32)
    return binary.reshape(1, 1, 40, 110)

def decode_output(output):
    result = ''
    for i, logits in enumerate(output):
        if isinstance(logits, list):
            logits = np.array(logits)
        max_idx = int(np.argmax(logits))
        num_classes = logits.shape[-1]
        if i == len(output) - 1 and max_idx == num_classes - 1:
            break
        if max_idx < len(CHARS):
            result += CHARS[max_idx]
    return result

def recognize_captcha(model, img_data):
    img = Image.open(io.BytesIO(img_data))
    tensor = preprocess(img)
    outputs = model.run(None, {'input.1': tensor})
    return decode_output(outputs)

# ---- HTTP helpers ----
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cj),
    urllib.request.HTTPSHandler(context=ctx)
)
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]

def http_get(url, referer=None):
    req = urllib.request.Request(url)
    if referer:
        req.add_header('Referer', referer)
    return opener.open(req, timeout=30)

def http_post(url, data):
    d = urllib.parse.urlencode(data).encode()
    return opener.open(url, data=d, timeout=30)

# ---- Main ----
JC_USER = 'yddd19952193983'
JC_PASS = '20050018zxs'

print('=== Step 1: Canvas login page -> click jAccount ===')
r = http_get('https://oc.sjtu.edu.cn/login/canvas')
html = r.read().decode('utf-8', errors='ignore')

m = re.search(r'href="(/login/openid_connect[^"]*)"', html)
if not m:
    print('ERROR: No jAccount link')
    sys.exit(1)

jaccount_url = 'https://oc.sjtu.edu.cn' + m.group(1)

# Follow to jAccount authorize
r = http_get(jaccount_url)
print(f'Authorize redirect: {r.url[:80]}')

# Follow to jAccount login
r = http_get(r.url)
html = r.read().decode('utf-8', errors='ignore')
print(f'Login page: {r.url[:80]}')
assert 'jalogin' in r.url, f'Not on jalogin page: {r.url}'

# Extract context
sid = re.search(r'sid:\s*"([^"]+)"', html).group(1)
client = re.search(r'client:\s*"([^"]+)"', html).group(1)
returl = re.search(r'returl:\s*"([^"]+)"', html).group(1)
se = re.search(r'se:\s*"([^"]+)"', html).group(1)
uuid = re.search(r'uuid:\s*"([^"]+)"', html).group(1)
print(f'UUID: {uuid}')

print('\n=== Step 2: Get captcha ===')
captcha_url = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}&t={int(time.time()*1000)}'
r = http_get(captcha_url, referer='https://jaccount.sjtu.edu.cn/jaccount/jalogin')
captcha_data = r.read()
print(f'Captcha: {len(captcha_data)} bytes')

# Save for debug
with open('E:/SJTU/sjtu_helper/captcha_debug.png', 'wb') as f:
    f.write(captcha_data)

# Recognize
print('Loading ONNX model...')
model = load_model()
captcha_text = recognize_captcha(model, captcha_data)
print(f'Captcha text: [{captcha_text}]')

if not captcha_text:
    print('Retrying with fresh captcha...')
    time.sleep(1)
    captcha_url = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}&t={int(time.time()*1000)}'
    r = http_get(captcha_url, referer='https://jaccount.sjtu.edu.cn/jaccount/jalogin')
    captcha_data = r.read()
    captcha_text = recognize_captcha(model, captcha_data)
    print(f'Captcha text (retry): [{captcha_text}]')

print('\n=== Step 3: Submit login ===')
login_data = {
    'sid': sid, 'client': client, 'returl': returl, 'se': se,
    'v': '', 'uuid': uuid, 'user': JC_USER, 'pass': JC_PASS,
    'captcha': captcha_text, 'lt': 'p'
}
r = http_post('https://jaccount.sjtu.edu.cn/jaccount/ulogin', login_data)
resp = r.read().decode('utf-8')
print(f'Login response: {resp[:200]}')

result = json.loads(resp)
if result.get('errno') != 0:
    print(f'FAIL: Login failed: {result.get("error")}')
    sys.exit(1)

redirect_url = result.get('url')
if redirect_url and redirect_url.startswith('/'):
    redirect_url = 'https://jaccount.sjtu.edu.cn' + redirect_url
print(f'OK: Login success, redirect URL: {(redirect_url[:100] if redirect_url else "none")}')

print('\n=== Step 4: Follow redirects back to Canvas ===')
r = http_get(redirect_url)
print(f'Redirect: status={r.status}, url={r.url[:100]}')

html = r.read().decode('utf-8', errors='ignore')
title_m = re.search(r'<title>([^<]+)', html)
print(f'Page title: {title_m.group(1) if title_m else "N/A"}')

# Follow more redirects until we reach Canvas
max_follow = 10
for i in range(max_follow):
    if '/login/oauth2/callback' in r.url or '/login/' in r.url:
        print(f'  Follow {i+1}: {r.url[:80]}')
        r = http_get(r.url)
        html = r.read().decode('utf-8', errors='ignore')
    else:
        break

print(f'Final URL: {r.url[:100]}')

# Print Canvas cookies
print('\n=== Canvas Cookies ===')
canvas_cookies = []
for c in cj:
    if 'oc.sjtu' in c.domain:
        canvas_cookies.append(f'  {c.name} = {c.value[:60]}')
        print(canvas_cookies[-1])

if not canvas_cookies:
    print('  (no Canvas cookies found)')

print('\n=== Step 5: Access LTI tool ===')
lti_url = 'https://oc.sjtu.edu.cn/courses/87080/external_tools/6650'
r = http_get(lti_url)
print(f'LTI page: status={r.status}, url={r.url[:80]}')
lti_html = r.read().decode('utf-8', errors='ignore')

if '/login' in r.url:
    print('FAIL: Canvas session NOT established - redirected to login')
    sys.exit(1)

print('OK: Canvas session active')

# Find rollcall URL/token in the LTI page
token_match = re.search(r'token=([a-zA-Z0-9_\-]{20,})', lti_html)
if token_match:
    token = token_match.group(1)
    print(f'\nRollcall token found: {token[:60]}...')
    
    # Test API with this token (use it as Referer or query param)
    api_url = 'https://mlearning.sjtu.edu.cn/lms-lti-rollcall-sjtu/rollcall/existentB?courseCode=87080'
    try:
        r = http_get(api_url, referer='https://mlearning.sjtu.edu.cn/lms/rollcall/' + token)
        api_result = r.read().decode('utf-8', errors='ignore')
        print(f'API response: {api_result[:200]}')
    except Exception as e:
        print(f'API call failed: {e}')
else:
    print('No rollcall token directly in page (may be in LTI form)')
    # Look for mlearning URLs
    m_urls = re.findall(r'https://mlearning[^"\'\s]+', lti_html)
    for mu in m_urls[:3]:
        print(f'  mlearning URL: {mu[:100]}')

print('\n=== FINAL COOKIES ===')
for c in cj:
    domain_key = c.domain.split('.')[-2] + '.' + c.domain.split('.')[-1] if len(c.domain.split('.')) >= 2 else c.domain
    print(f'  [{domain_key}] {c.name} = {c.value[:60]}')

    
    # Check if there's an iframe with the tool
    iframe_src = re.search(r'id="tool_content"[^>]+src="([^"]+)"', lti_html)
    if iframe_src:
        print(f'LTI iframe src: {iframe_src.group(1)[:80]}...')

print('\n=== Step 6: Test rollcall API ===')
# The LTI form has a POST action to mlearning
form_actions = re.findall(r'https://mlearning[^"]+', lti_html)
for fa in form_actions:
    print(f'  mlearning URL: {fa[:100]}')
    if 'token=' in fa:
        token = re.search(r'token=([^&\s"]+)', fa).group(1)
        print(f'  Token: {token[:60]}...')
        # Test API with this token
        api_url = 'https://mlearning.sjtu.edu.cn/lms-lti-rollcall-sjtu/rollcall/existentB?courseCode=87080'
        try:
            r = http_get(api_url)
            print(f'  API response: {r.read().decode("utf-8", errors="ignore")[:200]}')
        except Exception as e:
            print(f'  API error: {e}')

print('\n=== FINAL COOKIES ===')
for c in cj:
    print(f'{c.domain} | {c.name} = {c.value[:60]}')
