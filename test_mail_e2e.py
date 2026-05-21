"""
邮件端到端测试：ONNX 识别验证码 → 登录 → SOAP 获取收件箱
用法: python test_mail_e2e.py
"""
import io, json, re, os, sys, urllib.parse, warnings, time
import numpy as np
from PIL import Image
warnings.filterwarnings('ignore')
import onnxruntime as ort
import requests

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
CHARS = 'abcdefghijklmnopqrstuvwxyz'

# 用 Session 自动管理 cookie
sess = requests.Session()
sess.headers.update({'User-Agent': UA})

def log(m): print(f'[TEST] {m}')
def ok(m): print(f'  ✅ {m}')
def fail(m): print(f'  ❌ {m}')
def step(n, title): print(f'\n=== Step {n}: {title} ===')

# ── ONNX ──
def load_model():
    p = r'E:\SJTU\sjtu_helper\frontend\assets\nn_model.onnx'
    if os.path.exists(p): return ort.InferenceSession(p)
    p = 'frontend/assets/nn_model.onnx'
    return ort.InferenceSession(p)

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

# ── 免重定向请求 ──
def req(method, url, **kw):
    kw.setdefault('headers', {})
    kw['headers'].setdefault('User-Agent', UA)
    kw.setdefault('allow_redirects', False)
    return sess.request(method, url, **kw)

def follow(url, max_steps=10):
    """手动跟踪重定向"""
    for i in range(max_steps):
        try:
            r = sess.get(url, allow_redirects=False, timeout=15)
        except Exception as e:
            log(f'  [{i}] 请求异常: {e}')
            return None
        log(f'  [{i}] {r.status_code} {url[:80]}')
        if r.headers.get('Set-Cookie'):
            log(f'  Cookie: {r.headers["Set-Cookie"][:120]}')
        zm = re.search(r'ZM_AUTH_TOKEN=([^;]+)', r.headers.get('Set-Cookie', ''))
        if zm:
            log(f'  ✅ ZM_AUTH_TOKEN 已找到: {zm.group(1)[:40]}...')
            return {'token': zm.group(1), 'status': r.status_code, 'text': r.text, 'headers': r.headers}
        loc = r.headers.get('Location')
        if not loc:
            return {'status': r.status_code, 'text': r.text, 'headers': r.headers}
        url = loc if loc.startswith('http') else f'https://mail.sjtu.edu.cn{loc}'
    return None

