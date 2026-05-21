#!/usr/bin/env python3
"""Test the full data flow: fetch params → API response → parse → display"""
import json, re
from datetime import datetime

# 1. Simulate the fetch with our parameters
our_params = {
    'flag': '',
    'sfyy': '1',
    '_search': 'false',
    'nd': str(int(datetime.now().timestamp() * 1000)),
    'queryModel.showCount': '50',
    'queryModel.currentPage': '1',
    'queryModel.sortName': 'cjsj ',
    'queryModel.sortOrder': 'desc',
    'time': '0',
}
print('Our request params:')
for k, v in our_params.items():
    print(f'  {k}={v}')

# 2. Load HAR - this is what the API returns
with open('E:/SJTU/sjtu_helper/isjtu_announce.har', 'r', encoding='utf-8') as f:
    entries = json.loads(f.read())['log']['entries']

for entry in entries:
    req = entry['request']
    if 'index_cxDbsy' in req['url'] and req['method'] == 'POST':
        resp = entry['response']
        text = resp.get('content', {}).get('text', '')
        if text.startswith('{'):
            data = json.loads(text)
            items = data.get('items', [])
            print(f'\nHAR has {len(items)} items, totalResult={data.get("totalResult")}')
            
            # 3. Apply parseTiaoKe to each
            TS_RE = re.compile(
                r'调课提醒:([^老]+)老师于第(\d+)周(\S+?)第([\d-]+)节在(.+?)(?:上)(?=的)的(.+?)课程调课到由([^老]+)老师在第(\d+)周(\S+?)第([\d-]+)节(.+?)(?:上)(?=课)课'
            )
            
            print('\nParsed results:')
            for i, item in enumerate(items):
                title = item.get('xxbt', '')
                cjsj = item.get('cjsj', '')
                clzt = item.get('clzt', '')
                wid = item.get('w_id', '')
                
                m = TS_RE.search(title)
                if m:
                    # Simulate the TypeScript parseTiaoKe return
                    result = {
                        'id': wid,
                        'title': title,
                        'time': cjsj,
                        'status': clzt,
                        'isTiaoKe': True,
                        'tiaoKeInfo': {
                            'course': m.group(6).strip(),
                            'original': {
                                'teacher': m.group(1) + '老师',
                                'week': int(m.group(2)),
                                'day': m.group(3),
                                'periods': f'第{m.group(4)}节',
                                'periodStart': int(m.group(4).split('-')[0]),
                                'periodEnd': int(m.group(4).split('-')[1]),
                                'location': m.group(5),
                            },
                            'new': {
                                'teacher': m.group(7) + '老师',
                                'week': int(m.group(8)),
                                'day': m.group(9),
                                'periods': f'第{m.group(10)}节',
                                'periodStart': int(m.group(10).split('-')[0]),
                                'periodEnd': int(m.group(10).split('-')[1]),
                                'location': m.group(11),
                            }
                        }
                    }
                    print(f'[{i}] ✅ {result["tiaoKeInfo"]["course"]} | {cjsj[:10]} | 原{m.group(4)}→新{m.group(10)}节')
                else:
                    print(f'[{i}] ❌ NOT PARSED: {title[:60]}...')
            
            # 4. Check: would we show this on MainScreen?
            print('\n--- MainScreen merged top-2 check ---')
            # Simulate the merge + sort + slice(0, 2)
            merged_jwc = []  # assume empty for test
            merged_isjtu = []
            for item in items:
                title = item.get('xxbt', '')
                m = TS_RE.search(title)
                merged_isjtu.append({
                    'id': 'isjtu_' + item.get('w_id', ''),
                    'title': title,
                    'date': item.get('cjsj', '')[:10] if item.get('cjsj') else '',
                    'isImportant': m is not None,
                    'badge': '调课' if m else None,
                    'badgeColor': '#E65100',
                    'detail': f'第{m.group(10)}节' if m else None,
                    'url': None,
                })
            
            all_merged = merged_jwc + merged_isjtu
            top2 = sorted(all_merged, key=lambda x: x['date'], reverse=True)[:2]
            print('Top 2 items for MainScreen:')
            for t in top2:
                print(f'  {t["title"][:50]} | {t["date"]} | important={t["isImportant"]}')
            
        break
