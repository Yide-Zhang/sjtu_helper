#!/usr/bin/env python3
import re

text = "2024年12月30日（第16周周一）20:45-2025年1月6日（第17周周一）20:00"

# Simplest: just match the date part
TP_simple = re.compile(r'(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)')
m = TP_simple.search(text)
if m:
    print('Simple date+time match:', m.groups())
    print(f'Match span: {m.span()}')
else:
    print('Simple: NO MATCH')

# Even simpler
TP_very = re.compile(r'12月30日')
m = TP_very.search(text)
if m:
    print('Very simple match:', m.group())
else:
    print('Very simple: NO MATCH')

# Check the text around 12月30日
idx = text.find('12月')
print(f'\nText around "12月": ...{text[max(0,idx-5):idx+20]}...')

# Maybe the issue is the full-width chars
print(f'\nChar codes around 12月:')
for i, c in enumerate(text[8:20]):
    print(f'  [{8+i}] {c} (U+{ord(c):04X})')
