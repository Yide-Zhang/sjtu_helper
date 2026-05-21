import urllib.request, re, io, os, sys
from PIL import Image
import onnxruntime as ort
import numpy as np

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
opener.addheaders = [('User-Agent','Mozilla/5.0'), ('Referer','https://jaccount.sjtu.edu.cn/')]

print("[1] Loading login page...")
resp = opener.open('https://jaccount.sjtu.edu.cn/oauth2/authorize?scope=essential&response_type=code&redirect_uri=http://i.sjtu.edu.cn/jaccountlogin&client_id=MVJGw8u0bzoMJVbfb4Fk')
html = resp.read().decode('utf-8','ignore')

m = re.search(r'uuid:\s*"([^"]+)"', html)
if not m:
    print("ERROR: No UUID found")
    sys.exit(1)
uuid = m.group(1)
print(f"UUID: {uuid}")

captcha_url = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}'
print(f"[2] Downloading: {captcha_url}")
resp2 = opener.open(captcha_url)
img_data = resp2.read()
print(f"Got {len(img_data)} bytes")
img = Image.open(io.BytesIO(img_data))
print(f"Size: {img.size}")

out = os.path.join(os.path.dirname(__file__) or '.', 'captcha_test.png')
img.save(out)
print(f"Saved to {out}")

print("[3] Loading model...")
model_path = os.path.join(os.path.dirname(__file__) or '.', 'frontend', 'assets', 'nn_model.onnx')
session = ort.InferenceSession(model_path)
input_name = session.get_inputs()[0].name
out_names = [o.name for o in session.get_outputs()]
shape = session.get_inputs()[0].shape
print(f"Input: {input_name} {shape}")

W, H = shape[3], shape[2]
img_gray = img.convert('L').resize((W, H), Image.LANCZOS)
arr = np.array(img_gray, dtype=np.float32).reshape(1, 1, H, W) / 255.0

output = session.run(out_names, {input_name: arr})
CHARS = 'abcdefghijklmnopqrstuvwxyz'
result = ''
for i, o in enumerate(output):
    logits = o.flatten()
    max_idx = int(np.argmax(logits))
    nc = len(logits)
    if i == len(output) - 1 and max_idx == nc - 1: break
    if max_idx < len(CHARS): result += CHARS[max_idx]

print(f"\n{'='*50}")
print(f"  PREDICTED: {result}")
print(f"{'='*50}")
print(f"Open captcha_test.png and compare!")
