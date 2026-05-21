/**
 * 用已知 ZM_AUTH_TOKEN 测试 Zimbra SOAP API
 * 用法: node test_mail_soap.mjs
 * 从 mail_try1.har 中提取 token 直接测试 API
 */
import * as fs from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function buildEnvelope(sessionId, accountName, csrf, bodyXml) {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
<soap:Header>
  <context xmlns="urn:zimbra">
    <userAgent name="ZimbraWebClient - Test" version="10.0.18_GA_4828"/>
    <session id="${sessionId}"/>
    <account by="name">${accountName}</account>
    <format type="js"/>
    <csrfToken>${csrf}</csrfToken>
  </context>
</soap:Header>
<soap:Body>${bodyXml}</soap:Body>
</soap:Envelope>`;
}

async function testSOAP() {
  // 从 HAR 中提取 ZM_AUTH_TOKEN
  // 直接从用户提供的 cURL 里提取
  const ZM_AUTH_TOKEN = '0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b';
  const CSRF = ZM_AUTH_TOKEN.split('_').slice(0, 2).join('_');
  const ACCOUNT = 'yddd19952193983@sjtu.edu.cn';
  
  console.log('=== 测试 Zimbra SOAP API ===\n');
  console.log(`ZM_AUTH_TOKEN: ${ZM_AUTH_TOKEN.substring(0, 50)}...`);
  console.log(`CSRF: ${CSRF}`);
  console.log(`Account: ${ACCOUNT}\n`);

  // Test 1: GetMailboxMetadata (最小请求)
  console.log('Test 1: GetMailboxMetadata');
  let body = buildEnvelope('', ACCOUNT, CSRF, `<BatchRequest xmlns="urn:zimbra" onerror="continue">
  <GetMailboxMetadataRequest xmlns="urn:zimbraMail" requestId="0">
    <meta section="zwc:implicit"/>
  </GetMailboxMetadataRequest>
</BatchRequest>`);

  try {
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
    const text = await r.text();
    const json = JSON.parse(text);
    if (json.Body?.BatchResponse?.GetMailboxMetadataResponse) {
      console.log('  ✅ Success!');
    } else {
      console.log('  ❌ Failed:', JSON.stringify(json).substring(0, 200));
    }
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }

  // Test 2: SearchRequest (收件箱)
  console.log('\nTest 2: SearchRequest (in:inbox limit:3)');
  body = buildEnvelope('', ACCOUNT, CSRF, `<BatchRequest xmlns="urn:zimbra" onerror="continue">
  <SearchRequest xmlns="urn:zimbraMail" requestId="0">
    <query>in:inbox</query>
    <types>message</types>
    <limit>3</limit>
    <offset>0</offset>
  </SearchRequest>
</BatchRequest>`);

  try {
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
    const text = await r.text();
    const json = JSON.parse(text);
    const msgs = json.Body?.BatchResponse?.SearchRequest?.[0]?.m || [];
    console.log(`  Found ${msgs.length} messages`);
    for (const m of msgs) {
      console.log(`  - ${m.su || '(no subject)'} (${m.e?.[0]?.a || '?'})`);
    }
    if (msgs.length > 0) console.log('  ✅ API works!');
    else console.log('  ⚠️  No messages but API responded');
  } catch (e) {
    console.log('  ❌ Error:', e.message);
  }
}

testSOAP();
