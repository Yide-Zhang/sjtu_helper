#!/usr/bin/env python3
import re

text = "2024年12月30日（第16周周一）20:45-2025年1月6日（第17周周一）20:00"

# Full pattern with optional end date
TP = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?'
    r'(\d+:\d+)'
)

# The problem might be in the optional group. Let's check with a non-optional but flexible version
# Try: make the end day optional but not the whole group
TP_test = re.compile(
    r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]'
    r'(\d+:\d+)\s*-\s*'
    r'(?:(\d+)月)?(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)'
)
m = TP_test.search(text)
if m:
    print('TP_test (non-optional end date):', m.groups())
else:
    print('TP_test: NO MATCH')

# Try step by step
# First, find the first part
simple = re.compile(r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)')
m = simple.search(text)
if m:
    start, end = m.span()
    print(f'First part: "{text[start:end]}" at {m.span()}')
    after = text[end:]
    print(f'After first part: "{after}"')
    
    # Now try to match the rest
    rest_re = re.compile(r'\s*-\s*(?:(\d+)月)?(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)')
    m2 = rest_re.match(after)
    if m2:
        print('Rest match:', m2.groups())
    else:
        print('Rest: NO MATCH')
        # Check what's at the start
        print(f'  First 20 chars: "{after[:20]}"')
        for i, c in enumerate(after[:15]):
            print(f'  [{i}] {c} (U+{ord(c):04X})')
