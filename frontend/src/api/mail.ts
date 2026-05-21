import { getJAccountUsername, getJAccountPassword } from '../utils/storage';
import { setMailAuthToken, getMailAuthToken, setMailCsrfToken, getMailCsrfToken, getMailSessionId, setMailSessionId } from '../utils/mailStorage';

const MAIL_BASE = 'https://mail.sjtu.edu.cn';
const SOAP_URL = `${MAIL_BASE}/service/soap/BatchRequest`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface ZimbraMessage {
  id: string; flags: string; subject: string;
  from: { name: string; address: string }; to: { name: string; address: string }[];
  date: number; fragment?: string; content?: string; contentType?: string;
  attachments?: { name: string; contentType: string; size: number; part: string }[];
}

function buildEnvelope(sessionId: string, accountName: string, csrf: string, bodyXml: string): string {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Header><context xmlns="urn:zimbra"><userAgent name="ZimbraWebClient - RN" version="10.0.18_GA_4828"/><session id="${sessionId}"/><account by="name">${accountName}</account><format type="js"/><csrfToken>${csrf}</csrfToken></context></soap:Header><soap:Body>${bodyXml}</soap:Body></soap:Envelope>`;
}
function esc(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }

// ── XHR 封装（withCredentials=true，让原生 cookie 存储处理 ZM_AUTH_TOKEN）──
function xhrFetch(url: string, options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}): Promise<{ status: number; headers: Record<string, string>; text: string; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'GET', url, true);
    xhr.timeout = options.timeout ?? 20000; // 默认 20s 超时
    const hdrs = { 'User-Agent': UA, ...options.headers };
    for (const [k, v] of Object.entries(hdrs)) xhr.setRequestHeader(k, v);
    xhr.withCredentials = true;
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      const headerText = xhr.getAllResponseHeaders();
      const headers: Record<string, string> = {};
      for (const line of headerText.split('\r\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) { const k = line.substring(0, idx).trim().toLowerCase(); const v = line.substring(idx + 1).trim(); headers[k] = headers[k] ? headers[k] + '\n' + v : v; }
      }
      resolve({ status: xhr.status, headers, text: xhr.responseText, finalUrl: xhr.responseURL || url });
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.ontimeout = () => reject(new Error('Request timeout'));
    xhr.send(options.body || null);
  });
}

/** 带自动重试的 xhrFetch（网络/超时错误时最多重试 2 次） */
async function xhrFetchWithRetry(url: string, options: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number } = {}, retries = 2): Promise<{ status: number; headers: Record<string, string>; text: string; finalUrl: string }> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await xhrFetch(url, options);
    } catch (e: any) {
      const isRetryable = e?.message === 'Network error' || e?.message === 'Request timeout' || e?.message?.includes('connection reset') || e?.message?.includes('ECONNRESET');
      if (i < retries && isRetryable) {
        console.warn(`[Mail] xhrFetch 错误(${e.message}) 第${i + 1}次重试`, url.substring(0, 80));
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 递增延迟 1s, 2s
      } else {
        throw e;
      }
    }
  }
  throw new Error('Network error (all retries exhausted)');
}

/** 用 XHR 获取图片，返回 base64 编码的图片数据（不含 data: URI 前缀），避免 RN fetch().blob() 的 bug */
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

function extractCsrf(html: string): string | null {
  const m = html.match(/csrfToken["']?\s*[:=]\s*["']([^"']+)["']/);
  return m ? m[1] : null;
}

// ── 认证 ──
// 策略：用 XHR withCredentials=true 走完重定向链，原生 cookie 存储自动管理 ZM_AUTH_TOKEN。
// 我们只需从 /zimbra/mail 页面提取 CSRF token。

/** 尝试访问 /zimbra/mail 并提取 CSRF，若返回空说明会话已过期 */
async function tryFetchCsrf(): Promise<string | null> {
  try {
    const resp = await xhrFetch(`${MAIL_BASE}/zimbra/mail`, { timeout: 10000 });
    const csrf = extractCsrf(resp.text);
    return csrf || null;
  } catch { return null; }
}

/** 带重试的邮箱认证（最多尝试 3 次） */
export async function ensureMailAuth(): Promise<boolean> {
  // 1) 已有 CSRF token → 验证其是否仍然有效
  const existing = await getMailCsrfToken();
  if (existing) {
    const csrf = await tryFetchCsrf();
    if (csrf) {
      // 会话仍然有效，更新 token（可能换了）
      if (csrf !== existing) await setMailCsrfToken(csrf);
      return true;
    }
    // 会话已过期，清除旧 token 重新登录
    await setMailCsrfToken('');
    console.log('[Mail Auth] 会话已过期，需要重新认证');
  }

  // 重试循环
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // 2) GET /zimbra/mail → XHR 跟随重定向 → 最终要么是 mail 页要么是登录页
      let resp = await xhrFetch(`${MAIL_BASE}/zimbra/mail`);

      // 3) 如果已有 CSRF → 认证成功
      if (extractCsrf(resp.text)) {
        await setMailCsrfToken(extractCsrf(resp.text)!);
        return true;
      }

      // 4) 解析 jAccount 登录页
      const html = resp.text;
      const getJs = (k: string) => html.match(new RegExp(`${k}:\\s*"([^"]*)"`))?.[1] || '';
      const returl = getJs('returl'), se = getJs('se'), uuid = getJs('uuid');
      if (!uuid || !returl) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; }
        return false;
      }

      // 5) 验证码 — 用 XHR 获取图片 base64
      const b64 = await xhrFetchImageAsBase64(`https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid=${uuid}&t=${Date.now()}`, 'https://jaccount.sjtu.edu.cn/');
      if (!b64) { if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; } return false; }
      const { recognizeCaptcha } = await import('../utils/captcha');
      const captchaText = await recognizeCaptcha(b64);
      if (!captchaText) { if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; } return false; }

      // 6) POST ulogin
      const uname = await getJAccountUsername(), passwd = await getJAccountPassword();
      if (!uname || !passwd) return false;
      const loginRes = await xhrFetch('https://jaccount.sjtu.edu.cn/jaccount/ulogin', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `https://jaccount.sjtu.edu.cn/jaccount/jalogin?sid=jasjtumail`, 'X-Requested-With': 'XMLHttpRequest' },
        body: `sid=jasjtumail&client=&returl=${encodeURIComponent(returl)}&se=${encodeURIComponent(se)}&v=&uuid=${uuid}&user=${encodeURIComponent(uname!)}&pass=${encodeURIComponent(passwd!)}&captcha=${encodeURIComponent(captchaText)}&lt=p`,
      });
      let json: any;
      try { json = JSON.parse(loginRes.text); } catch { json = null; }
      if (json && json.errno !== 0) {
        if (json.code === 'WRONG_CAPTCHA' && attempt < 2) { await new Promise(r => setTimeout(r, 1500)); continue; }
        return false;
      }
      if (!json && loginRes.finalUrl.includes('err=1')) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; }
        return false;
      }

      // 7) 登录成功！再访问 /zimbra/mail 确认并提取 CSRF
      const final = await xhrFetch(`${MAIL_BASE}/zimbra/mail`);
      const csrf = extractCsrf(final.text);
      if (csrf) { await setMailCsrfToken(csrf); return true; }
      return false;
    } catch (e: any) {
      console.error(`[Mail Auth] attempt ${attempt} failed:`, e?.message || e);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

// ── 标记已读 ──
export async function markAsRead(msgId: string): Promise<boolean> {
  const csrfToken = await getMailCsrfToken();
  if (!csrfToken) return false;
  const username = await getJAccountUsername();
  if (!username) return false;
  const bodyXml = `<BatchRequest xmlns="urn:zimbra" onerror="continue"><MsgActionRequest xmlns="urn:zimbraMail" requestId="0"><action id="${msgId}" op="read"/></MsgActionRequest></BatchRequest>`;
  const result = await soapCall('', `${username}@sjtu.edu.cn`, bodyXml);
  return !!result?.Body?.BatchResponse?.MsgActionResponse;
}

/** 删除邮件（移入垃圾箱） */
export async function deleteMessage(msgId: string): Promise<boolean> {
  const csrfToken = await getMailCsrfToken();
  if (!csrfToken) return false;
  const username = await getJAccountUsername();
  if (!username) return false;
  const bodyXml = `<BatchRequest xmlns="urn:zimbra" onerror="continue"><MsgActionRequest xmlns="urn:zimbraMail" requestId="0"><action id="${msgId}" op="trash"/></MsgActionRequest></BatchRequest>`;
  const result = await soapCall('', `${username}@sjtu.edu.cn`, bodyXml);
  return !!result?.Body?.BatchResponse?.MsgActionResponse;
}

// ── SOAP（XHR withCredentials=true 自动发送 ZM_AUTH_TOKEN cookie）──
async function soapCall(sessionId: string, accountName: string, bodyXml: string): Promise<any> {
  const csrfToken = await getMailCsrfToken();
  if (!csrfToken) return null;
  try {
    const res = await xhrFetchWithRetry(SOAP_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/soap+xml; charset=UTF-8' },
      body: buildEnvelope(sessionId, accountName, csrfToken, bodyXml),
    });
    // 尝试从响应 header 中提取 ZM_AUTH_TOKEN 存入 storage
    const sc = res.headers['set-cookie'] || '';
    const zm = sc.match(/ZM_AUTH_TOKEN=([^;]+)/);
    if (zm) await setMailAuthToken(zm[1]);
    return JSON.parse(res.text);
  } catch { return null; }
}