# ══════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════
def main():
    model = load_model()

    # ── 读凭据 ──
    for fn in ['jaccount.txt', 'token.txt']:
        try:
            lines = open(fn).read().strip().splitlines()
            if len(lines) >= 2:
                username, password = lines[0].strip(), lines[1].strip()
                break
        except: pass
    else:
        print('无凭据'); sys.exit(1)
    log(f'用户: {username}')

    # Step 1: 触发 mail 重定向链
    step(1, '触发邮件重定向')
    r = follow('https://mail.sjtu.edu.cn/zimbra/mail')
    if not r: fail('重定向链断裂'); return
    if r.get('token'): return test_soap(r['token'])  # 已有 token

    # Step 2: 解析 jAccount 登录页
    step(2, '解析登录表单')
    html = r.get('text', '')
    get_js = lambda k: (m:=re.search(rf'{k}:\s*"([^"]*)"', html)) and m.group(1) or ''
    returl = get_js('returl')
    se = get_js('se')
    uuid = get_js('uuid')
    if not uuid: fail(f'无法解析 uuid'); return
    log(f'uuid={uuid[:8]}... returl={returl[:20]}... se={se[:10]}...')

    # Step 3: 获取 + 识别验证码
    step(3, '验证码识别')
    cu = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}&t={int(time.time()*1000)}'
    cr = req('GET', cu, headers={'Referer': 'https://jaccount.sjtu.edu.cn/'})
    captcha_bytes = cr.content
    log(f'图片大小: {len(captcha_bytes)} bytes')

    input_tensor = preprocess(captcha_bytes)
    outputs = model.run(None, {'input.1': input_tensor})
    captcha = decode(outputs)
    log(f'识别结果: "{captcha}"')
    if not captcha: fail('识别失败'); return

    # Step 4: 提交登录（sid=jasjtumail 返回 302 而非 JSON!）
    step(4, 'POST ulogin')
    login_data = {
        'sid': 'jasjtumail',
        'client': '',
        'returl': returl,
        'se': se,
        'v': '',
        'uuid': uuid,
        'user': username,
        'pass': password,
        'captcha': captcha,
        'lt': 'p',
    }
    login_url = 'https://jaccount.sjtu.edu.cn/jaccount/ulogin'
    lr = req('POST', login_url,
             data=login_data,
             headers={
                 'Referer': f'https://jaccount.sjtu.edu.cn/jaccount/jalogin?sid=jasjtumail&returl={urllib.parse.quote(returl)}&se={urllib.parse.quote(se)}',
                 'Content-Type': 'application/x-www-form-urlencoded',
                 'X-Requested-With': 'XMLHttpRequest',
             })
    log(f'ulogin 状态: {lr.status_code}')
    log(f'Location: {lr.headers.get("Location", "(none)")}')
    
    # 检查重定向结果
    loc = lr.headers.get('Location', '')
    if lr.status_code == 302:
        if 'jatkt' in loc:
            ok('登录成功！（收到 jatkt 重定向）')
        elif 'err=1' in loc or 'err=2' in loc:
            fail(f'登录失败（err 标记），验证码识别可能不准')
            log(f'尝试次数: 第 1 次')
            # 重试几次
            for retry in range(5):
                log(f'--- 第 {retry+2} 次重试 ---')
                # 重新获取登录页（更新 uuid/returl/se）
                r2 = follow('https://mail.sjtu.edu.cn/zimbra/mail')
                if not r2: break
                html2 = r2.get('text', '')
                get_js2 = lambda k: (m2:=re.search(rf'{k}:\s*"([^"]*)"', html2)) and m2.group(1) or ''
                uuid2 = get_js2('uuid')
                returl2 = get_js2('returl')
                se2 = get_js2('se')
                if not uuid2: break
                # 新验证码
                cu2 = f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid2}&t={int(time.time()*1000)}'
                cr2 = req('GET', cu2, headers={'Referer': 'https://jaccount.sjtu.edu.cn/'})
                input_tensor2 = preprocess(cr2.content)
                outputs2 = model.run(None, {'input.1': input_tensor2})
                captcha2 = decode(outputs2)
                log(f'验证码: "{captcha2}"')
                # 重新提交
                lr2 = req('POST', login_url,
                          data={'sid': 'jasjtumail', 'client': '', 'returl': returl2, 'se': se2, 'v': '', 'uuid': uuid2,
                                'user': username, 'pass': password, 'captcha': captcha2, 'lt': 'p'},
                          headers={'Referer': f'https://jaccount.sjtu.edu.cn/jaccount/jalogin?sid=jasjtumail&returl={urllib.parse.quote(returl2)}&se={urllib.parse.quote(se2)}',
                                   'Content-Type': 'application/x-www-form-urlencoded',
                                   'X-Requested-With': 'XMLHttpRequest'})
                loc2 = lr2.headers.get('Location', '')
                log(f'ulogin 状态: {lr2.status_code}, Location: {loc2[:100]}')
                if 'jatkt' in loc2:
                    ok(f'第 {retry+2} 次登录成功！')
                    loc = loc2
                    break
                elif 'err=' in loc2:
                    continue
                else:
                    break
            else:
                fail('重试次数用尽')
                return
        else:
            log(f'未知重定向: {loc[:100]}')
    else:
        try:
            result = lr.json()
            log(f'JSON: {result}')
            if result.get('errno') != 0:
                fail(f'登录失败: {result.get("code", "未知")}')
                return
        except:
            fail(f'非 JSON 响应: {lr.text[:200]}')
            return

    # Step 5: 跟随 jatkt 获取 ZM_AUTH_TOKEN
    step(5, '获取 ZM_AUTH_TOKEN')
    
    if loc and 'jatkt' in loc:
        # ulogin 成功，直接跟随 jatkt
        jatkt_url = loc if loc.startswith('http') else f'https://jaccount.sjtu.edu.cn{loc}'
        log(f'跟随 jatkt: {jatkt_url[:100]}')
        r = follow(jatkt_url)
    else:
        # 尝试从 mail 首页重新出发
        r = follow('https://mail.sjtu.edu.cn/zimbra/mail')
    
    if r and r.get('token'):
        zm_token = r['token']
        ok(f'ZM_AUTH_TOKEN: {zm_token[:40]}...')
    else:
        fail('未获取到 ZM_AUTH_TOKEN')
        return

    # Step 6: 提取 CSRF token
    csrf = None
    if r.get('text'):
        m = re.search(r'csrfToken["\']?\s*[:=]\s*["\']([^"\']+)["\']', r['text'])
        if m: csrf = m.group(1)
    if not csrf:
        csrf = '_'.join(zm_token.split('_')[:2])
    ok(f'CSRF: {csrf}')

    # Step 7: SOAP API
    step(7, 'SOAP API 获取收件箱')
    test_soap(zm_token, csrf, username)


def test_soap(zm_token, csrf=None, username=None):
    if not csrf:
        csrf = '_'.join(zm_token.split('_')[:2])
    if not username:
        username = open('jaccount.txt').readline().strip()
    account = f'{username}@sjtu.edu.cn'

    body_xml = f'''<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
<soap:Header>
  <context xmlns="urn:zimbra">
    <userAgent name="ZimbraWebClient - Test" version="10.0.18_GA_4828"/>
    <session id=""/>
    <account by="name">{account}</account>
    <format type="js"/>
    <csrfToken>{csrf}</csrfToken>
  </context>
</soap:Header>
<soap:Body>
<BatchRequest xmlns="urn:zimbra" onerror="continue">
  <SearchRequest xmlns="urn:zimbraMail" requestId="0">
    <query>in:inbox</query>
    <types>message</types>
    <limit>10</limit>
    <offset>0</offset>
  </SearchRequest>
</BatchRequest>
</soap:Body>
</soap:Envelope>'''

    r = req('POST', 'https://mail.sjtu.edu.cn/service/soap/BatchRequest',
            data=body_xml.encode('utf-8'),
            headers={
                'Content-Type': 'application/soap+xml; charset=UTF-8',
                'Cookie': f'ZM_AUTH_TOKEN={zm_token}',
            })
    try:
        result = r.json()
        msgs = result.get('Body', {}).get('BatchResponse', {}).get('SearchRequest', [{}])[0].get('m', [])
        log(f'收件箱: {len(msgs)} 封邮件')
        if msgs:
            for m in msgs[:10]:
                log(f'  - {m.get("su", "(无主题)")} | {m.get("e", [{}])[0].get("a", "?") if m.get("e") else "?"}')
            ok('✅ SOAP API 工作正常！成功获取收件箱！')
        else:
            log('收件箱为空')
    except:
        fail(f'SOAP 失败: {r.text[:200]}')


if __name__ == '__main__':
    main()
