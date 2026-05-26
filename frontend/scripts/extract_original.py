import json, sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'c:\Users\OMEN\AppData\Roaming\Code\User\workspaceStorage\356701a5056cbaffcec36f8d81fa64c4\GitHub.copilot-chat\transcripts\ce885897-7fad-42c5-9b6c-b54997b28e8d.jsonl', 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
        except:
            continue
        # Navigate to toolRequests
        data = obj.get('data', {})
        for tool in data.get('toolRequests', []):
            if tool.get('name') == 'create_file':
                try:
                    args = json.loads(tool['arguments'])
                except:
                    continue
                if 'CommunityReviewScreen' in args.get('filePath', ''):
                    content = args.get('content', '')
                    if len(content) > 500:
                        print(content)
                        print('===FILE_END===')
        # Also check direct structure (some lines differ)
        for tool in obj.get('toolRequests', []):
            if tool.get('name') == 'create_file':
                try:
                    args = json.loads(tool['arguments'])
                except:
                    continue
                if 'CommunityReviewScreen' in args.get('filePath', ''):
                    content = args.get('content', '')
                    if len(content) > 500:
                        print(content)
                        print('===FILE_END===')
