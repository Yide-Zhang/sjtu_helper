#!/usr/bin/env python3
import urllib.request, re

url = 'https://jwc.sjtu.edu.cn/info/1222/125311.htm'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
content = m.group(1)

plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
segments = re.split(r'(?=\d+[、．])', plain)
segments = [s.strip() for s in segments if s.strip()]

print(f'Total segments: {len(segments)}')
for i, s in enumerate(segments):
    if '抢选' in s:
        print(f'\n[{i}] (len={len(s)}) {s[:120]}')
        print(f'  第一轮抢选: {"第一轮抢选" in s}')
        print(f'  第二轮抢选: {"第二轮抢选" in s}')
