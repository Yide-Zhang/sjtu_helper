#!/usr/bin/env python3
"""Test parseTiaoKe against HAR data"""
import json, re

# Load HAR
with open('E:/SJTU/sjtu_helper/isjtu_announce.har', 'r', encoding='utf-8') as f:
    content = f.read()
entries = json.loads(content)['log']['entries']

# Find the POST to index_cxDbsy
for entry in entries:
    req = entry['request']
    if 'index_cxDbsy' in req['url'] and req['method'] == 'POST':
        resp = entry['response']
        text = resp.get('content', {}).get('text', '')
        if text.startswith('{'):
            data = json.loads(text)
            items = data.get('items', [])
            print(f'Total items: {len(items)}')
            print(f'totalResult: {data.get("totalResult", "?")}')
            print()
            
            TIAOKE_RE = re.compile(
                r'调课提醒:'
                r'(?P<orig_teacher>[^老]+)老师于'
                r'第(?P<orig_week>\d+)周'
                r'(?P<orig_day>\S+?)'
                r'第(?P<orig_periods>[\d-]+)节在'
                r'(?P<orig_location>.+?)(?:上)(?=的)'
                r'的(?P<course>.+?)课程'
                r'调课到由'
                r'(?P<new_teacher>[^老]+)老师'
                r'在第(?P<new_week>\d+)周'
                r'(?P<new_day>\S+?)'
                r'第(?P<new_periods>[\d-]+)节'
                r'(?P<new_location>.+?)(?:上)(?=课)'
                r'课'
            )
            
            for i, item in enumerate(items):
                title = item.get('xxbt', '')
                cjsj = item.get('cjsj', '')
                clzt = item.get('clzt', '')
                m = TIAOKE_RE.search(title)
                if m:
                    d = m.groupdict()
                    print(f'[{i}] ✅ 调课: {d["course"]} | {d["orig_teacher"]}→{d["new_teacher"]} | {d["orig_week"]}→{d["new_week"]}周 | 原节次={d["orig_periods"]} 新节次={d["new_periods"]} | clzt={clzt}')
                else:
                    print(f'[{i}] ❌ 未匹配: {title[:80]} | clzt={clzt} | {cjsj}')
            
            # Also test the TypeScript regex pattern (with numeric groups)
            print('\n--- TypeScript regex test ---')
            TS_RE = re.compile(
                r'调课提醒:([^老]+)老师于第(\d+)周(\S+?)第([\d-]+)节在(.+?)(?:上)(?=的)的(.+?)课程调课到由([^老]+)老师在第(\d+)周(\S+?)第([\d-]+)节(.+?)(?:上)(?=课)课'
            )
            for i, item in enumerate(items):
                title = item.get('xxbt', '')
                m = TS_RE.search(title)
                if m:
                    print(f'[{i}] ✅ TS regex matched: groups={m.groups()}')
                else:
                    if '调课提醒' in title:
                        print(f'[{i}] ❌ TS regex FAILED: {title[:80]}')
        break
