#!/usr/bin/env python3
"""Debug: check time regex on segment 2 (抢选 + pause)"""
import urllib.request, re

url = 'https://jwc.sjtu.edu.cn/info/1027/120851.htm'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
content = m.group(1)

plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
segments = re.split(r'(?=\d+[、．])', plain)
segments = [s.strip() for s in segments if s.strip()]

# Segment 2 (抢选)
seg = segments[2]
print(f'Segment [2] length: {len(seg)}')
print(f'Segment [2] starts with: {seg[:50]}')
print(f'Contains 抢选: {"抢选" in seg}')
print(f'Contains 暂停: {"暂停" in seg}')
print()

# New regex
TP = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?'
    r'(\d+:\d+)'
)

print('All time matches:')
for i, tm in enumerate(TP.finditer(seg)):
    g = tm.groups()
    print(f'  Match {i}:')
    print(f'    Full: {tm.group(0)[:80]}')
    print(f'    Groups: {g}')
    has_ed = g[5] is not None
    sm, sd, sw, sh = int(g[0]), int(g[1]), int(g[2]), g[3]
    em = int(g[4]) if has_ed and g[4] else sm
    ed = int(g[5]) if has_ed else sd
    ew = int(g[6]) if has_ed else sw
    eh = g[7]
    print(f'    Start: {sm}月{sd}日 {sh}')
    print(f'    End:   {em}月{ed}日 {eh} (has_end_date={has_ed})')
    print(f'    Weeks: {sw} -> {ew}')
    print()