function parseMsg(m: any): ZimbraMessage {
  const addrs = (m.e || []);
  const getAddr = (a: any) => ({ name: a.d || a.a || '', address: a.a || '' });
  let from: { name: string; address: string } = { name: '', address: '' };
  const to: { name: string; address: string }[] = [];
  for (const a of addrs) {
    const addr = getAddr(a);
    if (!addr.address || addr.address === 'null') continue;
    if (a.t === 'f' || a.t === 's') {
      from = addr;
    } else {
      // t='t' (收件人), t='c' (抄送), 或无 t 字段 → 都归入 to
      to.push(addr);
    }
  }
  // 若没有 type='f' 的地址，回退到第一个有效地址作为 from
  if (!from.address) {
    const first = addrs.find((a: any) => a.a && a.a !== 'null');
    if (first) {
      from = getAddr(first);
      // 将其从 to 中移除（避免自己变成自己的收件人）
      const idx = to.findIndex(t => t.address === from.address);
      if (idx >= 0) to.splice(idx, 1);
    }
  }
  let attachments: ZimbraMessage['attachments'];
  if (m.mp) { attachments = []; const walk = (ps: any[]) => { for (const p of ps) { if (p.cd === 'attachment' || p.ci) attachments!.push({ name: p.nm || '附件', contentType: p.ct || '', size: p.s || 0, part: p.part || '' }); if (p.mp) walk(p.mp); } }; walk(m.mp); }
  return { id: m.id, flags: m.f || '', subject: m.su || '(无主题)', from, to, date: m.d || 0, fragment: m.fr || '', attachments: attachments?.length ? attachments : undefined };
}

