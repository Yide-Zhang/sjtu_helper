/**
 * 测试：从 Zimbra mail 页面提取 CSRF token，并验证 API
 * 使用已知的 ZM_AUTH_TOKEN 和从页面提取的 CSRF
 */
const ZM_AUTH_TOKEN = '0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const ACCOUNT = 'yddd19952193983@sjtu.edu.cn';

async function main() {
  // Step 1: 访问 /zimbra/mail 获取 CSRF token
  console.log('=== Step 1: 获取 CSRF token ===\n');
  const r = await fetch('https://mail.sjtu.edu.cn/zimbra/mail', {
    headers: { 
      'User-Agent': UA,
      'Cookie': `ZM_AUTH_TOKEN=${ZM_AUTH_TOKEN}`
    },
  });
  const html = await r.text();
  console.log(`HTML length: ${html.length} bytes`);
  
  // 搜索 csrfToken
  const csrfMatch = html.match(/csrfToken["']?\s*[:=]\s*["']([^"']+)["']/);
  if (csrfMatch) {
    console.log(`Found csrfToken in JS: ${csrfMatch[1]}`);
  } else {
    console.log('No csrfToken found in page');
  }
  
  // 搜索 window.csrfToken
  const winCsrf = html.match(/window\.csrfToken\s*=\s*['"]([^'"]+)['"]/);
  if (winCsrf) {
    console.log(`Found window.csrfToken: ${winCsrf[1]}`);
  } else {
    console.log('No window.csrfToken found');
  }
  
  // 搜索任何包含 csrf 的模式
  const allCsrf = [...html.matchAll(/csrf[^=]*=\s*['"]([^'"]{20,})['"]/gi)];
  for (const m of allCsrf) {
    console.log(`CSRF-like value: ${m[1].substring(0, 60)}...`);
  }
  
  // Step 2: 使用找到的 CSRF token 调用 API（不带 CSRF header）
  let csrfToken = csrfMatch?.[1] || '';
  if (!csrfToken) {
    // 尝试用之前的 token
    csrfToken = '0_d216bfd3c34aaf6ee781cd4abe278787971b85f1';
    console.log(`\nUsing known CSRF: ${csrfToken}`);
  }
  
  console.log('\n=== Step 2: 使用提取的 CSRF 调用 API ===\n');
  
  const body = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
<soap:Header>
  <context xmlns="urn:zimbra">
    <userAgent name="ZimbraWebClient - Test" version="10.0.18_GA_4828"/>
    <session id=""/>
    <account by="name">${ACCOUNT}</account>
    <format type="js"/>
    <csrfToken>${csrfToken}</csrfToken>
  </context>
</soap:Header>
<soap:Body>
<BatchRequest xmlns="urn:zimbra" onerror="continue">
  <SearchRequest xmlns="urn:zimbraMail" requestId="0">
    <query>in:inbox</query>
    <types>message</types>
    <limit>5</limit>
    <offset>0</offset>
  </SearchRequest>
</BatchRequest>
</soap:Body>
</soap:Envelope>`;

  const r2 = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/soap+xml; charset=UTF-8',
      'User-Agent': UA,
      'Cookie': `ZM_AUTH_TOKEN=${ZM_AUTH_TOKEN}`,
    },
    body,
  });
  const result = await r2.text();
  console.log('Status:', r2.status);
  
  try {
    const json = JSON.parse(result);
    const msgs = json.Body?.BatchResponse?.SearchRequest?.[0]?.m || [];
    console.log(`Messages found: ${msgs.length}`);
    for (const m of msgs.slice(0, 3)) {
      console.log(`  - ${m.su || '(无主题)'} | ${m.e?.[0]?.a || '?'}`);
    }
  } catch {
    console.log('Response:', result.substring(0, 300));
  }
}

main().catch(console.error);
