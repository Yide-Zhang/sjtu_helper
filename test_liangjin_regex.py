import re

# Current TypeScript regex
TS_RE = re.compile(
    r'调课提醒:([^老]+)老师于第(\d+)周(\S+?)第([\d-]+)节在(.+?)(?:上)(?=的)的(.+?)课程调课到由([^老]+)老师在第(\d+)周(\S+?)第([\d-]+)节(.+?)(?:上)(?=课)课'
)

tests = [
    "调课提醒:梁进老师于第6-14周,16周星期五第7-8节在下院115上的数学分析I课程调课到由梁进老师在第6-14周,16周星期五第7-8节上院100上课，请各位同学相互告知！",
    "调课提醒:梁进老师于第6-16周星期三第9-10节在下院115上的数学分析I课程调课到由梁进老师在第6-16周星期三第9-10节上院100上课，请各位同学相互告知！",
]

for title in tests:
    m = TS_RE.search(title)
    if m:
        print(f'MATCH:')
        print(f'  orig_teacher={m.group(1)}')
        print(f'  orig_week={m.group(2)}')
        print(f'  orig_day={m.group(3)}')
        print(f'  orig_periods={m.group(4)}')
        print(f'  orig_location={m.group(5)}')
        print(f'  course={m.group(6)}')
        print(f'  new_teacher={m.group(7)}')
        print(f'  new_week={m.group(8)}')
        print(f'  new_day={m.group(9)}')
        print(f'  new_periods={m.group(10)}')
        print(f'  new_location={m.group(11)}')
    else:
        print('NO MATCH')
    print()
