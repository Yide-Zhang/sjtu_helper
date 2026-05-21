#!/usr/bin/env python3
"""Test regex on Spring 抢选 segment directly"""
import re

text = "2、抢选：2024年12月30日（第16周周一）20:45-2025年1月6日（第17周周一）20:00。其中在抢选后半阶段，即2025年1月2日（第16周周四）15:00-20:45将暂停选课"

TP = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?'
    r'(\d+:\d+)'
)

print(f'Text: {text[:100]}...')
print(f'Full regex matches:')
for i, tm in enumerate(TP.finditer(text)):
    g = tm.groups()
    print(f'  Match {i}:')
    print(f'    Full: {tm.group(0)}')
    print(f'    Start: {g[0]}月{g[1]}日 {g[3]}')
    has_ed = g[5] is not None
    em = int(g[4]) if has_ed and g[4] else int(g[0])
    ed = g[5] if has_ed else g[1]
    eh = g[7]
    print(f'    End:   {em}月{ed}日 {eh}')
    print()
