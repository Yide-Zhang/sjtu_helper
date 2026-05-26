with open('../src/utils/storage.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()
print(f'Total: {len(lines)} lines')
print('Last 5:')
for i in range(max(0, len(lines)-5), len(lines)):
    print(f'  {i+1}: {lines[i].rstrip()}')
