import json
with open('E:/SJTU/sjtu_helper/isjtu_announce.har', 'r', encoding='utf-8') as f:
    entries = json.loads(f.read())['log']['entries']
for entry in entries:
    req = entry['request']
    if 'index_cxDbsy' in req['url'] and req['method'] == 'POST':
        body = req.get('postData', {}).get('text', '')
        print('HAR Request body:', body)
        print()
        resp = entry['response']
        text = resp.get('content', {}).get('text', '')
        if text.startswith('{'):
            data = json.loads(text)
            items = data.get('items', [])
            for i, item in enumerate(items):
                clzt = item.get('clzt')
                xxbt = item.get('xxbt', '')[:50]
                print(f'[{i}] clzt={clzt} | {xxbt}')
                if i == 0:
                    print(f'  Keys: {list(item.keys())}')
        break
