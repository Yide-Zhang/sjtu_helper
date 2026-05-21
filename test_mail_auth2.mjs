// Test: Does SOAP API need ZM_AUTH_TOKEN cookie?
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const CSRF = '0_ac9458d233806fc60b2335efdf6de6f871d62e21';
const ACCOUNT = 'yddd19952193983@sjtu.edu.cn';
const ZM_TOKEN = '0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b';

function buildSoap(csrf) {
  return '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap:Header><context xmlns="urn:zimbra">' +
    '<userAgent name="Test" version="10.0.18_GA_4828"/>' +
    '<session id=""/>' +
    '<account by="name">' + ACCOUNT + '</account>' +
    '<format type="js"/>' +
    '<csrfToken>' + csrf + '</csrfToken>' +
    '</context></soap:Header>' +
    '<soap:Body>' +
    '<BatchRequest xmlns="urn:zimbra" onerror="continue">' +
    '<SearchRequest xmlns="urn:zimbraMail" requestId="0">' +
    '<query>in:inbox</query><types>message</types><limit>3</limit><offset>0</offset>' +
    '</SearchRequest></BatchRequest></soap:Body></soap:Envelope>';
}

async function test() {
  const body = buildSoap(CSRF);
  
  // Test 1: With both ZM_AUTH_TOKEN and CSRF
  console.log('Test 1: ZM_AUTH_TOKEN cookie + CSRF in body');
  let r = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml; charset=UTF-8', UA, 'Cookie': 'ZM_AUTH_TOKEN=' + ZM_TOKEN },
    body,
  });
  let j = JSON.parse(await r.text());
  let msgs = j?.Body?.BatchResponse?.SearchRequest?.[0]?.m || [];
  console.log('  Status: ' + r.status + ', Messages: ' + msgs.length);

  // Test 2: Only CSRF, no ZM_AUTH_TOKEN
  console.log('Test 2: Only CSRF, no ZM_AUTH_TOKEN cookie');
  r = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml; charset=UTF-8', UA },
    body,
  });
  try {
    j = JSON.parse(await r.text());
    const err = j?.Body?.Fault || j?.Body?.BatchResponse?.Fault;
    console.log('  Status: ' + r.status + ', Response: ' + JSON.stringify(j).substring(0, 200));
  } catch(e) {
    console.log('  Error: ' + (await r.text()).substring(0, 200));
  }

  // Test 3: Use CSRF as ZM_AUTH_TOKEN
  console.log('Test 3: CSRF token as ZM_AUTH_TOKEN');
  r = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml; charset=UTF-8', UA, 'Cookie': 'ZM_AUTH_TOKEN=' + CSRF },
    body,
  });
  try {
    j = JSON.parse(await r.text());
    console.log('  Status: ' + r.status + ', Response: ' + JSON.stringify(j).substring(0, 200));
  } catch(e) {
    console.log('  Error: ' + (await r.text()).substring(0, 200));
  }
}
test();
