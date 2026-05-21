"""
Batch download jAccount captchas and run ONNX model recognition.
Saves results in captcha_samples/ folder for visual comparison.
"""
import urllib.request, re, io, os, sys, time
from PIL import Image, ImageDraw, ImageFont
import onnxruntime as ort
import numpy as np

OUT_DIR = os.path.join(os.path.dirname(__file__) or '.', 'captcha_samples')
os.makedirs(OUT_DIR, exist_ok=True)

CHARS = 'abcdefghijklmnopqrstuvwxyz'

# Binary threshold table: values < 156 → 0, values >= 156 → 1
BIN_TABLE = [0] * 156 + [1] * 100

def preprocess(img: Image.Image, W: int, H: int) -> np.ndarray:
    """Preprocess captcha image: grayscale → binary threshold → resize → tensor"""
    img = img.convert('L')           # grayscale
    img = img.point(BIN_TABLE, '1')  # binary threshold
    img = img.resize((W, H), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)  # 0.0 or 1.0
    arr = arr.reshape(1, 1, H, W)
    return arr

def decode_output(output):
    result = ''
    for i, o in enumerate(output):
        logits = o.flatten()
        max_idx = int(np.argmax(logits))
        nc = len(logits)
        if i == len(output) - 1 and max_idx == nc - 1:
            break
        if max_idx < len(CHARS):
            result += CHARS[max_idx]
    return result

# Setup HTTP
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
opener.addheaders = [('User-Agent','Mozilla/5.0'), ('Referer','https://jaccount.sjtu.edu.cn/')]

# Load model
print("[1] Loading ONNX model...")
model_path = os.path.join(os.path.dirname(__file__) or '.', 'frontend', 'assets', 'nn_model.onnx')
session = ort.InferenceSession(model_path)
input_name = session.get_inputs()[0].name
out_names = [o.name for o in session.get_outputs()]
W, H = session.get_inputs()[0].shape[3], session.get_inputs()[0].shape[2]
print(f"    Model input: {input_name} [{1}, {1}, {H}, {W}]")

# Download multiple captchas
NUM_SAMPLES = 10
print(f"\n[2] Downloading {NUM_SAMPLES} captchas...")

results = []

for i in range(NUM_SAMPLES):
    try:
        # Get fresh UUID for each captcha
        resp = opener.open(
            'https://jaccount.sjtu.edu.cn/oauth2/authorize?scope=essential&response_type=code&redirect_uri=http://i.sjtu.edu.cn/jaccountlogin&client_id=MVJGw8u0bzoMJVbfb4Fk'
        )
        html = resp.read().decode('utf-8','ignore')
        
        m = re.search(r'uuid:\s*"([^"]+)"', html)
        if not m:
            print(f"    [{i+1}] No UUID, skipping")
            continue
            
        uuid = m.group(1)
        captcha_url = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}'
        
        resp2 = opener.open(captcha_url)
        img_data = resp2.read()
        img = Image.open(io.BytesIO(img_data))
        
        # Run recognition
        img_gray = img.convert('L').point(BIN_TABLE, '1').resize((W, H), Image.LANCZOS)
        arr = np.array(img_gray, dtype=np.float32).reshape(1, 1, H, W)
        output = session.run(out_names, {input_name: arr})
        pred = decode_output(output)
        
        # Save original captcha
        fname = f"captcha_{i+1:02d}_{pred}.png"
        img.save(os.path.join(OUT_DIR, fname))
        
        results.append((i+1, pred, img.size))
        print(f"    [{i+1}] {pred} ({img.size[0]}x{img.size[1]}) -> {fname}")
        
        time.sleep(0.3)  # be nice to server
        
    except Exception as e:
        print(f"    [{i+1}] Error: {str(e)[:50]}")
        time.sleep(0.5)

# Print summary
print(f"\n{'='*60}")
print(f"  Results saved to: {OUT_DIR}/")
print(f"{'='*60}")
print(f"  {'#':>3}  {'Predicted':<12}  {'File':<30}")
print(f"  {'-'*50}")
for num, pred, size in results:
    fname = f"captcha_{num:02d}_{pred}.png"
    print(f"  {num:>3}  {pred:<12}  {fname:<30}")
print(f"{'='*60}")
print(f"\nOpen captcha_samples/ folder and compare each image with its predicted text!")
