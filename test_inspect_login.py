"""检查 jAccount 邮箱登录页的 HTML 结构"""
import urllib.request
import re

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

# 先通过 mail 触发重定向
req = urllib.request.Request(
    'https://mail.sjtu.edu.cn/zimbra/mail',
    headers={'User-Agent': UA}
)
try:
    resp = urllib.request.urlopen(req, timeout=15)
except Exception as e:
    # 获取重定向后的 URL
    pass

# 用 cookie 感知的 opener
import http.cookiejar
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPRedirectHandler,
    urllib.request.HTTPCookieProcessor(cookie_jar)
)

# 访问 mail → 重定向到 jaccount
resp = opener.open(
    urllib.request.Request('https://mail.sjtu.edu.cn/zimbra/mail', headers={'User-Agent': UA})
)
login_url = resp.geturl()
print(f'登录页 URL: {login_url}')

html = resp.read().decode('utf-8')

# 保存 HTML 以供分析
with open('test_login_page.html', 'w', encoding='utf-8') as f:
    f.write(html)
print(f'HTML 已保存到 test_login_page.html ({len(html)} bytes)')

# 检查关键字段
fields = ['sid', 'client', 'returl', 'se', 'v', 'uuid', 'user', 'pass', 'captcha', 'lt']
for f in fields:
    # 试试多种匹配模式
    patterns = [
        rf'name="{f}"\s+value="([^"]*)"',
        rf'name="{f}"\s+id="[^"]*"\s+value="([^"]*)"',
        rf'id="[^"]*"\s+name="{f}"\s+value="([^"]*)"',
        rf'{f}:\s*"([^"]+)"',
        rf'name="{f}"[^>]*>',
    ]
    for p in patterns:
        m = re.search(p, html)
        if m:
            val = m.group(1) if m.lastindex else '(present, no value)'
            print(f'  {f}: {val[:50] if len(val) > 50 else val}')
            break
    else:
        print(f'  {f}: 未找到')