export async function fetchInbox(limit = 20, offset = 0): Promise<{ messages: ZimbraMessage[]; sessionId: string } | null> {
  return fetchFolder('in:inbox', limit, offset);
}

export type MailFolderQuery = 'in:inbox' | 'in:drafts' | 'in:sent' | 'in:junk' | 'in:trash';

/** 通用文件夹搜索：根据 query 拉取邮件列表 */
export async function fetchFolder(query: MailFolderQuery, limit = 50, offset = 0): Promise<{ messages: ZimbraMessage[]; sessionId: string } | null> {
  const username = await getJAccountUsername(); if (!username) return null;
  const csrfToken = await getMailCsrfToken();
  if (!csrfToken) return null;
  const account = `${username}@sjtu.edu.cn`;
  const sessionId = await getMailSessionId() || '';

  // 与 search_sent.har 中 Zimbra Web 客户端完全一致的请求格式
  const jsonBody = JSON.stringify({
    Header: { context: { _jsns: 'urn:zimbra', userAgent: { name: 'ZimbraWebClient - RN', version: '10.0.18_GA_4828' },
      session: sessionId ? { _content: sessionId, id: sessionId } : { _content: '', id: '' },
      account: { _content: account, by: 'name' }, csrfToken } },
    Body: { SearchRequest: { _jsns: 'urn:zimbraMail', types: 'message', limit, offset,
      query, recip: '2', needExp: 1, sortBy: 'dateDesc',
      header: [{ n: 'List-ID' }, { n: 'X-Zimbra-DL' }, { n: 'IN-REPLY-TO' }],
      tz: { id: 'Asia/Shanghai' }, locale: { _content: 'zh_CN' } } }
  });

  try {
    const res = await xhrFetchWithRetry(`${MAIL_BASE}/service/soap/SearchRequest`, {
      method: 'POST', headers: { 'Content-Type': 'application/soap+xml; charset=UTF-8' },
      body: jsonBody,
    });
    const result = JSON.parse(res.text);
    const msgs = result?.Body?.SearchResponse?.m || [];
    const newSessionId = result?.Header?.context?.session?.id || '';
    if (newSessionId) await setMailSessionId(newSessionId);
    return { messages: msgs.map(parseMsg), sessionId: newSessionId };
  } catch {
    // XML 备选路径（BatchRequest 格式）
    const bodyXml = `<BatchRequest xmlns="urn:zimbra" onerror="continue"><SearchRequest xmlns="urn:zimbraMail" requestId="0"><query>${esc(query)}</query><types>message</types><limit>${limit}</limit><offset>${offset}</offset><recip>2</recip></SearchRequest></BatchRequest>`;
    const result = await soapCall(sessionId, account, bodyXml);
    if (!result?.Body?.BatchResponse?.SearchResponse) return null;
    const newSessionId = result.Header?.context?.session?.id || '';
    if (newSessionId) await setMailSessionId(newSessionId);
    return { messages: (result.Body.BatchResponse.SearchResponse[0]?.m || []).map(parseMsg), sessionId: newSessionId };
  }
}

