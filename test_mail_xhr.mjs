/**
 * 模拟 XHR 风格的重定向跟踪（和 RN 的 XMLHttpRequest 行为一致）
 * 验证 mail 认证重定向链能否正常拿到 ZM_AUTH_TOKEN
 */
import * as http from 'http';
import * as https from 'https';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// 模拟 XHR 的低级请求（不自动跟随重定向）
function xhrFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': UA,
      ...options.headers,
    };
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers,
      // 不自动跟随重定向
      rejectUnauthorized: false,
    }, (res) => {
      // 收集响应头
      const headers = {};
      for (const [k, v] of Object.entries(res.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join('\n') : v;
      }

      // 收集响应体
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve({
          status: res.statusCode,
          headers,
          text,
          finalUrl: url, // XHR 的 responseURL 是最终 URL
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// 手动跟随重定向（XHR 默认行为）
async function followRedirects(url, options = {}, maxSteps = 15) {
  for (let i = 0; i < maxSteps; i++) {
    console.log(`\nStep ${i}: ${url.substring(0, 100)}`);
    const r = await xhrFetch(url, options);
    console.log(`  Status: ${r.status}`);
    console.log(`  Content-Type: ${r.headers['content-type'] || '(none)'}`);
    
    const cookie = r.headers['set-cookie'] || '';
    if (cookie) {
      console.log(`  Set-Cookie: ${cookie.substring(0, 150)}`);
    } else {
      console.log(`  Set-Cookie: (none)`);
    }

    // 检查 ZM_AUTH_TOKEN
    const zm = cookie.match(/ZM_AUTH_TOKEN=([^;]+)/);
    if (zm) {
      console.log(`\n✅ ZM_AUTH_TOKEN 已找到: ${zm[1].substring(0, 50)}...`);
      return true;
    }

    const loc = r.headers['location'];
    if (loc) {
      console.log(`  Location: ${loc.substring(0, 100)}`);
      url = loc.startsWith('http') ? loc : new URL(loc, url).href;
    } else {
      console.log(`  (end of chain - no location)`);
      break;
    }
  }
  return false;
}

async function main() {
  console.log('=== XHR 风格重定向跟踪测试 ===\n');

  // 测试 1: 基本重定向链（无 cookie）
  console.log('┌─────────────────────────────────────────────');
  console.log('│ 测试 1: 基础重定向链');
  console.log('└─────────────────────────────────────────────');
  const ok1 = await followRedirects('https://mail.sjtu.edu.cn/zimbra/mail');
  console.log(`\n结果: ${ok1 ? '✅ 成功获取 ZM_AUTH_TOKEN' : '❌ 未获取到'}`);

  // 测试 2: 从 mail 首页开始（/ 而不是 /zimbra/mail）
  console.log('\n\n┌─────────────────────────────────────────────');
  console.log('│ 测试 2: 从 / 开始');
  console.log('└─────────────────────────────────────────────');
  const ok2 = await followRedirects('https://mail.sjtu.edu.cn/');
  console.log(`\n结果: ${ok2 ? '✅ 成功获取 ZM_AUTH_TOKEN' : '❌ 未获取到'}`);

  // 测试 3: 验证码下载
  console.log('\n\n┌─────────────────────────────────────────────');
  console.log('│ 测试 3: 验证码端点');
  console.log('└─────────────────────────────────────────────');
  const captchaUrl = `https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid=dummy&t=${Date.now()}`;
  const r3 = await xhrFetch(captchaUrl, {
    headers: { 'Referer': 'https://jaccount.sjtu.edu.cn/' }
  });
  console.log(`  Status: ${r3.status}`);
  console.log(`  Content-Type: ${r3.headers['content-type'] || '(none)'}`);
  console.log(`  Body length: ${r3.text.length} bytes`);
  console.log(`  Result: ${r3.status === 200 && r3.text.length > 0 ? '✅ 可正常获取' : '❌ 失败'}`);
}

main().catch(console.error);
