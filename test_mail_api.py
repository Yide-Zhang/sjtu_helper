"""
邮件 API 连通性测试脚本
用法: python test_mail_api.py
说明: 会读取 jaccount.txt 中的凭据，测试 jAccount → Zimbra 认证流程
"""

import re
import json
import urllib.request
import urllib.parse
import http.cookiejar
import sys
import os

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

def log(msg):
    print(f'[TEST] {msg}')

def fail(msg):
    print(f'[FAIL] {msg}')
    return False

def ok(msg):
    print(f'[OK] {msg}')
    return True

# ── Cookie 感知的 HTTP 客户端（持久化 cookie）──
COOKIE_FILE = 'test_mail_cookies.txt'

class HttpClient:
    def __init__(self):
        self.cookie_jar = http.cookiejar.LWPCookieJar()
        if os.path.exists(COOKIE_FILE):
            try:
                self.cookie_jar.load(COOKIE_FILE, ignore_discard=True, ignore_expires=True)
                log(f'加载了 {len(self.cookie_jar)} 个已保存的 cookie')
            except:
                pass
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPRedirectHandler,
            urllib.request.HTTPCookieProcessor(self.cookie_jar)
        )

    def save_cookies(self):
        self.cookie_jar.save(COOKIE_FILE, ignore_discard=True, ignore_expires=True)

    def get(self, url, headers=None):
        hdrs = {'User-Agent': UA}
        if headers: hdrs.update(headers)
        req = urllib.request.Request(url, headers=hdrs)
        return self.opener.open(req)

    def post(self, url, data, headers=None):
        hdrs = {'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'}
        if headers: hdrs.update(headers)
        body = data.encode() if isinstance(data, str) else urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(url, data=body, headers=hdrs)
        return self.opener.open(req)

    def post_xml(self, url, xml_body, extra_headers=None):
        hdrs = {'User-Agent': UA, 'Content-Type': 'application/soap+xml; charset=UTF-8'}
        if extra_headers: hdrs.update(extra_headers)
        req = urllib.request.Request(url, data=xml_body.encode('utf-8'), headers=hdrs)
        return self.opener.open(req)


# ══════════════════════════════════════════
# 测试 1: jAccount 登录
# ══════════════════════════════════════════
def test_jaccount_login(client, username, password):
    log('=== 测试 1: jAccount 登录 ===')

    # 先从 mail 首页触发重定向，获得正确的 returl/se
    log('访问 mail.sjtu.edu.cn/zimbra/mail 触发重定向...')
    try:
        resp = client.get('https://mail.sjtu.edu.cn/zimbra/mail')
        jaccount_url = resp.geturl()
        log(f'重定向至: {jaccount_url}')
    except Exception as e:
        # 重定向过程中可能有 HTTP 错误，但 cookie jar 仍有信息
        log(f'重定向完成（可能有预期错误: {e}）')

    # 检查 Cookie 中是否已有 ZM_AUTH_TOKEN
    for cookie in client.cookie_jar:
        if cookie.name == 'ZM_AUTH_TOKEN':
            log(f'已有 ZM_AUTH_TOKEN，无需登录')
            return True

    # 从 cookie 中找 jAccount 相关 cookie，看是否已有会话
    for cookie in client.cookie_jar:
        if 'jaccount' in cookie.domain:
            log(f'jAccount cookie: {cookie.name}={cookie.value[:20]}...')

    # 检查是否已登录（URL 不含 jaccount 说明已登录）
    if 'jaccount.sjtu.edu.cn' not in jaccount_url:
        log('已具有有效 jAccount 会话，无需重复登录')
        return True

    # 获取 jAccount 登录页
    try:
        resp = client.get(jaccount_url)
        html = resp.read().decode('utf-8')
        log(f'登录页状态码: {resp.getcode()}')
    except Exception as e:
        return fail(f'获取登录页失败: {e}')

    # 检查是否最终跳过了登录页
    if 'jaccount.sjtu.edu.cn' not in resp.geturl():
        log('已具有有效 jAccount 会话')
        return True

    # 解析表单字段（从 JavaScript loginContext 或 HTML 中提取）
    # 注意: jasjtumail 的 client 为空，不需要提交
    def extract_js(key):
        m = re.search(rf'{key}:\s*"([^"]*)"', html)
        return m.group(1) if m else ''

    def extract_html(pattern):
        m = re.search(pattern, html)
        return urllib.parse.quote(m.group(1)) if m else ''

    sid = 'jasjtumail'
    returl = extract_js('returl')
    se = extract_js('se')
    uuid = extract_js('uuid')

    if not uuid:
        return fail(f'无法解析 uuid')

    log(f'解析到 returl={returl[:30]}..., se={se[:20]}..., uuid={uuid[:8]}...')

    # 获取验证码
    try:
        captcha_resp = client.get(
            f'https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid={uuid}&t={int(__import__("time").time()*1000)}',
            headers={'Referer': 'https://jaccount.sjtu.edu.cn/'}
        )
        captcha_data = captcha_resp.read()
        log(f'验证码图片大小: {len(captcha_data)} bytes')
    except Exception as e:
        return fail(f'获取验证码失败: {e}')

    # 保存验证码图片供人工识别
    with open('test_captcha.png', 'wb') as f:
        f.write(captcha_data)
    log('验证码已保存到 test_captcha.png，请人工识别')

    captcha_text = input('请输入验证码: ').strip()
    if not captcha_text:
        return fail('未输入验证码')

    # 提交登录（jasjtumail 不需要 client/v/lt 字段）
    try:
        login_data = (
            f'sid=jasjtumail'
            f'&returl={urllib.parse.quote(returl)}'
            f'&se={urllib.parse.quote(se)}'
            f'&uuid={uuid}'
            f'&user={urllib.parse.quote(username)}'
            f'&pass={urllib.parse.quote(password)}'
            f'&captcha={urllib.parse.quote(captcha_text)}'
        )
        resp = client.post(
            'https://jaccount.sjtu.edu.cn/jaccount/ulogin',
            login_data,
            headers={
                'Referer': f'https://jaccount.sjtu.edu.cn/jaccount/jalogin?sid=jasjtumail',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://jaccount.sjtu.edu.cn',
            }
        )
        result = json.loads(resp.read().decode('utf-8'))
        log(f'登录响应: {json.dumps(result, ensure_ascii=False)}')

        if result.get('errno') == 0:
            log('jAccount 登录成功！')
            return True
        else:
            return fail(f'登录失败: {result.get("code", "未知错误")}')
    except Exception as e:
        return fail(f'登录请求异常: {e}')