export async function fetchMessageDetail(msgId: string): Promise<ZimbraMessage | null> {
  const username = await getJAccountUsername(), sessionId = await getMailSessionId();
  if (!username) return null;
  const result = await soapCall(sessionId || '', `${username}@sjtu.edu.cn`,
    `<BatchRequest xmlns="urn:zimbra" onerror="continue"><GetMsgRequest xmlns="urn:zimbraMail" requestId="0"><m id="${msgId}" html="1" needExp="1"/></GetMsgRequest></BatchRequest>`);
  if (!result?.Body?.BatchResponse?.GetMsgResponse) return null;
  const m = result.Body.BatchResponse.GetMsgResponse[0]?.m?.[0]; if (!m) return null;
  const msg = parseMsg(m);
  const findBody = (parts: any[]): { content: string; ct: string } | null => { for (const p of parts) { if (p.body && p.content) return { content: p.content, ct: p.ct || 'text/plain' }; if (p.mp) { const r = findBody(p.mp); if (r) return r; } } return null; };
  const body = findBody(m.mp || []); if (body) { msg.content = body.content; msg.contentType = body.ct; }
  return msg;
}

export async function sendMessage(to: string[], subject: string, bodyText: string, cc?: string[], bcc?: string[], attachmentUris?: { name: string; uri: string; mimeType: string }[]): Promise<boolean> {
  const username = await getJAccountUsername(), sessionId = await getMailSessionId(), csrf = await getMailCsrfToken();
  if (!username || !sessionId || !csrf) return false;

  // 1) 上传附件得到 aid
  let aids: string[] = [];
  if (attachmentUris && attachmentUris.length > 0) {
    for (const file of attachmentUris) {
      try {
        const aid = await uploadFile(file.uri, file.name, file.mimeType, sessionId, csrf);
        if (aid) aids.push(aid);
        else console.warn('[Mail] Upload returned null for', file.name);
      } catch (e) {
        console.warn('[Mail] 上传附件异常:', file.name, e);
      }
    }
    console.log('[Mail] Uploaded files, aids:', JSON.stringify(aids));
  }

  // 2) SaveDraft（含附件时必需；无附件时也可先存再发，更稳定）
  const draftId = await saveDraft(to, subject, bodyText, cc, bcc, aids);
  if (!draftId) {
    console.warn('[Mail] SaveDraft failed, abort send');
    return false;
  }

  // 3) SendMsg — 发送草稿
  const sendBody = `<BatchRequest xmlns="urn:zimbra" onerror="continue"><SendMsgRequest xmlns="urn:zimbraMail" requestId="0"><m id="${esc(draftId)}"/></SendMsgRequest></BatchRequest>`;
  const sendResult = await soapCall(sessionId, `${username}@sjtu.edu.cn`, sendBody);
  const ok = !!sendResult?.Body?.BatchResponse?.SendMsgResponse;
  console.log('[Mail] SendMsg result:', ok ? 'success' : 'fail');
  return ok;
}

