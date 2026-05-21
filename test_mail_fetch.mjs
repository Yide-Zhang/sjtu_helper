/**
 * 测试 React Native fetch 风格的邮件认证流 (使用 Node.js fetch)
 * 模拟 RN 的 Cookie 处理和 redirect: manual 行为
 */
const MAIL_BASE = 'https://mail.sjtu.edu.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function followRedirectChain() {
  console.log('=== 测试: 跟随重定向获取 ZM_AUTH_TOKEN ===\n');
  
  const maxSteps = 15;
  let url = `${MAIL_BASE}/zimbra/mail`;
  
  for (let i = 0; i < maxSteps; i++) {
    console.log(`Step ${i}: GET ${url}`);
    
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA },
        redirect: 'manual',
      });
      
      console.log(`  Status: ${r.status} ${r.statusText}`);
      console.log(`  Final URL: ${r.url}`);
      
      // 检查 Set-Cookie
      const cookieStr = r.headers.get('set-cookie') || '';
      if (cookieStr) {
        console.log(`  Set-Cookie: ${cookieStr.substring(0, 200)}`);
        const zm = cookieStr.match(/ZM_AUTH_TOKEN=([^;]+)/);
        if (zm) {
          console.log(`\n✅ 找到 ZM_AUTH_TOKEN: ${zm[1].substring(0, 50)}...`);
          return true;
        }
      } else {
        console.log(`  Set-Cookie: (none)`);
      }
      
      const loc = r.headers.get('location');
      if (loc) {
        console.log(`  Location: ${loc.substring(0, 120)}`);
        url = loc.startsWith('http') ? loc : new URL(loc, url).href;
      } else {
        console.log(`  Location: (none) - end of chain`);
        return false;
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      return false;
    }
  }
  return false;
}

// Also test if we get cookies from the response
async function testCookies() {
  console.log('\n=== 测试: 检查 Response Cookie 访问 ===\n');
  
  const url = 'https://mail.sjtu.edu.cn/';
  try {
    const r = await fetch(url, { redirect: 'manual' });
    console.log(`GET ${url}`);
    console.log(`Status: ${r.status}`);
    console.log(`Headers:`);
    for (const [k, v] of r.headers.entries()) {
      if (k.includes('cookie') || k.includes('set')) {
        console.log(`  ${k}: ${v.substring(0, 200)}`);
      }
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

// Main
await followRedirectChain();
await testCookies();
