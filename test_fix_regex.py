"""Test improved regex for multi-week support"""
import re, json

# New regex: week captures digits, hyphens, commas, and optional 周 segments
NEW_RE = re.compile(
    r'调课提醒:'
    r'([^老]+)老师于'                          # 1 orig teacher
    r'第((?:\d+(?:-\d+)?周?,?)*\d+(?:-\d+)?)周?'  # 2 week(s)
    r'(\S+?)'                                   # 3 day
    r'第([\d-]+)节在'                           # 4 periods
    r'(.+?)(?:上)(?=的)'                       # 5 orig location
    r'的(.+?)课程'                               # 6 course
    r'调课到由'
    r'([^老]+)老师'                             # 7 new teacher
    r'在第((?:\d+(?:-\d+)?周?,?)*\d+(?:-\d+)?)周?'  # 8 new week(s)
    r'(\S+?)'                                   # 9 new day
    r'第([\d-]+)节'                             # 10 new periods
    r'(.+?)(?:上)(?=课)'                       # 11 new location
    r'课'
)

# Also keep old regex for comparison
OLD_RE = re.compile(
    r'调课提醒:([^老]+)老师于第(\d+)周(\S+?)第([\d-]+)节在(.+?)(?:上)(?=的)的(.+?)课程调课到由([^老]+)老师在第(\d+)周(\S+?)第([\d-]+)节(.+?)(?:上)(?=课)课'
)

tests = [
    # Standard single-week
    "调课提醒:张拳石老师于第8周星期五第1-2节在东上院215上的机器学习课程调课到由张拳石老师在第10周星期五第1-2节东上院215上课，请各位同学相互告知！",
    # Multi-week range
    "调课提醒:梁进老师于第6-16周星期三第9-10节在下院115上的数学分析I课程调课到由梁进老师在第6-16周星期三第9-10节上院100上课，请各位同学相互告知！",
    # Multi-week with comma
    "调课提醒:梁进老师于第6-14周,16周星期五第7-8节在下院115上的数学分析I课程调课到由梁进老师在第6-14周,16周星期五第7-8节上院100上课，请各位同学相互告知！",
]

print("=== NEW REGEX ===")
for title in tests:
    m = NEW_RE.search(title)
    if m:
        print(f'✅ {m.group(6)} | orig_week="{m.group(2)}" day={m.group(3)} | new_week="{m.group(8)}" day={m.group(9)}')
    else:
        print(f'❌ NO MATCH')

print("\n=== OLD REGEX ===")
for title in tests:
    m = OLD_RE.search(title)
    if m:
        print(f'✅ {m.group(6)} | orig_week="{m.group(2)}" day={m.group(3)} | new_week="{m.group(8)}" day={m.group(9)}')
    else:
        print(f'❌ NO MATCH')

# Now test against all items from both HARs
print("\n=== HAR DATA TEST ===")
for har_file in ['isjtu_announce.har', 'isjtu_read.har']:
    with open(f'E:/SJTU/sjtu_helper/{har_file}','r',encoding='utf-8') as f:
        entries = json.loads(f.read())['log']['entries']
    for entry in entries:
        req = entry['request']
        if 'index_cxDbsy' in req['url'] and req['method'] == 'POST':
            resp = entry['response']
            text = resp.get('content',{}).get('text','')
            if text.startswith('{'):
                data = json.loads(text)
                items = data.get('items',[])
                for item in items:
                    title = item.get('xxbt','')
                    if '调课提醒' in title:
                        old_m = OLD_RE.search(title)
                        new_m = NEW_RE.search(title)
                        old_ok = '✅' if old_m else '❌'
                        new_ok = '✅' if new_m else '❌'
                        if old_ok != new_ok:  # Only show if there's a difference
                            print(f'[{har_file}] OLD={old_ok} NEW={new_ok} | {title[:60]}')
                        elif not old_m and not new_m:
                            print(f'[{har_file}] BOTH FAILED | {title[:60]}')
print("Done!")
