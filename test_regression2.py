#!/usr/bin/env python3
import re

# Test the main time pattern separately
text = "2024年12月30日（第16周周一）20:45-2025年1月6日（第17周周一）20:00"

# Step by step
# Pattern 1: simple match without year prefix
TP1 = re.compile(r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)\s*-\s*(?:(\d+)月)?(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)')
m = TP1.search(text)
if m:
    print('TP1 (without optional group):', m.groups())
else:
    print('TP1: NO MATCH')

# Pattern 2: with optional group for end date
TP2 = re.compile(r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)\s*-\s*(?:(?:(\d+)月)?(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?(\d+:\d+)')
m = TP2.search(text)
if m:
    print('TP2 (with optional group):', m.groups())
else:
    print('TP2: NO MATCH')

# Try without the ?: on the end date section  
TP3 = re.compile(r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)\s*-\s*(?:(\d+)月)?(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)')
m = TP3.search(text)
if m:
    print('TP3 (non-optional end):', m.groups())
else:
    print('TP3: NO MATCH')

# Check what's after the -
mid = text.index('-')
print(f'\nAfter "-": {text[mid:]}')
