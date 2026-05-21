#!/usr/bin/env python3
import re

after = "-2025年1月6日（第17周周一）20:00"

# Test rest regex directly
rest_re = re.compile(r'\s*-\s*(?:(\d+)月)?(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)')
print(f'Regex: {rest_re.pattern}')
m = rest_re.match(after)
print(f'rest_re match: {m is not None}')
if m:
    print(f'Groups: {m.groups()}')
else:
    # Try with search
    m2 = rest_re.search(after)
    print(f'rest_re search: {m2 is not None}')
    if m2:
        print(f'Search groups: {m2.groups()}')
    # Test simpler versions
    simpler = re.compile(r'\d+月\d+日[（(]第\d+周周[一二三四五六日][)）]\d+:\d+')
    print(f'simpler search: {simpler.search(after) is not None}')
    # Test with just the time part
    time_only = re.compile(r'\d+:\d+')
    print(f'time search: {time_only.search(after) is not None}')
    # Test the day part
    day_part = re.compile(r'[（(]第\d+周周[一二三四五六日][)）]')
    print(f'day part search: {day_part.search(after) is not None}')

print(f'\nAfter chars:')
for i, c in enumerate(after[:20]):
    print(f'  [{i}] {c} (U+{ord(c):04X})')