/** 存草稿 — 返回草稿的邮件 ID，失败返回 null */
export async function saveDraft(
  to: string[], subject: string, bodyText: string,
  cc?: string[], bcc?: string[], attachmentAids?: string[],
): Promise<string | null> {
  const username = await getJAccountUsername(), sessionId = await getMailSessionId(), csrf = await getMailCsrfToken();
  if (!username || !sessionId || !csrf) return null;
  const account = `${username}@sjtu.edu.cn`;

  // 构造 SaveDraftRequest 的 JSON 体（对照 mail_send_draft_req.har）
  const e: any[] = [];
  // 发件人（t: "f"）
  e.push({ t: 'f', a: account, p: username });
  // 收件人（t: "t"）
  for (const addr of to) e.push({ t: 't', a: addr });
  // 抄送（t: "c"）
  if (cc) for (const addr of cc) e.push({ t: 'c', a: addr });
  // 密送（t: "b"）
  if (bcc) for (const addr of bcc) e.push({ t: 'b', a: addr });

  const m: any = {
    e,
    su: { _content: subject || '' },
    mp: [{ ct: 'text/plain', content: { _content: bodyText || '' } }],
  };

  // 附件 aid 直接挂在 m 上（与 XML <attach aid="xxx"/> 对应）
  if (attachmentAids && attachmentAids.length > 0) {
    m.attach = attachmentAids.map(aid => ({ aid }));
  }

  const jsonBody = JSON.stringify({
    Header: {
      context: {
        _jsns: 'urn:zimbra',
        userAgent: { name: 'ZimbraWebClient - RN', version: '10.0.18_GA_4828' },
        session: { _content: sessionId, id: sessionId },
        account: { _content: account, by: 'name' },
        csrfToken: csrf,
      },
    },
    Body: {
      SaveDraftRequest: {
        _jsns: 'urn:zimbraMail',
        m,
      },
    },
  });

  try {
    const res = await xhrFetchWithRetry(`${MAIL_BASE}/service/soap/SaveDraftRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=UTF-8' },
      body: jsonBody,
    });
    const result = JSON.parse(res.text);
    const draftId = result?.Body?.SaveDraftResponse?.m?.[0]?.id;
    console.log('[Mail] saveDraft JSON', draftId ? 'OK id=' + draftId : 'FAIL', res.status);
    return draftId || null;
  } catch (e) {
    console.warn('[Mail] saveDraft JSON failed, fallback to XML', e);
    // XML 备选
    const toXml = to.map(t => `<e a="${esc(t)}" t="t"/>`).join('');
    const peopleXml = `${toXml}${(cc||[]).map(c=>`<e a="${esc(c)}" t="c"/>`).join('')}${(bcc||[]).map(b=>`<e a="${esc(b)}" t="b"/>`).join('')}`;
    const bodyXml = bodyText ? `<mp ct="text/plain"><content>${esc(bodyText)}</content></mp>` : '';
    const attachXml = (attachmentAids || []).map(a => `<attach aid="${esc(a)}"/>`).join('');
    const subjectXml = subject ? `<su>${esc(subject)}</su>` : '';
    const draftBody = `<BatchRequest xmlns="urn:zimbra" onerror="continue"><SaveDraftRequest xmlns="urn:zimbraMail" requestId="0"><m><e a="${esc(account)}" t="f"/>${peopleXml}${subjectXml}${bodyXml}${attachXml}</m></SaveDraftRequest></BatchRequest>`;
    const result = await soapCall(sessionId, account, draftBody);
    const draftId = result?.Body?.BatchResponse?.SaveDraftResponse?.[0]?.m?.[0]?.id;
    console.log('[Mail] saveDraft XML', draftId ? 'OK id=' + draftId : 'FAIL');
    return draftId || null;
  }
}

/** 上传文件到 Zimbra，返回 attachment ID (aid) */
async function uploadFile(uri: string, fileName: string, mimeType: string, sessionId: string, csrf: string): Promise<string | null> {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const result = await _uploadOnce(uri, fileName, mimeType, csrf);
      if (result) return result;
      if (attempt < 2) {
        console.warn(`[Mail] 上传返回空，第${attempt + 1}次重试`, fileName);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    } catch (e) {
      if (attempt < 2) {
        console.warn(`[Mail] 上传异常(${attempt + 1}/3):`, fileName, e);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        console.warn('上传附件多次失败:', fileName, e);
        return null;
      }
    }
  }
  return null;
}

async function _uploadOnce(uri: string, fileName: string, mimeType: string, csrf: string): Promise<string | null> {
  const result = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${MAIL_BASE}/service/upload?fmt=extended,raw&charset=utf-8`, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('X-Zimbra-Csrf-Token', csrf);
    xhr.setRequestHeader('Cache-Control', 'no-cache');
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      resolve({ status: xhr.status, text: xhr.responseText });
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    const formData = new FormData();
    formData.append('file', { uri, name: fileName, type: mimeType } as any);
    xhr.send(formData);
  });

  if (result.status >= 200 && result.status < 300) {
    try {
      const m = result.text.match(/"aid"\s*:\s*"([^"]+)"/);
      if (m) {
        console.log('[Mail] Upload OK, aid=' + m[1]);
        return m[1];
      }
    } catch {}
    const m2 = result.text.match(/aid\s*=\s*["']?\s*([^\s"'&]+)/i);
    if (m2) { console.log('[Mail] Upload OK (old format), aid=' + m2[1]); return m2[1]; }
    const num = result.text.trim().match(/\b(\d+)\b/);
    if (num) { console.log('[Mail] Upload OK (numeric), aid=' + num[1]); return num[1]; }
    console.warn('[Mail] Upload success but no aid found: ' + result.text.substring(0, 200));
    return null;
  }
  return null;
}

// ── 诊断 ──
export interface MailDiagnoseResult { steps: { name: string; ok: boolean; detail: string }[]; success: boolean; }
export async function diagnoseMailAuth(): Promise<MailDiagnoseResult> {
  const steps: MailDiagnoseResult['steps'] = []; const add = (n: string, o: boolean, d: string) => steps.push({ name: n, ok: o, detail: d });
  try {
    add('CSRF token', !!(await getMailCsrfToken()), (await getMailCsrfToken()) || '无');
    add('ZM_AUTH_TOKEN(storage)', !!(await getMailAuthToken()), (await getMailAuthToken())?.substring(0,30) || '无');

    // GET /zimbra/mail
    const r = await xhrFetch(`${MAIL_BASE}/zimbra/mail`);
    add('GET /zimbra/mail', true, `status=${r.status}, finalUrl=${r.finalUrl.substring(0, 80)}, csrf=${extractCsrf(r.text) ? '✅' : '❌'}, set-cookie=${(r.headers['set-cookie'] || '(none)').substring(0, 100)}`);

    if (extractCsrf(r.text)) { add('状态', true, '已认证'); return { steps, success: true }; }

    const html = r.text;
    if (!html.includes('loginContext')) { add('未知页面', false, '无 loginContext'); return { steps, success: false }; }

    const getJs = (k: string) => html.match(new RegExp(`${k}:\\s*"([^"]*)"`))?.[1] || '';
    const uuid = getJs('uuid'), returl = getJs('returl'), se = getJs('se');
    add('解析登录页', !!uuid, `uuid=${uuid?.substring(0,8)||'✗'}`);
    if (!uuid) return { steps, success: false };

    const b64 = await xhrFetchImageAsBase64(`https://jaccount.sjtu.edu.cn/jaccount/captcha?uuid=${uuid}&t=${Date.now()}`, 'https://jaccount.sjtu.edu.cn/');
    if (!b64) { add('验证码', false, '获取图片失败'); return { steps, success: false }; }
    const { recognizeCaptcha } = await import('../utils/captcha');
    const captchaText = await recognizeCaptcha(b64);
    add('验证码', !!captchaText, captchaText ? `"${captchaText}"` : '失败');
    if (!captchaText) return { steps, success: false };

    const uname = await getJAccountUsername(), passwd = await getJAccountPassword();
    const lr = await xhrFetch('https://jaccount.sjtu.edu.cn/jaccount/ulogin', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `https://jaccount.sjtu.edu.cn/jaccount/jalogin?sid=jasjtumail`, 'X-Requested-With': 'XMLHttpRequest' },
      body: `sid=jasjtumail&client=&returl=${encodeURIComponent(returl)}&se=${encodeURIComponent(se)}&v=&uuid=${uuid}&user=${encodeURIComponent(uname!)}&pass=${encodeURIComponent(passwd!)}&captcha=${encodeURIComponent(captchaText)}&lt=p`,
    });
    let json: any; try { json = JSON.parse(lr.text); } catch {}
    add('登录提交', (json?.errno === 0) || (!json && !lr.finalUrl.includes('err=1')), json ? `errno=${json.errno}` : `finalUrl=${lr.finalUrl.substring(0, 80)}`);

    const final = await xhrFetch(`${MAIL_BASE}/zimbra/mail`);
    const gotCsrf = extractCsrf(final.text);
    if (gotCsrf) await setMailCsrfToken(gotCsrf);
    add('最终', !!gotCsrf, gotCsrf ? `CSRF=${gotCsrf.substring(0,30)}` : '未获得 CSRF');
    return { steps, success: !!gotCsrf };
  } catch (e: any) { add('异常', false, e?.message || '未知'); return { steps, success: false }; }
}
