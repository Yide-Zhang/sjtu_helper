#!/usr/bin/env python3
"""Debug: show actual segments from FALL page"""
import urllib.request, re

url = 'https://jwc.sjtu.edu.cn/info/1027/120851.htm'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
content = m.group(1)

plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
segments = re.split(r'(?=\d+[、．])', plain)
segments = [s.strip() for s in segments if s.strip()]

print(f'Total segments: {len(segments)}\n')
for i, s in enumerate(segments):
    # Show first 100 chars
    short = s[:100].replace('\n', ' ')
    print(f'[{i:2d}] {short}')
    # Check what it matches
    if '抢选' in s and '暂停' in s:
        print(f'     *** CONTAINS BOTH 抢选 AND 暂停 ***')
    print()
