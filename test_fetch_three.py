#!/usr/bin/env python3
"""Fetch three 选课通知 pages and compare their structures"""
import urllib.request, re, sys, json

URLS = {
    'FALL': 'https://jwc.sjtu.edu.cn/info/1027/120851.htm',
    'SPRING': 'https://jwc.sjtu.edu.cn/info/1027/118191.htm',
    'SUMMER': 'https://jwc.sjtu.edu.cn/info/1222/125311.htm',
}

for label, url in URLS.items():
    print(f'========== {label} ==========')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f'FETCH ERROR: {e}')
        print()
        continue

    # Find v_news_content
    m = re.search(r'<div class="v_news_content">(.*?)</div>\s*</div>', html, re.DOTALL)
    if not m:
        print('v_news_content NOT FOUND')
        print()
        continue
    content = m.group(1)
    print(f'v_news_content length: {len(content)}')

    # Red strong blocks
    blocks = re.findall(r'<strong[^>]*>(.*?)</strong>', content, re.DOTALL)
    red_texts = []
    for b in blocks:
        if 'color:red' in b.lower():
            spans = re.findall(r'<span[^>]*>(.*?)</span>', b, re.DOTALL)
            txt = ''.join(s for s in spans)
            txt = re.sub(r'<[^>]+>', '', txt).strip()
            if txt:
                red_texts.append(txt)
    
    if red_texts:
        print(f'Red blocks: {len(red_texts)}')
        for rt in red_texts[:3]:
            print(f'  {rt[:100]}')
    else:
        print('No red blocks')
        # Try plain <p> or <span style="color:red">
        red_spans = re.findall(r'<span[^>]*color:\s*red[^>]*>(.*?)</span>', content, re.DOTALL)
        if red_spans:
            print(f'Red spans: {len(red_spans)}')
            for rs in red_spans[:3]:
                txt = re.sub(r'<[^>]+>', '', rs).strip()
                print(f'  {txt[:100]}')
        else:
            print('No red spans either')

    # Plain text segments with time
    print(f'\nSegments with time patterns:')
    plain = re.sub(r'<[^>]+>', '', content).replace('&nbsp;', ' ').replace('\u200b', '')
    tp = re.compile(r'\d+月\d+日.*?第\d+周周[一二三四五六日].*?\d+:\d+')
    for seg in plain.split('。'):
        seg = seg.strip()
        if not seg: continue
        if tp.search(seg):
            display = seg[:150]
            print(f'  {display}')
    print()
