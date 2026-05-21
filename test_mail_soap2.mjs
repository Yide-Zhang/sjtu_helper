/**
 * 测试 Zimbra SOAP API - 查看完整错误响应
 */
const ZM_AUTH_TOKEN = '0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b';
const CSRF = '0_d216bfd3c34aaf6ee781cd4abe278787971b85f1';  // 从 HAR 中提取的准确 CSRF token
const ACCOUNT = 'yddd19952193983@sjtu.edu.cn';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  // 尝试 1: 使用 HAR 中的 CSRF token
  console.log('=== 尝试 1: 使用 HAR 中的 CSRF token ===\n');
  
  const body = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
<soap:Header>
  <context xmlns="urn:zimbra">
    <userAgent name="ZimbraWebClient - Test" version="10.0.18_GA_4828"/>
    <session id=""/>
    <account by="name">${ACCOUNT}</account>
    <format type="js"/>
    <csrfToken>${CSRF}</csrfToken>
  </context>
</soap:Header>
<soap:Body>
<BatchRequest xmlns="urn:zimbra" onerror="continue">
  <GetMailboxMetadataRequest xmlns="urn:zimbraMail" requestId="0">
    <meta section="zwc:implicit"/>
  </GetMailboxMetadataRequest>
</BatchRequest>
</soap:Body>
</soap:Envelope>`;

  const r = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=UTF-8',
      'User-Agent': UA,
      'Cookie': `ZM_AUTH_TOKEN=${ZM_AUTH_TOKEN}`,
      'X-Zimbra-Csrf-Token': CSRF,
    },
    body,
  });
  
  console.log('Status:', r.status);
  const text = await r.text();
  console.log('Response (first 500 chars):', text.substring(0, 500));
  
  // 尝试 2: 不带 CSRF header 但带 body CSRF
  console.log('\n=== 尝试 2: 不带 CSRF header ===\n');
  const r2 = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=UTF-8',
      'User-Agent': UA,
      'Cookie': `ZM_AUTH_TOKEN=${ZM_AUTH_TOKEN}`,
    },
    body,
  });
  const text2 = await r2.text();
  console.log('Response (first 500 chars):', text2.substring(0, 500));

  // 尝试 3: 使用不同的 CSRF（从 token 中提取）
  console.log('\n=== 尝试 3: 用 token 前缀做 CSRF ===\n');
  const csrf3 = ZM_AUTH_TOKEN.split('_').slice(0, 2).join('_');
  const body3 = body.replace(CSRF, csrf3);
  const r3 = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=UTF-8',
      'User-Agent': UA,
      'Cookie': `ZM_AUTH_TOKEN=${ZM_AUTH_TOKEN}`,
      'X-Zimbra-Csrf-Token': csrf3,
    },
    body: body3,
  });
  const text3 = await r3.text();
  console.log('Response (first 500 chars):', text3.substring(0, 500));
}

main().catch(console.error);
