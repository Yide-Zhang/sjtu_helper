import json

with open('E:/SJTU/sjtu_helper/isjtu_read.har','r',encoding='utf-8') as f:
    entries = json.loads(f.read())['log']['entries']

for i, entry in enumerate(entries):
    req = entry['request']
    body = req.get('postData',{}).get('text','')
    sfyy = '?'
    for kv in body.split('&'):
        if kv.startswith('sfyy='):
            sfyy = kv.split('=')[1]
    
    resp = entry['response']
    text = resp.get('content',{}).get('text','')
    if text.startswith('{'):
        data = json.loads(text)
        items = data.get('items',[])
        total = data.get('totalResult','?')
        print(f'--- Entry {i} (sfyy={sfyy}) ---')
        print(f'Total items: {len(items)}, totalResult: {total}')
        
        for j, item in enumerate(items):
            xxbt = item.get('xxbt','')
            cjsj = item.get('cjsj','')
            clzt = item.get('clzt','')
            print(f'  [{j}] clzt={clzt} {cjsj} | {xxbt[:60]}')
        print()
