import re

test_segments = [
    '1、试选时间：2025年12月15日13：00～12月18日16：00',
    '2、海选时间：2025年12月20日13：00～12月25日16：00', 
    '3、抢选（第一阶段）：2025年12月30日13：00～2026年1月3日16：00',
    '4、抢选（第二阶段）：2026年1月5日13：00～1月8日16：00',
    '5、第三轮选课（暂定）：2026年2月10日13：00～2月14日16：00',
]

print('=== Python-style name extraction ===')
for seg in test_segments:
    name = ''
    if '试选时间' in seg or seg.startswith('试选'):
        name = '试选'
    else:
        m = re.search(r'(\d+)[、．]([^：:]*?)\s*[：:]', seg)
        if m:
            name = m.group(2).strip()
            if len(name) > 15:
                name = ''
    print(f'  {name}')

print()
print('=== TypeScript knownRounds approach ===')
knownRounds = ['试选', '海选', '抢选（第一阶段）', '抢选（第二阶段）', '抢选', '第三轮选课']
for seg in test_segments:
    name = ''
    for kn in knownRounds:
        if kn in seg:
            name = kn
            break
    if not name:
        m = re.search(r'(\d+)[、．]([^：:]*?)\s*[：:]', seg)
        if m:
            candidate = m.group(2).strip()
            if len(candidate) <= 15:
                name = candidate
    print(f'  {name}')
