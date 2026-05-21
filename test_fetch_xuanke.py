import urllib.request, re, sys

url = 'https://jwc.sjtu.edu.cn/info/1027/120851.htm'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')

# Find v_news_content
m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
if not m:
    print('v_news_content not found')
    sys.exit(1)

content = m.group(1)

# Extract red strong blocks
print('=== RED STRONG BLOCKS ===')
blocks = re.findall(r'<strong[^>]*>(.*?)</strong>', content, re.DOTALL)
found_red = False
for b in blocks:
    if 'color:red' in b.lower():
        spans = re.findall(r'<span[^>]*>(.*?)</span>', b, re.DOTALL)
        text = ''.join(s for s in spans)
        text = re.sub(r'<[^>]+>', '', text).strip()
        if text:
            found_red = True
            print(text)

if not found_red:
    print('(no red blocks found)')

# Plain text round info
print()
print('=== ROUND SEGMENTS (from plain text) ===')
plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
for seg in plain.split('\u3002'):
    seg = seg.strip()
    if not seg:
        continue
    if any(kw in seg for kw in ['试选', '海选', '抢选', '第三轮选课']):
        # Extract just the first sentence part
        print(seg[:120] + ('...' if len(seg) > 120 else ''))
        print()
