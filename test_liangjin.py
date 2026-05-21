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
        for item in items:
            title = item.get('xxbt','')
            if '梁进' in title or '数学分析' in title:
                print(f'sfyy={sfyy}: {title}')
                print()
