import { getJAccountUsername, getJAccountPassword } from '../utils/storage';

const PORTAL_URL = 'https://i.sjtu.edu.cn/jaccountlogin';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const log = (msg: string, ...args: any[]) => console.log(`[autoLogin] ${msg}`, ...args);
const warn = (msg: string, ...args: any[]) => console.warn(`[autoLogin] ${msg}`, ...args);

/** 用 XHR 获取图片 base64，避免 RN fetch().blob() 的 "Failed to construct 'Response'" 问题 */
function xhrFetchImageAsBase64(url: string, referer?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('User-Agent', UA);
    if (referer) xhr.setRequestHeader('Referer', referer);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) { resolve(null); return; }
      const bytes = new Uint8Array(xhr.response);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      resolve(btoa(binary));
    };
    xhr.onerror = () => resolve(null);
    xhr.send();
  });
}

/**
 * 核心会话探测器：负责通过 fetch 检查当前系统 Cookie 是否有效
 * 同时检测 URL 重定向和响应体内容，防止 AJAX 接口静默返回登录页的情况
 */
export async function checkJAccountSession(): Promise<boolean> {
  try {
    const probeUrl = 'https://i.sjtu.edu.cn/xtgl/index_cxDbsy.html?doType=query';
    const body = `queryModel.showCount=1&queryModel.currentPage=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s 超时
    const res = await fetch(probeUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    });
    clearTimeout(timeoutId);

    const finalUrl = res.url;

    // 判断①：URL 发生了重定向 → 未登录
    if (finalUrl.includes('jaccount.sjtu.edu.cn') || finalUrl.includes('jaccountlogin')) {
      console.log('[Session Check] 🛑 探测被重定向至登录页，会话未登录或已过时');
      return false;
    }

    // 判断②：响应体不是合法 JSON → 说明返回了登录/错误页 HTML
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || 
        text.includes('input-login-user') || 
        text.includes('jaccountlogin') ||
        text.includes('错误提示') ||
        text.includes('未登录')) {
      console.log('[Session Check] 🛑 探测返回了 HTML 页面（非 JSON），会话未登录或已过时');
      return false;
    }

    // 判断③：响应体的 JSON 中包含了错误提示
    try {
      const json = JSON.parse(text);
      if (json.msg && (json.msg.includes('未登录') || json.msg.includes('登录'))) {
        console.log('[Session Check] 🛑 JSON 中包含未登录标记:', json.msg);
        return false;
      }
    } catch (_) {
      // 不是 JSON 或者已经是 HTML 了，上面已经拦截
    }

    console.log('[Session Check] 🎉 探测接口成功响应，会话在线');
    return true;
  } catch (error) {
    console.warn('[Session Check] ⚠️ 探测请求发生网络异常:', error);
    // 网络异常时保守返回 false，让界面提示用户会话可能不可用
    return false;
  }
}

export async function autoLoginJAccount(): Promise<{ success: boolean; reason?: string }> {
  const MAX_RETRIES = 5;
  const username = await getJAccountUsername();
  const password = await getJAccountPassword();
  if (!username || !password) {
    return { success: false, reason: 'WRONG_USER_OR_PASSWORD' };
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const loginPageRes = await fetch(
        'https://jaccount.sjtu.edu.cn/jaccount/jalogin?sid=jaoauth220160718',
        { headers: { 'User-Agent': UA } }
      );
      const html = await loginPageRes.text();

      const extract = (regex: RegExp): string => {
        const m = html.match(regex);
        return m ? encodeURIComponent(m[1]) : '';
      };
      const sid = 'jaoauth220160718';
      const client = extract(/name="client"\s+value="([^"]*)"/i);
      const returl = extract(/name="returl"\s+value="([^"]*)"/i);
      const se = extract(/name="se"\s+value="([^"]*)"/i);
      const uuidMatch = html.match(/uuid:\s*"([^"]+)"/);
      const uuid = uuidMatch ? uuidMatch[1] : '';

      if (!client || !uuid) {
        if (loginPageRes.url && !loginPageRes.url.includes('jalogin')) return { success: true };
        return { success: false, reason: 'Failed to parse login page' };
      }

      let captchaText = '';
      try {
        const base64Data = await xhrFetchImageAsBase64(
          `https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid=${uuid}&t=${Date.now()}`, 'https://jaccount.sjtu.edu.cn/'
        );
        if (!base64Data) continue;
        const { recognizeCaptcha } = await import('../utils/captcha');
        captchaText = await recognizeCaptcha(base64Data);
      } catch (e: any) {
        continue;
      }

      if (!captchaText) continue;

      const bodyArgs = [
        `sid=${sid}`, `client=${client}`, `returl=${returl}`, `se=${se}`, `v=`,
        `uuid=${uuid}`, `user=${encodeURIComponent(username)}`, `pass=${encodeURIComponent(password)}`,
        `captcha=${encodeURIComponent(captchaText)}`, `lt=p`
      ];

      const loginRes = await fetch('https://jaccount.sjtu.edu.cn/jaccount/ulogin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': UA,
          'Referer': loginPageRes.url,
          'Origin': 'https://jaccount.sjtu.edu.cn',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: bodyArgs.join('&')
      });

      const responseJson = await loginRes.json();
      if (responseJson.errno === 0) return { success: true };
      if (responseJson.code === 'WRONG_USER_OR_PASSWORD') return { success: false, reason: 'WRONG_USER_OR_PASSWORD' };
      if (responseJson.code === 'WRONG_CAPTCHA') continue;
      return { success: false, reason: responseJson.error || 'Unknown error' };
    } catch (error: any) {
      if (attempt === MAX_RETRIES - 1) return { success: false, reason: error?.message || 'Network error' };
    }
  }
  return { success: false, reason: 'WRONG_CAPTCHA' };
}

export async function ensureJAccountLogin(): Promise<boolean> {
  try {
    const initialRes = await fetch(PORTAL_URL);
    if (!initialRes.url.includes('jaccount.sjtu.edu.cn')) return true;
    const html = await initialRes.text();
    const executionMatch = html.match(/name=\"execution\"\s+value=\"([^\"]+)\"/i);
    if (!executionMatch) throw new Error('Failed to parse execution token.');
    const execution = executionMatch[1];
    const username = await getJAccountUsername();
    const password = await getJAccountPassword();
    if (!username || !password) throw new Error('No credentials.');

    const bodyArgs = [
      `user=${encodeURIComponent(username)}`, `pass=${encodeURIComponent(password)}`,
      `captcha=`, `execution=${encodeURIComponent(execution)}`, `_eventId=submit`
    ];

    const loginRes = await fetch(initialRes.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, 'Referer': initialRes.url },
      body: bodyArgs.join('&')
    });

    if (loginRes.url.includes('i.sjtu.edu.cn') || loginRes.url.includes('index')) return true;
    throw new Error('Login failed.');
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function fetchCourseHTML(xnm: string = '2025', xqm: string = '16'): Promise<string> {
  const courseUrl = 'https://i.sjtu.edu.cn/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N253508';
  const body = `xnm=${xnm}&xqm=${xqm}&kzlx=ck&xsdm=&kclbdm=&kclxdm=`;
  const res = await fetch(courseUrl, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (res.url.includes('jaccount.sjtu.edu.cn') || res.url.includes('jaccountlogin')) throw new Error('登录已过期');
  return await res.text();
}

export async function fetchWeeklyScheduleJSON(xnm: string = '2025', xqm: string = '12', week: number = 1): Promise<string> {
  const weekUrl = 'https://i.sjtu.edu.cn/kbcx/xskbcxMobile_cxXsKb.html?gnmkdm=N2154';
  const body = `xnm=${xnm}&zs=${week}&doType=app&xqm=${xqm}&kblx=1&xh=`;
  const res = await fetch(weekUrl, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (res.url.includes('jaccount.sjtu.edu.cn') || res.url.includes('jaccountlogin')) throw new Error('登录失效');
  return await res.text();
}

export async function fetchExamJSON(xnm: string = '2025', xqm: string = '12'): Promise<string> {
  const examUrl = 'https://i.sjtu.edu.cn/kwgl/kscx_cxXsksxxIndex.html?doType=query&gnmkdm=N358105';
  const body = `xnm=${xnm}&xqm=${xqm}&queryModel.showCount=100&queryModel.currentPage=1&queryModel.sortName=&queryModel.sortOrder=asc&time=0`;
  const res = await fetch(examUrl, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (res.url.includes('jaccount.sjtu.edu.cn') || res.url.includes('jaccountlogin')) throw new Error('登录已过期');
  return await res.text();
}

// 成绩列表：获取某学期所有课程及总评
export async function fetchGradeList(xnm: string = '2025', xqm: string = '12'): Promise<string> {
  const url = 'https://i.sjtu.edu.cn/cjcx/cjcx_cxXsKcList.html?gnmkdm=N305007';
  const body = `xnm=${xnm}&xqm=${xqm}&_search=false&nd=${Date.now()}&queryModel.showCount=100&queryModel.currentPage=1&queryModel.sortName=+&queryModel.sortOrder=asc&time=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (res.url.includes('jaccount.sjtu.edu.cn') || res.url.includes('jaccountlogin')) throw new Error('登录已过期');
  return await res.text();
}

// 成绩明细：获取单门课程的分数构成
export async function fetchGradeDetail(jxbId: string, xnm: string = '2025', xqm: string = '12'): Promise<string> {
  const url = 'https://i.sjtu.edu.cn/cjcx/cjcx_cxXsXmcjList.html?gnmkdm=N305007';
  const body = `jxb_id=${jxbId}&xnm=${xnm}&xqm=${xqm}&_search=false&nd=${Date.now()}&queryModel.showCount=100&queryModel.currentPage=1&queryModel.sortName=+&queryModel.sortOrder=asc&time=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (res.url.includes('jaccount.sjtu.edu.cn') || res.url.includes('jaccountlogin')) throw new Error('登录已过期');
  return await res.text();
}

export async function fetchNotificationsJSON(): Promise<string> {
  const infoUrl = 'https://i.sjtu.edu.cn/xtgl/index_cxDbsy.html?doType=query';
  const body = `queryModel.showCount=50&queryModel.currentPage=1&queryModel.sortName=cjsj&queryModel.sortOrder=desc&time=0`;
  const res = await fetch(infoUrl, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (res.url.includes('jaccount.sjtu.edu.cn') || res.url.includes('jaccountlogin')) throw new Error('登录失效');
  return await res.text();
}