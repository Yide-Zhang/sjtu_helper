"""
批量下载邮箱验证码并用 ONNX 模型识别
结果保存到 mail_captcha_test/ 目录
"""
import io, json, re, os, sys, urllib.parse, warnings, time
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
import onnxruntime as ort
import requests

os.makedirs('mail_captcha_test', exist_ok=True)

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
CHARS = 'abcdefghijklmnopqrstuvwxyz'
sess = requests.Session()
sess.headers.update({'User-Agent': UA})

# 加载模型
model_path = r'E:\SJTU\sjtu_helper\frontend\assets\nn_model.onnx'
model = ort.InferenceSession(model_path)

def preprocess(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB').resize((110, 40), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    gray = arr[:,:,0]*0.299 + arr[:,:,1]*0.587 + arr[:,:,2]*0.114
    binary = (gray >= 156).astype(np.float32)
    return binary.reshape(1, 1, 40, 110)

def decode(outputs):
    result = ''
    for i, out in enumerate(outputs):
        mx = int(np.argmax(out[0]))
        if i == 4 and mx == len(out[0]) - 1: break
        if mx < len(CHARS): result += CHARS[mx]
    return result

def get_login_page():
    """获取 jAccount 登录页并返回 uuid/returl/se"""
    # 从 mail 触发重定向链
    for url in ['https://mail.sjtu.edu.cn/zimbra/mail']:
        r = sess.get(url, allow_redirects=False)
        loc = r.headers.get('Location', '')
        if loc:
            r = sess.get(loc if loc.startswith('http') else f'https://mail.sjtu.edu.cn{loc}',
                        allow_redirects=False)
            loc2 = r.headers.get('Location', '')
            if loc2:
                r = sess.get(loc2 if loc2.startswith('http') else f'https://mail.sjtu.edu.cn{loc2}',
                            allow_redirects=False)
                html = r.text
                get_js = lambda k: (m:=re.search(rf'{k}:\s*"([^"]*)"', html)) and m.group(1) or ''
                return get_js('uuid'), get_js('returl'), get_js('se')
    return None, None, None

# 下载 10 张验证码
print('=== 批量验证码测试 ===\n')
results = []
for i in range(10):
    print(f'[{i+1}/10] 获取登录页...', end=' ')
    uuid, returl, se = get_login_page()
    if not uuid:
        print('❌ 获取 uuid 失败')
        continue
    print(f'uuid={uuid[:8]}...', end=' ')
    
    # 下载验证码
    captcha_url = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}&t={int(time.time()*1000)}'
    r = sess.get(captcha_url, headers={'Referer': 'https://jaccount.sjtu.edu.cn/'})
    img_bytes = r.content
    
    # 保存原始图片
    fname = f'mail_captcha_test/{i+1:02d}.png'
    with open(fname, 'wb') as f:
        f.write(img_bytes)
    
    # 模型识别
    input_tensor = preprocess(img_bytes)
    outputs = model.run(None, {'input.1': input_tensor})
    captcha = decode(outputs)
    
    print(f'识别: "{captcha}" 已保存 {fname}')
    results.append((i+1, captcha, fname))

# 汇总
print('\n=== 汇总 ===')
print(f'共下载 {len(results)} 张验证码\n')
for idx, captcha, fname in results:
    status = '✅' if len(captcha) >= 4 else '❌'
    print(f'  {status} [{idx:02d}] {fname}: "{captcha}"')

print(f'\n图片已保存到 mail_captcha_test/ 目录，请查看识别是否准确。')
print('如果大多数识别正确，说明模型对邮箱验证码也有效。')
