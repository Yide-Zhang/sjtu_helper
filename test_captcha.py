"""
Test script: fetch jAccount captcha images and run ONNX model recognition.
"""
import onnxruntime as ort
import numpy as np
from PIL import Image
import urllib.request
import re
import io
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'frontend', 'assets', 'nn_model.onnx')
CHARS = 'abcdefghijklmnopqrstuvwxyz'

def load_model():
    session = ort.InferenceSession(MODEL_PATH)
    return session

def preprocess(img: Image.Image) -> np.ndarray:
    """Convert PIL Image to model input tensor [1,1,40,100]"""
    img = img.convert('L')  # grayscale
    img = img.resize((100, 40), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    # Input shape: [1, 1, 40, 100] (NCHW)
    arr = arr.reshape(1, 1, 40, 100)
    return arr

def decode_output(output: dict) -> str:
    """Decode model output (5 tensors) to string"""
    keys = sorted(output.keys())
    result = ''
    for i, k in enumerate(keys):
        logits = output[k]
        if isinstance(logits, list):
            logits = np.array(logits)
        max_idx = int(np.argmax(logits))
        num_classes = logits.shape[-1]
        # Last position: index num_classes-1 is blank
        if i == len(keys) - 1 and max_idx == num_classes - 1:
            break
        if max_idx < len(CHARS):
            result += CHARS[max_idx]
    return result

def fetch_captcha_urls(session, count=10):
    """Fetch captcha image URLs from jAccount login page"""
    import urllib.request
    import xml.etree.ElementTree as ET
    
    # First get the login page to establish cookies
    login_url = 'https://jaccount.sjtu.edu.cn/oauth2/authorize?scope=essential&response_type=code&redirect_uri=http://i.sjtu.edu.cn/jaccountlogin&client_id=MVJGw8u0bzoMJVbfb4Fk'
    
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor()
    )
    opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')]
    
    resp = opener.open(login_url)
    html = resp.read().decode('utf-8', errors='ignore')
    
    # Find captcha image URL in the page
    captcha_urls = []
    # Pattern: /jaccount/captcha?uuid=...&t=...
    matches = re.findall(r'(/jaccount/captcha\?[^"\' ]+)', html)
    for m in matches:
        full_url = 'https://jaccount.sjtu.edu.cn' + m
        captcha_urls.append(full_url)
    
    # If we didn't find any, try to extract from various patterns
    if not captcha_urls:
        matches = re.findall(r'(captcha[^"\' ]+\.(?:jpg|png|gif|jpeg))', html, re.I)
        for m in matches:
            if m.startswith('http'):
                captcha_urls.append(m)
            elif m.startswith('/'):
                captcha_urls.append('https://jaccount.sjtu.edu.cn' + m)
    
    # Fetch multiple captchas (each request gives a new one)
    urls = []
    for _ in range(count):
        if captcha_urls:
            url = captcha_urls[0]  # same base URL, server generates new captcha each time
        else:
            # Fallback: try the captcha endpoint directly
            url = 'https://jaccount.sjtu.edu.cn/jaccount/captcha'
        # Add a unique timestamp to force fresh captcha
        import time
        sep = '&' if '?' in url else '?'
        url_with_ts = f"{url}{sep}_t={int(time.time() * 1000)}"
        urls.append(url_with_ts)
        time.sleep(0.3)  # be nice to the server
    
    return opener, urls

def main():
    print("=" * 60)
    print("jAccount Captcha Solver - Model Test")
    print("=" * 60)
    
    # Load model
    print("\n[1] Loading ONNX model...")
    model = load_model()
    print(f"    Model loaded: {MODEL_PATH}")
    print(f"    Input name: {model.get_inputs()[0].name}")
    print(f"    Input shape: {model.get_inputs()[0].shape}")
    print(f"    Output names: {[o.name for o in model.get_outputs()]}")
    
    # Fetch captchas
    print("\n[2] Fetching captcha images from jAccount...")
    opener, captcha_urls = fetch_captcha_urls(None)
    print(f"    Got {len(captcha_urls)} captcha URLs")
    
    # Test each captcha
    print("\n[3] Recognition results:")
    print("-" * 60)
    print(f"{'#':>3}  {'Predicted':<12}  {'Status':<10}")
    print("-" * 60)
    
    correct = 0
    total = 0
    
    for i, url in enumerate(captcha_urls):
        try:
            resp = opener.open(url)
            img_data = resp.read()
            img = Image.open(io.BytesIO(img_data))
            
            # Save image for visual inspection
            save_path = os.path.join(os.path.dirname(__file__), f'captcha_{i+1}.png')
            img.save(save_path)
            
            # Run inference
            input_tensor = preprocess(img)
            output = model.run(None, {model.get_inputs()[0].name: input_tensor})
            
            # Convert output list to dict with names
            output_dict = {}
            for j, o in enumerate(model.get_outputs()):
                output_dict[o.name] = output[j]
            
            result = decode_output(output_dict)
            
            print(f"{i+1:>3}  {result:<12}  {'✅' if len(result) >= 4 else '⚠️ short'}")
            total += 1
            
        except Exception as e:
            print(f"{i+1:>3}  {'ERROR':<12}  {str(e)[:30]}")
    
    print("-" * 60)
    print(f"\nTested {total} captchas. Images saved as captcha_*.png")
    print("\nOpen the captcha_*.png files and compare with predicted text above!")
    print("=" * 60)

if __name__ == '__main__':
    main()
