#!/usr/bin/env python3
"""Test the EXACT TypeScript parseTiaoKe logic against HAR data"""
import json, re

# Exact TypeScript regex
TS_RE = re.compile(
    r'调课提醒:([^老]+)老师于第(\d+)周(\S+?)第([\d-]+)节在(.+?)(?:上)(?=的)的(.+?)课程调课到由([^老]+)老师在第(\d+)周(\S+?)第([\d-]+)节(.+?)(?:上)(?=课)课'
)

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
            
            for i, item in enumerate(items):
                title = item.get('xxbt', '')
                m = TS_RE.search(title)
                
                print(f'\n[{i}] clzt={item.get("clzt")} | w_id={item.get("w_id","")}')
                print(f'    title: {title[:80]}')
                
                if m:
                    # Simulate parseTiaoKe return
                    try:
                        parse_periods = lambda s: {'start': int(s.split('-')[0]), 'end': int(s.split('-')[1]) if '-' in s else int(s.split('-')[0])}
                        op = parse_periods(m.group(4))
                        np = parse_periods(m.group(10))
                        
                        result = {
                            'course': m.group(6),
                            'original': {
                                'teacher': m.group(1) + '老师',
                                'week': int(m.group(2)),
                                'day': m.group(3),
                                'periods': f'第{m.group(4)}节',
                                'periodStart': op['start'],
                                'periodEnd': op['end'],
                                'location': m.group(5),
                            },
                            'new': {
                                'teacher': m.group(7) + '老师',
                                'week': int(m.group(8)),
                                'day': m.group(9),
                                'periods': f'第{m.group(10)}节',
                                'periodStart': np['start'],
                                'periodEnd': np['end'],
                                'location': m.group(11),
                            }
                        }
                        print(f'    ✅ course="{result["course"]}" | {result["original"]["week"]}周{result["original"]["day"]}→{result["new"]["week"]}周{result["new"]["day"]}')
                        print(f'        orig_periods={result["original"]["periodStart"]}-{result["original"]["periodEnd"]}  new_periods={result["new"]["periodStart"]}-{result["new"]["periodEnd"]}')
                    except Exception as e:
                        print(f'    ❌ ERROR in parsing: {e}')
                        import traceback
                        traceback.print_exc()
                else:
                    print(f'    ❌ REGEX NO MATCH')
            
            print(f'\n--- Summary ---')
            print(f'Total items: {len(items)}')
            matched = sum(1 for item in items if TS_RE.search(item.get('xxbt', '')))
            print(f'Matched: {matched}')
            print(f'Unmatched: {len(items) - matched}')
        break
