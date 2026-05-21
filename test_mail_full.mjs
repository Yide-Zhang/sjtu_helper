/**
 * 完整邮件认证测试 — 模拟 React Native 重定向链
 * 用法: node test_mail_full.mjs
 * 说明: 从 mail.sjtu.edu.cn 开始，跟随重定向链到 jAccount 登录页，
 *       提交登录后再跟随重定向获取 ZM_AUTH_TOKEN
 */
import * as fs from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const CREDS_FILE = 'jaccount.txt';

function loadCreds() {
  try {
    const lines = fs.readFileSync(CREDS_FILE, 'utf-8').trim().split('\n');
    if (lines.length >= 2) return { u: lines[0].trim(), p: lines[1].trim() };
  } catch {}
  try {
    const lines = fs.readFileSync('token.txt', 'utf-8').trim().split('\n');
    if (lines.length >= 2) return { u: lines[0].trim(), p: lines[1].trim() };
  } catch {}
  return null;
}

async function getWithRedirect(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' });
  return {
    status: r.status,
    url: r.url,
    location: r.headers.get('location'),
    cookie: r.headers.get('set-cookie') || '',
    text: r.status !== 302 ? await r.text() : null,
  };
}

async function main() {
  console.log('=== 邮件认证全流程测试 ===\n');

  // Step 1: GET mail.sjtu.edu.cn/zimbra/mail
  console.log('Step 1: GET /zimbra/mail');
  let r = await getWithRedirect('https://mail.sjtu.edu.cn/zimbra/mail');
  console.log(`  → ${r.status} Location: ${r.location?.substring(0, 80) || '(none)'}`);
  console.log(`  Cookie: ${r.cookie ? r.cookie.substring(0, 100) : '(none)'}`);

  // Step 2: Follow first redirect
  console.log('\nStep 2: Follow to /jaccount/login.jsp');
  r = await getWithRedirect(r.location);
  console.log(`  → ${r.status} Location: ${r.location?.substring(0, 80) || '(none)'}`);
  console.log(`  Cookie: ${r.cookie ? r.cookie.substring(0, 100) : '(none)'}`);

  // Step 3: Follow to jaccount login page
  console.log('\nStep 3: Follow to jAccount login page');
  r = await getWithRedirect(r.location);
  console.log(`  → ${r.status} URL: ${r.url.substring(0, 100)}`);
  console.log(`  Cookie: ${r.cookie ? r.cookie.substring(0, 100) : '(none)'}`);

  if (r.status === 200) {
    // Parse login form
    const getJs = (key) => {
      const m = r.text.match(new RegExp(`${key}:\\s*"([^"]*)"`));
      return m ? m[1] : '';
    };
    const returl = getJs('returl');
    const se = getJs('se');
    const uuid = getJs('uuid');
    console.log(`\n  Login form: returl=${returl.substring(0, 30)}... se=${se.substring(0, 20)}... uuid=${uuid}`);
    
    if (!uuid) { console.log('  FAIL: Could not parse login form'); return; }

    // Get captcha
    console.log('\nStep 4: Get captcha image');
    const captchaRes = await fetch(
      `https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid=${uuid}&t=${Date.now()}`,
      { headers: { 'User-Agent': UA, 'Referer': 'https://jaccount.sjtu.edu.cn/' } }
    );
    const captchaBuf = Buffer.from(await captchaRes.arrayBuffer());
    fs.writeFileSync('test_captcha.png', captchaBuf);
    console.log(`  Captcha saved: test_captcha.png (${captchaBuf.length} bytes)`);
    
    // Read creds
    const creds = loadCreds();
    if (!creds) { console.log('  FAIL: No credentials'); return; }
    
    // Ask for captcha
    console.log('\n请输入验证码（查看 test_captcha.png）:');
    const captcha = await new Promise(resolve => {
      process.stdin.once('data', data => resolve(data.toString().trim()));
    });
    if (!captcha) { console.log('  FAIL: No captcha'); return; }

    // Step 5: POST login
    console.log('\nStep 5: POST ulogin');
    const loginRes = await fetch('https://jaccount.sjtu.edu.cn/jaccount/ulogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        'Referer': r.url,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: `sid=jasjtumail&returl=${encodeURIComponent(returl)}&se=${encodeURIComponent(se)}&uuid=${uuid}&user=${encodeURIComponent(creds.u)}&pass=${encodeURIComponent(creds.p)}&captcha=${encodeURIComponent(captcha)}`,
    });
    const result = await loginRes.json();
    console.log(`  Response: ${JSON.stringify(result)}`);

    if (result.errno !== 0) {
      console.log(`  FAIL: Login failed: ${result.code || 'unknown'}`);
      return;
    }
    console.log('  Login SUCCESS!');

    // Step 6: Follow redirect chain to get ZM_AUTH_TOKEN
    console.log('\nStep 6: Follow redirect chain to get ZM_AUTH_TOKEN');
    const maxSteps = 15;
    let url = 'https://mail.sjtu.edu.cn/zimbra/mail';
    for (let i = 0; i < maxSteps; i++) {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' });
      const cookieStr = res.headers.get('set-cookie') || '';
      console.log(`  Step ${i}: ${res.status} ${url.substring(0, 80)}`);
      if (cookieStr) {
        console.log(`    Cookie: ${cookieStr.substring(0, 150)}`);
        const zm = cookieStr.match(/ZM_AUTH_TOKEN=([^;]+)/);
        if (zm) {
          console.log(`\n✅ ZM_AUTH_TOKEN: ${zm[1].substring(0, 60)}...`);
          return;
        }
      }
      const loc = res.headers.get('location');
      if (!loc) { console.log('  End of chain (no location)'); break; }
      url = loc.startsWith('http') ? loc : new URL(loc, url).href;
    }
    console.log('\n❌ Failed to get ZM_AUTH_TOKEN');
  } else {
    console.log(`\nUnexpected status: ${r.status}`);
  }
}

main().catch(console.error);
