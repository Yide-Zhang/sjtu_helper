/**
 * 最简测试：用 fetch 自动跟随重定向，验证能否走到 /zimbra/mail
 * 模拟 React Native 的默认 fetch 行为
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchFollow(url, options = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, ...options.headers },
    method: options.method || 'GET',
    body: options.body,
    redirect: 'follow',  // 自动跟随
  });
  return {
    status: r.status,
    url: r.url,
    cookie: r.headers.get('set-cookie') || '',
    text: await r.text(),
    headers: r.headers,
  };
}

// 用已知的 ZM_AUTH_TOKEN 测试 SOAP（验证用户确实有邮件）
async function testSoapWithKnownToken() {
  console.log('=== 用已知 ZM_AUTH_TOKEN 测试 SOAP ===\n');
  const token = '0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b';
  
  const body = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
<soap:Header>
  <context xmlns="urn:zimbra">
    <userAgent name="ZimbraWebClient - Test" version="10.0.18_GA_4828"/>
    <session id=""/>
    <account by="name">yddd19952193983@sjtu.edu.cn</account>
    <format type="js"/>
    <csrfToken>0_d216bfd3c34aaf6ee781cd4abe278787971b85f1</csrfToken>
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

  try {
    const r = await fetch('https://mail.sjtu.edu.cn/service/soap/BatchRequest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=UTF-8',
        'User-Agent': UA,
        'Cookie': `ZM_AUTH_TOKEN=${token}`,
      },
      body,
    });
    const result = JSON.parse(await r.text());
    const msgs = result?.Body?.BatchResponse?.SearchRequest?.[0]?.m || [];
    console.log(`找到 ${msgs.length} 封邮件:`);
    for (const m of msgs.slice(0, 5)) {
      console.log(`  [${m.d ? new Date(m.d).toLocaleDateString() : '?'}] ${m.su || '(无主题)'} | ${m.e?.[0]?.a || '?'}`);
    }
    console.log('\n✅ SOAP API 工作正常！');
    return true;
  } catch (e) {
    console.log(`❌ SOAP 失败: ${e.message}`);
    return false;
  }
}

// 测试 fetch 跟随重定向后能否到 /zimbra/mail
async function testRedirectFollow(authCookie) {
  console.log('\n=== 测试 fetch 自动跟随重定向 ===\n');
  
  let headers = { 'User-Agent': UA };
  if (authCookie) headers['Cookie'] = authCookie;
  
  try {
    const r = await fetch('https://mail.sjtu.edu.cn/zimbra/mail', {
      headers,
      redirect: 'follow',
    });
    console.log(`最终 URL: ${r.url.substring(0, 100)}`);
    console.log(`状态: ${r.status}`);
    console.log(`Content-Type: ${r.headers.get('content-type')?.substring(0, 50)}`);
    
    const text = await r.text();
    
    if (r.url.includes('/zimbra/mail')) {
      console.log('\n✅ 成功到达 /zimbra/mail 页面');
      const csrf = text.match(/csrfToken["']?\s*[:=]\s*["']([^"']+)["']/);
      if (csrf) console.log(`CSRF token: ${csrf[1].substring(0, 40)}...`);
      else console.log('❌ 未找到 CSRF token');
      return true;
    }
    
    if (r.url.includes('jaccount.sjtu.edu.cn')) {
      console.log('\n❌ 被重定向到 jAccount 登录页（需要认证）');
      const uuid = text.match(/uuid:\s*"([^"]+)"/);
      if (uuid) console.log(`UUID: ${uuid[1].substring(0, 8)}...`);
      return false;
    }
    
    console.log(`\n❓ 未知终点: ${r.url.substring(0, 80)}`);
    return false;
  } catch (e) {
    console.log(`❌ 请求失败: ${e.message}`);
    return false;
  }
}

async function main() {
  // 1) 先测试已知 token 的 SOAP API
  await testSoapWithKnownToken();
  
  // 2) 测试无 cookie 访问
  console.log('\n═══════════════════════════════════');
  console.log('无 cookie 访问 /zimbra/mail:');
  await testRedirectFollow(null);
  
  // 3) 用已知 token 作为 cookie 测试
  console.log('\n═══════════════════════════════════');
  console.log('带 ZM_AUTH_TOKEN cookie 访问:');
  const token = 'ZM_AUTH_TOKEN=0_8e6d03f702b57091c5bba9326d29b8eeb0b9aa09_69643d33363a34313164343236302d656336642d346638662d396534392d3434616432613466633232333b6578703d31333a313737393239393537343831333b747970653d363a7a696d6272613b753d313a613b7469643d31303a313730363137323436383b76657273696f6e3d31343a31302e302e305f47415f343531383b637372663d313a313b';
  await testRedirectFollow(token);
}

main().catch(console.error);
