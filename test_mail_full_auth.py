"""
完整的邮箱认证端到端测试。
模拟：jAccount登录 → login.jsp(生成preauth) → preauth → /zimbra/mail → SOAP API调用
使用 requests.Session 自动管理 cookie。
"""
import requests, re, json, base64, urllib3, os, sys
urllib3.disable_warnings()

# ============================= 配置 =============================
# 从用户已经登录获取的 token 和 CSRF 信息
JACCOUNT_USERNAME = "yddd19952193983"  
JACCOUNT_PASSWORD = "CAXcAnvAs1106"  # 从 test_captcha.py 可知
CAPTCHA_VALUE = "yddd"  # 从历史记录中
CSRF_FROM_PAGE = "0_ac9458d233806fc60b2335efdf6de6f871d62e21"
SESSION_ID = "14699259"
USER_ID = "411d4260-ec6d-4f8f-9e49-44ad2a4fc223"
ACCOUNT = f"{JACCOUNT_USERNAME}@sjtu.edu.cn"

# 先测试1: 用已有的已知有效的 ZM_AUTH_TOKEN 和 CSRF token
ZM_AUTH_TOKEN_KNOWN = "0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b"

# 测试2: 模拟完整认证流程获取新的 ZM_AUTH_TOKEN
# 其实 ZM_AUTH_TOKEN 的 base64 部分解码后是:
# id=36:411d4260-ec6d-4f8f-9e49-44ad2a4fc223;exp=13:1779299574813;type=6:zimbra;u=1:a;tid=10:1706172468;version=14:10.0.0_GA_4518;csrf=1:1;
# 如果我们能构造这个 token...但需要知道 hash 部分的生成算法

def build_soap(csrf, acct, session_id=""):
    """构建 SOAP 请求体"""
    return (
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">'
        '<soap:Header><context xmlns="urn:zimbra">'
        '<userAgent name="RNMail" version="10.0.18_GA_4828"/>'
        '<session id="{}"/>'.format(session_id) +
        '<account by="name">{}</account>'.format(acct) +
        '<format type="js"/>'
        '<csrfToken>{}</csrfToken>'.format(csrf) +
        '</context></soap:Header>'
        '<soap:Body>'
        '<BatchRequest xmlns="urn:zimbra" onerror="continue">'
        '<SearchRequest xmlns="urn:zimbraMail" requestId="0">'
        '<query>in:inbox</query><types>message</types><limit>3</limit><offset>0</offset>'
        '</SearchRequest></BatchRequest></soap:Body></soap:Envelope>'
    )

def test_with_session():
    """使用 requests.Session 进行完整认证流程"""
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    s.verify = False
    
    # Step 1: 先访问 /zimbra/mail 看看是否重定向到 jAccount
    print("=" * 60)
    print("Step 1: 直接访问 /zimbra/mail")
    print("=" * 60)
    r = s.get('https://mail.sjtu.edu.cn/zimbra/mail', allow_redirects=True)
    print(f"Final URL: {r.url}")
    print(f"Status: {r.status_code}")
    print(f"Cookies after: {dict(s.cookies)}")
    
    # 如果在 jAccount 页面，尝试登录
    if 'jaccount' in r.url and 'jalogin' in r.url:
        print("\n重定向到 jAccount，需要登录...")
        # 从页面提取 lt, execution 等参数
        # 这里简化处理，先用已知的 CSRF 和 session
        pass
    elif r.status_code == 200 and 'Zimbra' in r.text:
        print("\n成功加载邮箱页面!")
        # 提取 CSRF token
        csrf_match = re.search(r'window\.csrfToken\s*=\s*"([^"]+)"', r.text)
        if csrf_match:
            print(f"CSRF Token: {csrf_match.group(1)}")
        
        # 提取 authTokenExpires
        exp_match = re.search(r'window\.authTokenExpires\s*=\s*(\d+)', r.text)
        if exp_match:
            print(f"Auth Token Expires: {exp_match.group(1)}")
        
        print(f"Cookies after load: {dict(s.cookies)}")
        
        # 尝试 SOAP API 调用
        csrf = csrf_match.group(1) if csrf_match else CSRF_FROM_PAGE
        body = build_soap(csrf, ACCOUNT, SESSION_ID)
        
        # 不使用 ZM_AUTH_TOKEN cookie，看是否能用 session cookie 工作
        print("\nStep 2: 尝试 SOAP API 调用 (无 ZM_AUTH_TOKEN)")
        r2 = s.post('https://mail.sjtu.edu.cn/service/soap/BatchRequest',
                    data=body.encode('utf-8'),
                    headers={'Content-Type': 'application/soap+xml; charset=UTF-8'})
        print(f"Status: {r2.status_code}")
        try:
            j = r2.json()
            msg = j.get('Body', {}).get('BatchResponse', {}).get('SearchRequest', [{}])[0].get('m', [])
            print(f"Messages: {len(msg)}")
        except:
            print(f"Error: {r2.text[:200]}")
        
        # 如果能获取到任何 cookie，尝试加上 ZM_AUTH_TOKEN 格式的 cookie
        print("\nStep 3: 尝试用提取的 token 信息构造 ZM_AUTH_TOKEN")
        # 从页面中提取用户信息
        user_id_match = re.search(r'"id":"([^"]+)"', r.text)
        if user_id_match:
            uid = user_id_match.group(1)
            print(f"User ID from page: {uid}")
        
        return True
    else:
        print(f"Unexpected: {r.text[:200]}")
        return False

