import json, re, sys

with open(r'c:\Users\OMEN\AppData\Roaming\Code\User\workspaceStorage\356701a5056cbaffcec36f8d81fa64c4\GitHub.copilot-chat\transcripts\ce885897-7fad-42c5-9b6c-b54997b28e8d.jsonl', 'r', encoding='utf-8') as f:
    data = f.read()

# Find CommunityReviewScreen create_file occurrences
idx = 0
best_content = ''
best_len = 0

while True:
    idx = data.find('src/screens/CommunityReviewScreen.tsx', idx)
    if idx < 0: break
    
    # Walk back to find the enclosing create_file arguments
    search_start = max(0, idx - 5000)
    args_start = data.rfind('"arguments"', search_start, idx)
    if args_start < 0:
        idx += 1
        continue
    
    # Find the JSON object for arguments
    brace = data.find('{', args_start)
    if brace < 0 or brace > idx + 100:
        idx += 1
        continue
    
    # Parse the arguments JSON
    depth = 0
    for end in range(brace, len(data)):
        if data[end] == '{': depth += 1
        elif data[end] == '}':
            depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(data[brace:end+1])
                    content = obj.get('content', '')
                    if len(content) > best_len:
                        best_len = len(content)
                        best_content = content
                except:
                    pass
                break
    idx += 1

if best_content:
    print(best_content)
else:
    print("NOT FOUND")
