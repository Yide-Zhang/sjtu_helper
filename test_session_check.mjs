/**
 * JAccount 会话探测测试脚本
 * 
 * 直接测试 checkJAccountSession 的核心 HTTP 逻辑，
 * 验证各种状态下探测结果是否正确。
 * 
 * 用法：
 *   node test_session_check.mjs              # 默认模式：探测当前 cookie 状态
 *   node test_session_check.mjs --login       # 先登录再探测（需要已登录环境）
 *   node test_session_check.mjs --probe-only  # 仅显示原始响应信息
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── 探测函数（与 jaccount.ts 中 checkJAccountSession 逻辑一致） ───
async function checkSession() {
  const probeUrl = 'https://i.sjtu.edu.cn/xtgl/index_cxDbsy.html?doType=query';
  const body = 'queryModel.showCount=1&queryModel.currentPage=1';

  const res = await fetch(probeUrl, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body,
    redirect: 'follow'
  });

  const finalUrl = res.url;
  const status = res.status;
  const text = await res.text();
  const truncated = text.length > 300 ? text.slice(0, 300) + '...' : text;

  return { finalUrl, status, bodyPreview: truncated, bodyLength: text.length, raw: text };
}

// ─── 显示详细结果 ───
function analyze(result) {
  console.log('');
  console.log('═'.repeat(50));
  console.log('📡 探测结果分析');
  console.log('═'.repeat(50));
  console.log(`  状态码:     ${result.status}`);
  console.log(`  最终 URL:   ${result.finalUrl}`);
  console.log(`  响应体大小: ${result.bodyLength} bytes`);
  console.log(`  响应体预览: ${result.bodyPreview}`);
  console.log('');

  // 判断①：URL 重定向
  const redirected = result.finalUrl.includes('jaccount.sjtu.edu.cn') || 
                     result.finalUrl.includes('jaccountlogin');
  console.log(`  判断① URL 重定向: ${redirected ? '🛑 被重定向 → 未登录' : '✅ 未重定向'}`);

  // 判断②：响应体不是合法 JSON → 说明返回了登录/错误页 HTML
  const trimmed = result.raw.trim();
  const hasLoginHTML = trimmed.startsWith('<') || 
                       result.raw.includes('input-login-user') || 
                       result.raw.includes('jaccountlogin') ||
                       result.raw.includes('错误提示') ||
                       result.raw.includes('未登录');
  console.log(`  判断② HTML 页面:   ${hasLoginHTML ? '🛑 返回了 HTML → 未登录' : '✅ 是 JSON 数据'}`);

  // 判断③：JSON 错误消息
  let jsonError = false;
  try {
    const json = JSON.parse(result.raw);
    if (json.msg && (json.msg.includes('未登录') || json.msg.includes('登录'))) {
      jsonError = true;
      console.log(`  判断③ JSON 消息:   🛑 含未登录标记 → "${json.msg}"`);
    } else {
      console.log(`  判断③ JSON 消息:   ✅ 正常数据`);
    }
  } catch (_) {
    console.log(`  判断③ JSON 消息:   ⏭️ 响应体非 JSON（已由判断②处理）`);
  }

  // 最终结论
  const isAlive = !redirected && !hasLoginHTML && !jsonError;
  console.log('');
  console.log('─'.repeat(50));
  console.log(`  🎯 最终判定: ${isAlive ? '✅ 会话有效' : '❌ 会话已过期'}`);
  console.log('─'.repeat(50));
}

// ─── 登出测试 ───
async function testLogout() {
  console.log('\n🔓 尝试登出...');
  const logoutEndpoints = [
    'https://i.sjtu.edu.cn/logout?t=' + Date.now() + '&login_type=',
    'https://jaccount.sjtu.edu.cn/jaccount/logout',
    'https://jaccount.sjtu.edu.cn/oauth2/logout?post_logout_redirect_uri=https%3A%2F%2Fi.sjtu.edu.cn%2Fxtgl%2Flogin_slogin.html&client_id=MVJGw8u0bzoMJVbfb4Fk'
  ];

  for (const url of logoutEndpoints) {
    try {
      const res = await fetch(url, { 
        method: 'GET',
        headers: { 'User-Agent': UA },
        redirect: 'manual'
      });
      console.log(`  ${url}`);
      console.log(`    → 状态: ${res.status}, URL: ${res.url}`);
    } catch (e) {
      console.log(`  ${url} → 失败: ${e.message}`);
    }
  }
  console.log('  登出请求完成');
}

// ─── 主流程 ───
async function main() {
  const args = process.argv.slice(2);

  console.log('━'.repeat(50));
  console.log('  JAccount 会话探测测试');
  console.log('  ' + new Date().toLocaleString('zh-CN'));
  console.log('━'.repeat(50));

  if (args.includes('--login')) {
    // 先登录再测试（需要用户提前在浏览器登录）
    console.log('\n⚠️  --login 模式：确保已在浏览器登录 jAccount');
    await new Promise(r => setTimeout(r, 1000));
  }

  if (args.includes('--logout-first')) {
    await testLogout();
    console.log('\n⏳ 等待 2 秒让登出生效...');
    await new Promise(r => setTimeout(r, 2000));
  }

  // 执行探测
  let result;
  try {
    result = await checkSession();
    analyze(result);
  } catch (e) {
    console.error('\n❌ 探测请求失败:', e.message);
    process.exit(1);
  }

  // 如果带 --full 参数，输出完整响应体到文件
  if (args.includes('--full')) {
    const fs = await import('fs');
    fs.writeFileSync('probe_response.html', result.raw);
    console.log('\n📄 完整响应已写入 probe_response.html');
  }

  // 如果带 --logout 参数，先登出再测一次对比
  if (args.includes('--logout')) {
    console.log('\n\n');
    console.log('━'.repeat(50));
    console.log('  登出后再次探测');
    console.log('━'.repeat(50));
    
    await testLogout();
    console.log('\n⏳ 等待 2 秒...');
    await new Promise(r => setTimeout(r, 2000));

    const result2 = await checkSession();
    analyze(result2);
  }
}

main().catch(e => {
  console.error('❌ 脚本异常:', e);
  process.exit(1);
});
