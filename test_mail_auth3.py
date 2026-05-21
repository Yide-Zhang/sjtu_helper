"""测试 SOAP API 认证方式"""
import requests, urllib3, json
urllib3.disable_warnings()

csrf = '0_ac9458d233806fc60b2335efdf6de6f871d62e21'
sid = '14699259'
acct = 'yddd19952193983@sjtu.edu.cn'

body = (
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">'
    '<soap:Header><context xmlns="urn:zimbra">'
    '<userAgent name="Test" version="10.0.18_GA_4828"/>'
    '<session id="{}"/>'.format(sid) +
    '<account by="name">{}</account>'.format(acct) +
    '<format type="js"/>'
    '<csrfToken>{}</csrfToken>'.format(csrf) +
    '</context></soap:Header>'
    '<soap:Body>'
    '<BatchRequest xmlns="urn:zimbra" onerror="continue">'
    '<SearchRequest xmlns="urn:zimbraMail" requestId="0">'
    '<query>in:inbox</query><types>message</types><limit>3</limit><offset>0</offset>'
    '</SearchRequest></BatchRequest></soap:Body></soap:Envelope>'
)

r = requests.post('https://mail.sjtu.edu.cn/service/soap/BatchRequest',
    data=body.encode('utf-8'),
    headers={'Content-Type': 'application/soap+xml; charset=UTF-8'},
    verify=False)
print('Status:', r.status_code)
print(r.text[:400])
