import json, sys

with open(r'c:\Users\OMEN\AppData\Roaming\Code\User\workspaceStorage\356701a5056cbaffcec36f8d81fa64c4\GitHub.copilot-chat\transcripts\ce885897-7fad-42c5-9b6c-b54997b28e8d.jsonl', 'r', encoding='utf-8') as f:
    data = f.read()

# Find the LAST create_file for the screen (most complete version)
last_content = ''
last_pos = 0
search_from = 0
while True:
    idx = data.find('src/screens/CommunityReviewScreen.tsx', search_from)
    if idx < 0:
        break
    search_from = idx + 1
    # Extract arguments
    args_pos = data.rfind('"arguments"', max(0, idx-5000), idx)
    if args_pos < 0:
        continue
    # Find the full arguments JSON string
    start = data.find('"', data.find(':', args_pos) + 1)
    if start < 0 or start > idx:
        continue
    # Parse the JSON string value
    # The arguments value starts with " and contains escaped JSON
    i = start
    while i < len(data):
        if data[i] == '\\':
            i += 2
        elif data[i] == '"':
            # Check if this is really the end (followed by , or })
            rest = data[i:i+10]
            if rest[1:2] in ',}':
                raw = data[start:i]
                try:
                    args = json.loads(raw)
                    content = args.get('content', '')
                    if len(content) > len(last_content):
                        last_content = content
                        last_pos = idx
                except:
                    pass
                break
            else:
                i += 1
        else:
            i += 1

if last_content:
    with open('../src/screens/CommunityReviewScreen.tsx', 'w', encoding='utf-8') as f:
        f.write(last_content)
    print(f'RESTORED: {len(last_content)} chars')
else:
    print('NOT FOUND')
