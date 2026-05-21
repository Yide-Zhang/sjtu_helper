#!/usr/bin/env python3
"""Test multi-time extraction and summer handling"""
import urllib.request, re

URLS = {
    'FALL': 'https://jwc.sjtu.edu.cn/info/1027/120851.htm',
    'SPRING': 'https://jwc.sjtu.edu.cn/info/1027/118191.htm',
    'SUMMER': 'https://jwc.sjtu.edu.cn/info/1222/125311.htm',
}

TP = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?'
    r'(\d+:\d+)'
)

known_rounds = [
    ('试选', lambda s: '试选' in s),
    ('海选', lambda s: '海选' in s),
    ('第一轮抢选', lambda s: '第一轮抢选' in s),
    ('第二轮抢选', lambda s: '第二轮抢选' in s),
    ('抢选（第一阶段）', lambda s: bool(re.search(r'抢选\s*[（(]\s*第一', s))),
    ('抢选（第二阶段）', lambda s: bool(re.search(r'抢选\s*[（(]\s*第二', s))),
    ('抢选', lambda s: '抢选' in s and '阶段' not in s and '轮' not in s),
    ('第三轮选课', lambda s: '第三轮选课' in s),
    ('__pause__', lambda s: '暂停选课' in s or '暂停' in s),
]

for label, url in URLS.items():
    print(f'\n{"="*60}')
    print(f'{label}: {url}')
    print('='*60)
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
    
    m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
    if not m:
        print('  NO v_news_content')
        continue
    content = m.group(1)
    
    # Try red blocks first
    blocks = re.findall(r'<strong[^>]*>(.*?)</strong>', content, re.DOTALL)
    segments = []
    for b in blocks:
        if 'color:red' in b.lower():
            spans = re.findall(r'<span[^>]*>(.*?)</span>', b, re.DOTALL)
            txt = ''.join(s for s in spans)
            txt = re.sub(r'<[^>]+>', '', txt).strip()
            if txt:
                segments.append(txt)
    
    if not segments:
        plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
        segments = re.split(r'(?=\d+[、．])', plain)
        segments = [s.strip() for s in segments if s.strip()]
    
    # Extract ALL time ranges from each segment
    ext_rounds = []
    for seg in segments:
        name = None
        for n, matcher in known_rounds:
            if matcher(seg):
                name = n
                break
        if not name:
            rm = re.search(r'(\d+)[、．]([^：:]*?)\s*[：:]', seg)
            if rm:
                candidate = rm.group(2).strip()
                if len(candidate) <= 15:
                    name = candidate
        if not name:
            continue
        
        # Multiple time matches per segment
        for tm in TP.finditer(seg):
            g = tm.groups()
            end_month = int(g[4]) if g[4] else int(g[0])
            ext_rounds.append({
                'name': name,
                'start': f'{g[0]}月{g[1]}日 {g[3]}',
                'end': f'{end_month}月{g[5]}日 {g[7]}',
                'week': f'{g[2]}→{g[6]}',
            })
    
    # Post-process: split 抢选 by pause
    qx_indices = [i for i, r in enumerate(ext_rounds) if r['name'] == '抢选']
    pause_indices = [i for i, r in enumerate(ext_rounds) if r['name'] == '__pause__']
    
    if qx_indices and pause_indices:
        qx_idx = qx_indices[0]
        pause_idx = pause_indices[0]
        # Only if pause_idx is DIFFERENT from qx_idx (they might be from same segment but different time matches)
        if pause_idx != qx_idx:
            qx = ext_rounds[qx_idx]
            pause = ext_rounds[pause_idx]
            def md(s):
                parts = s.split()
                mp = parts[0].replace('月', ' ').replace('日', '')
                return int(mp.split()[0]) * 100 + int(mp.split()[1])
            if md(pause['start']) >= md(qx['start']) and md(pause['end']) <= md(qx['end']):
                p1 = dict(qx)
                p1['name'] = '抢选（第一阶段）'
                p1['end'] = pause['start']
                p2 = dict(qx)
                p2['name'] = '抢选（第二阶段）'
                p2['start'] = pause['end']
                ext_rounds[qx_idx] = p1
                ext_rounds.append(p2)
                ext_rounds.pop(pause_idx)
    
    print(f'\nFinal rounds:')
    for r in ext_rounds:
        if r['name'] != '__pause__':
            print(f'  {r["name"]:12s}  {r["start"]} ~ {r["end"]}')
    print()
