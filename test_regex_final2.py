#!/usr/bin/env python3
"""Final test with year prefix fix"""
import urllib.request, re

URLS = {
    'FALL': 'https://jwc.sjtu.edu.cn/info/1027/120851.htm',
    'SPRING': 'https://jwc.sjtu.edu.cn/info/1027/118191.htm',
    'SUMMER': 'https://jwc.sjtu.edu.cn/info/1222/125311.htm',
}

# Updated regex with optional year prefix before end date
TP = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(?:\d+年)?(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?'
    r'(\d+:\d+)'
)

known_rounds = [
    ('试选', lambda s: '试选' in s),
    ('海选', lambda s: '海选' in s),
    ('第一轮抢选', lambda s: '第一轮抢选' in s),
    ('第二轮抢选', lambda s: '第二轮抢选' in s),
    ('抢选（第一阶段）', lambda s: bool(re.search(r'抢选\s*[（(]\s*第一', s))),
    ('抢选（第二阶段）', lambda s: bool(re.search(r'抢选\s*[（(]\s*第二', s))),
    ('抢选', lambda s: bool(re.search(r'^\d*[、．]\s*抢选\s*[：:]', s)) or ('抢选' in s and '阶段' not in s and '轮' not in s)),
    ('第三轮选课', lambda s: '第三轮选课' in s),
    ('__pause__', lambda s: '暂停选课' in s or '暂停' in s),
]

for label, url in URLS.items():
    print(f'\n{"="*60}\n{label}: {url}\n{"="*60}')
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
    m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
    if not m: continue
    content = m.group(1)
    
    # Check red blocks first
    blocks = re.findall(r'<strong[^>]*>(.*?)</strong>', content, re.DOTALL)
    red_segments = []
    for b in blocks:
        if 'color:red' in b.lower():
            spans = re.findall(r'<span[^>]*>(.*?)</span>', b, re.DOTALL)
            txt = ''.join(s for s in spans)
            txt = re.sub(r'<[^>]+>', '', txt).strip()
            if txt: red_segments.append(txt)
    
    plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
    plain_segments = [s.strip() for s in re.split(r'(?=\d+[、．])', plain) if s.strip()]
    
    has_time_in_red = any(re.search(r'\d+月\d+日[（(]', s) for s in red_segments)
    segments = red_segments if has_time_in_red else plain_segments
    
    # Extract rounds
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
                if len(candidate) <= 15: name = candidate
        if not name: continue
        
        for tm in TP.finditer(seg):
            g = tm.groups()
            has_ed = g[5] is not None
            sm, sd, sw, sh = int(g[0]), int(g[1]), int(g[2]), g[3]
            em = int(g[4]) if has_ed and g[4] else sm
            ed = int(g[5]) if has_ed else sd
            ew = int(g[6]) if has_ed else sw
            eh = g[7]
            ext_rounds.append({'name': name, 'sm': sm, 'sd': sd, 'sh': sh, 'em': em, 'ed': ed, 'eh': eh, 'weekS': sw, 'weekE': ew})
    
    # Post-process: split 抢选 when a pause is embedded
    found = False
    for i in range(len(ext_rounds)):
        for j in range(i+1, len(ext_rounds)):
            a, b = ext_rounds[i], ext_rounds[j]
            if a['name'] != b['name']: continue
            as_ = a['sm']*100+a['sd']; ae = a['em']*100+a['ed']
            bs = b['sm']*100+b['sd']; be = b['em']*100+b['ed']
            if as_ <= bs and ae >= be: main, pause = a, b
            elif bs <= as_ and be >= ae: main, pause = b, a
            else: continue
            if main['name'] != '抢选': continue
            p1 = dict(main); p1['name'] = '抢选（第一阶段）'; p1['em'] = pause['sm']; p1['ed'] = pause['sd']; p1['eh'] = pause['sh']; p1['weekE'] = pause['weekS']
            p2 = {'name': '抢选（第二阶段）', 'sm': pause['em'], 'sd': pause['ed'], 'sh': pause['eh'], 'em': main['em'], 'ed': main['ed'], 'eh': main['eh'], 'weekS': pause['weekE'], 'weekE': main['weekE']}
            mi = ext_rounds.index(main); pi = ext_rounds.index(pause)
            ext_rounds[mi] = p1; ext_rounds.pop(pi); ext_rounds.append(p2)
            found = True; break
        if found: break
    
    print(f'Final rounds:')
    for r in ext_rounds:
        if r['name'] != '__pause__':
            print(f'  {r["name"]:12s}  {r["sm"]}月{r["sd"]}日 {r["sh"]} ~ {r["em"]}月{r["ed"]}日 {r["eh"]}')
    print()
