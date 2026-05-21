#!/usr/bin/env python3
import urllib.request, re

url = 'https://jwc.sjtu.edu.cn/info/1027/118191.htm'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
content = m.group(1)
plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
segments = re.split(r'(?=\d+[、．])', plain)
segments = [s.strip() for s in segments if s.strip()]

# Updated regex
TP = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?'
    r'(\d+:\d+)'
)

print('Spring 抢选-related segments:')
for i, s in enumerate(segments):
    if '抢选' in s or 'pause' in s.lower():
        print(f'\n[{i}] (len={len(s)})')
        print(f'  Starts: {s[:60]}')
        print(f'  Contains 阶段: {"阶段" in s}')
        # Check regex matches
        matches = list(TP.finditer(s))
        print(f'  Time matches: {len(matches)}')
        for j, tm in enumerate(matches):
            g = tm.groups()
            print(f'    [{j}] Start: {g[0]}月{g[1]}日 {g[3]}', end='')
            has_ed = g[5] is not None
            em = int(g[4]) if has_ed and g[4] else g[0]
            ed = g[5] if has_ed else g[1]
            print(f' ~ End: {em}月{ed}日 {g[7]}')
