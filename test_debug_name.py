#!/usr/bin/env python3
"""Debug name matching for segment 2"""
import re

seg = "2、抢选：6月3日（第16周周二）20:45-6月6日（第16周周五）17:00。其中在抢选后半阶段，即6月4日（第16周周三）15:00-20:45将暂停选课，系统将进行"专业限制"调整，当天20:45取消专业限制，并重新开放系统。"

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

print(f'Segment contains 抢选: {"抢选" in seg}')
print(f'Segment contains 阶段: {"阶段" in seg}')
print(f'Segment contains 轮: {"轮" in seg}')
print(f'抢选 matcher result: {"抢选" in seg and "阶段" not in seg and "轮" not in seg}')
print()

for n, matcher in known_rounds:
    result = matcher(seg)
    print(f'  [{n:12s}] -> {result}')