# ══════════════════════════════════════════
# 测试 2: 获取 ZM_AUTH_TOKEN
# ══════════════════════════════════════════
def test_get_zm_auth(client):
    log('\n=== 测试 2: 获取 ZM_AUTH_TOKEN ===')

    # 访问 mail 首页，跟随重定向
    try:
        resp = client.get('https://mail.sjtu.edu.cn/zimbra/mail')
        log(f'最终 URL: {resp.geturl()}')
        log(f'状态码: {resp.getcode()}')

        # 检查 cookie
        zm_token = None
        for cookie in client.cookie_jar:
            if cookie.name == 'ZM_AUTH_TOKEN':
                zm_token = cookie.value
                log(f'找到 ZM_AUTH_TOKEN: {cookie.value[:50]}...')
            if cookie.name == 'JSESSIONID':
                log(f'找到 JSESSIONID: {cookie.value[:20]}...')

        if zm_token:
            return zm_token
        else:
            # 尝试上一级
            resp2 = client.get('https://mail.sjtu.edu.cn/')
            for cookie in client.cookie_jar:
                if cookie.name == 'ZM_AUTH_TOKEN':
                    zm_token = cookie.value
                    log(f'从 / 路径找到 ZM_AUTH_TOKEN: {cookie.value[:50]}...')
                    return zm_token

            return fail('未找到 ZM_AUTH_TOKEN')
    except Exception as e:
        return fail(f'请求失败: {e}')


# ══════════════════════════════════════════
# 测试 3: SOAP API 调用
# ══════════════════════════════════════════
def test_soap_api(client, zm_token, username):
    log('\n=== 测试 3: SOAP API 调用 ===')

    # CSRF token = 前两段
    csrf = '_'.join(zm_token.split('_')[:2])
    account = f'{username}@sjtu.edu.cn'

    # 构建 SearchRequest
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
    <limit>5</limit>
    <offset>0</offset>
  </SearchRequest>
</BatchRequest>
</soap:Body>
</soap:Envelope>'''

    try:
        resp = client.post_xml(
            'https://mail.sjtu.edu.cn/service/soap/BatchRequest',
            body_xml,
            headers={
                'Cookie': f'ZM_AUTH_TOKEN={zm_token}',
                'X-Zimbra-Csrf-Token': csrf,
            }
        )
        result = json.loads(resp.read().decode('utf-8'))
        log(f'SOAP 响应状态码: {resp.getcode()}')

        if 'Body' in result and 'BatchResponse' in result['Body']:
            search_resp = result['Body']['BatchResponse'].get('SearchRequest', [{}])[0]
            msgs = search_resp.get('m', [])
            log(f'成功获取收件箱，共 {len(msgs)} 封邮件')
            if msgs:
                for m in msgs[:3]:
                    print(f'  - {m.get("su", "(无主题)")} | 来自: {m.get("e", [{}])[0].get("a", "?") if m.get("e") else "?"}')
            return True
        else:
            log(f'响应内容: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}')
            return fail('SOAP 响应中没有 BatchResponse')
    except Exception as e:
        return fail(f'SOAP 请求异常: {e}')


# ══════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════
def main():
    username, password = load_creds()
    if not username or not password:
        print('请先在 jaccount.txt 或 token.txt 中填写 jAccount 凭据（第一行用户名，第二行密码）')
        sys.exit(1)

    log(f'使用账号: {username}')
    client = HttpClient()

    # 测试 1: jAccount 登录
    if not test_jaccount_login(client, username, password):
        sys.exit(1)

    # 测试 2: 获取 ZM_AUTH_TOKEN
    zm_token = test_get_zm_auth(client)
    if not zm_token:
        sys.exit(1)

    # 测试 3: SOAP API
    if not test_soap_api(client, zm_token, username):
        sys.exit(1)

    print('\n[PASS] 所有测试通过！邮件 API 可以正常工作。')

if __name__ == '__main__':
    main()