def try_construct_auth_token():
    """尝试从已有数据构造 ZM_AUTH_TOKEN"""
    import base64
    
    # ZM_AUTH_TOKEN 的 base64 部分解码
    # 格式: id=36:{user_id};exp=13:{expiry};type=6:zimbra;u=1:a;tid=10:{tid};version=14:{version};csrf=1:1;
    
    # 从页面提取的数据
    user_id = USER_ID
    session_id = SESSION_ID
    expiry = 1779303182574  # window.authTokenExpires
    
    # 构造数据部分
    data_parts = [
        f"id=36:{user_id}",
        f"exp=13:{expiry}",
        "type=6:zimbra",
        "u=1:a",
        "tid=10:1706172468",
        "version=14:10.0.18_GA_4828",
        "csrf=1:1"
    ]
    data_str = ";".join(data_parts)
    data_b64 = base64.b64encode(data_str.encode()).decode()
    
    print(f"Constructed data: {data_str}")
    print(f"Base64: {data_b64}")
    
    # 问题是 hash 部分 (8e6d03f702b57091c5bba9326d29b8eeb0b9aa09)
    # 这是由服务器生成的，我们从页面数据中无法推导
    # 所以需要从初始 SOAP 响应中提取
    print("\n注意: token 的 hash 部分由服务器生成，无法本地构造")

def extract_auth_token_from_page():
    """尝试从 /zimbra/mail 页面的 batchInfoResponse 中提取 auth token"""
    # 先读取已有的 mail_preauth.har 中的页面内容
    # 或者直接请求 /zimbra/mail
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0'})
    s.verify = False
    
    # 注意: 没有有效的认证信息，这个请求会被重定向
    r = s.get('https://mail.sjtu.edu.cn/zimbra/mail', allow_redirects=True)
    
    if r.status_code == 200:
        # 查找 batchInfoResponse
        match = re.search(r'var\s+batchInfoResponse\s*=\s*({.*?});', r.text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(1))
                # 打印所有可能的认证相关字段
                context = data.get('Header', {}).get('context', {})
                print(f"Context keys: {list(context.keys())}")
                for k, v in context.items():
                    if isinstance(v, str) and len(v) > 20:
                        print(f"  {k}: {v[:50]}...")
                    else:
                        print(f"  {k}: {v}")
                
                # 检查是否有 authToken
                body = data.get('Body', {})
                batch_resp = body.get('BatchResponse', {})
                print(f"BatchResponse keys: {list(batch_resp.keys())}")
                
                info = batch_resp.get('GetInfoResponse', [{}])[0]
                print(f"GetInfoResponse keys: {list(info.keys())}")
                for k, v in info.items():
                    if isinstance(v, str) and len(v) > 50:
                        print(f"  {k}: {v[:60]}...")
                    elif not isinstance(v, (dict, list)):
                        print(f"  {k}: {v}")
                
                return data
            except Exception as e:
                print(f"Parse error: {e}")
    else:
        print(f"Cannot load page, status={r.status_code}")
    
    return None

if __name__ == '__main__':
    print("=" * 60)
    print("测试1: 用已知 ZM_AUTH_TOKEN + CSRF 调用 SOAP API")
    print("=" * 60)
    body = build_soap(CSRF_FROM_PAGE, ACCOUNT, SESSION_ID)
    r = requests.post('https://mail.sjtu.edu.cn/service/soap/BatchRequest',
                      data=body.encode('utf-8'),
                      headers={'Content-Type': 'application/soap+xml; charset=UTF-8',
                               'Cookie': f'ZM_AUTH_TOKEN={ZM_AUTH_TOKEN_KNOWN}'},
                      verify=False)
    print(f"Status: {r.status_code}")
    try:
        j = r.json()
        fault = j.get('Body', {}).get('Fault', {})
        if fault:
            print(f"Error: {fault.get('Reason', {}).get('Text', '')}")
        else:
            msgs = j.get('Body', {}).get('BatchResponse', {}).get('SearchRequest', [{}])[0].get('m', [])
            print(f"Messages: {len(msgs)}")
    except:
        print(f"Error: {r.text[:200]}")
    
    print("\n")
    print("=" * 60)
    print("测试2: 检查 /zimbra/mail 页面中是否有嵌入的 auth token")
    print("=" * 60)
    data = extract_auth_token_from_page()
    
    print("\n")
    print("=" * 60)
    print("测试3: 构造 ZM_AUTH_TOKEN 分析")
    print("=" * 60)
    try_construct_auth_token()
    
    print("\n")
    print("=" * 60)
    print("测试4: 用 requests.Session 尝试完整登录流程")
    print("=" * 60)
    test_with_session()
