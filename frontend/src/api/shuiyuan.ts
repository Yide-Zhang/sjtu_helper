/**
 * 水源（shuiyuan.sjtu.edu.cn）API 封装
 *
 * 认证：jAccount OAuth
 *  1. 访问话题 → 302 到 /auth/jaccount → 跳转到 jaccount 登录页
 *  2. 获取验证码 + jAccount 登录 → 获取 session cookie
 *  3. 后续请求自动携带 cookie
 */

import axios from 'axios';
import CookieManager from '@react-native-cookies/cookies';
import { getJAccountUsername, getJAccountPassword } from '../utils/storage';
import { recognizeCaptcha } from '../utils/captcha';
import { loadCaptchaModel } from '../utils/captcha';

const BASE = 'https://shuiyuan.sjtu.edu.cn';
const JACCOUNT_BASE = 'https://jaccount.sjtu.edu.cn';

// ========== 类型 ==========

export interface ShuiyuanPost {
  id: number;
  username: string;
  name: string;
  avatarTemplate: string;
  postNumber: number;
  createdAt: string;
  cooked: string;       // HTML 内容
  raw?: string;         // Markdown（仅单帖 API）
  replyCount: number;
  replyToPostNumber: number | null;
  retorts: Array<{ emoji: string; usernames: string[] }>;
  reads: number;
}

export interface ShuiyuanTopic {
  id: number;
  title: string;
  postsCount: number;
  createdAt: string;
  views: number;
  posts: ShuiyuanPost[];
  tags: string[];
  categoryId: number;
}

export interface ShuiyuanPostDetail extends ShuiyuanPost {
  raw: string;
  userId: number;
  trustLevel: number;
  bookmarked: boolean;
}

// ========== 工具 ==========

export function buildAvatarUrl(template: string, size: number = 120): string {
  return BASE + template.replace('{size}', String(size));
}

// ========== Cookie 管理 ==========

let cookieStr = '';

async function loadCookies() {
  try {
    const cookies = await CookieManager.get(BASE);
    const parts: string[] = [];
    for (const [name, c] of Object.entries(cookies)) {
      if (c.value) parts.push(`${name}=${c.value}`);
    }
    cookieStr = parts.join('; ');
  } catch {
    cookieStr = '';
  }
}

// ========== 认证 ==========

/**
 * 尝试从 jAccount 登录页提取参数（uuid, client, returl, se）
 */
function parseLoginContext(html: string): Record<string, string> | null {
  const m = html.match(/loginContext\s*=\s*\{([^}]+)\}/);
  if (!m) return null;
  const ctx = m[1];
  const get = (key: string) => {
    const r = new RegExp(`\\b${key}\\s*:\\s*"([^"]*)"`);
    const match = ctx.match(r);
    return match ? match[1] : '';
  };
  return {
    uuid: get('uuid'),
    client: get('client'),
    returl: get('returl'),
    se: get('se'),
  };
}

/** 完成一次完整的水源登录流程 */
export async function loginShuiyuan(): Promise<boolean> {
  try {
    // 1. 访问水源首页拿初始 cookie
    await axios.get(BASE + '/', { withCredentials: false });
    await loadCookies();

    // 2. 访问话题触发 OAuth
    const topicRes = await axios.get(BASE + '/t/topic/474776', {
      maxRedirects: 0,
      validateStatus: (s) => s < 400 || s === 302,
    });

    let authUrl = topicRes.headers['location'] as string;
    if (!authUrl || !authUrl.includes('jaccount')) {
      // 可能已登录
      return true;
    }
    if (!authUrl.startsWith('http')) authUrl = BASE + authUrl;

    // 3. 跟随到 jAccount 登录页
    const jacPage = await axios.get(authUrl);
    const params = parseLoginContext(jacPage.data);
    if (!params || !params.uuid) return false;

    // 4. 获取验证码
    const capRes = await axios.get(
      `${JACCOUNT_BASE}/jaccount/captcha?uuid=${params.uuid}&t=${Date.now()}`,
      { responseType: 'arraybuffer', headers: { Referer: JACCOUNT_BASE + '/' } }
    );
    const base64 = Buffer.from(capRes.data, 'binary').toString('base64');

    // 5. 识别验证码
    await loadCaptchaModel();
    const captcha = await recognizeCaptcha(base64);
    if (!captcha) return false;

    // 6. 登录 jAccount
    const username = await getJAccountUsername();
    const password = await getJAccountPassword();
    if (!username || !password) return false;

    const loginRes = await axios.post(
      JACCOUNT_BASE + '/jaccount/ulogin',
      new URLSearchParams({
        sid: 'jaoauth220160718',
        client: params.client,
        returl: params.returl,
        se: params.se,
        v: '',
        uuid: params.uuid,
        user: username,
        pass: password,
        captcha,
        lt: 'p',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: jacPage.request.res.responseUrl || authUrl,
          Origin: JACCOUNT_BASE,
        },
      }
    );

    const data = loginRes.data;
    if (data.errno !== 0) return false;

    // 7. 跟随 OAuth 跳转回水源
    const redirectUrl = JACCOUNT_BASE + data.url;
    await axios.get(redirectUrl);

    // 8. 刷新 cookie
    await loadCookies();
    return true;
  } catch (e) {
    console.warn('[shuiyuan] login failed:', e);
    return false;
  }
}

// ========== API 请求 ==========

async function shuiyuanFetch(url: string) {
  await loadCookies();
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
    validateStatus: (s) => s < 400 || s === 403,
  });
  return res;
}

/**
 * 从话题 ID 获取话题数据
 * 若未登录会自动尝试登录
 */
export async function getShuiyuanTopic(topicId: number): Promise<ShuiyuanTopic | null> {
  try {
    let res = await shuiyuanFetch(`${BASE}/t/topic/${topicId}.json`);

    // 未登录 → 尝试登录
    if (res.status === 403) {
      const ok = await loginShuiyuan();
      if (!ok) return null;
      res = await shuiyuanFetch(`${BASE}/t/topic/${topicId}.json`);
    }

    if (res.status !== 200) return null;

    const data = res.data;

    const posts: ShuiyuanPost[] = (data.post_stream?.posts || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      name: p.name || p.username,
      avatarTemplate: p.avatar_template || '',
      postNumber: p.post_number,
      createdAt: p.created_at,
      cooked: p.cooked || '',
      replyCount: p.reply_count || 0,
      replyToPostNumber: p.reply_to_post_number || null,
      retorts: (p.retorts || []).map((r: any) => ({
        emoji: r.emoji || '',
        usernames: r.usernames || [],
      })),
      reads: p.reads || 0,
    }));

    return {
      id: data.id,
      title: data.title || '',
      postsCount: data.posts_count || 0,
      createdAt: data.created_at || '',
      views: data.views || 0,
      posts,
      tags: data.tags || [],
      categoryId: data.category_id || 0,
    };
  } catch (e) {
    console.warn('[shuiyuan] getTopic failed:', e);
    return null;
  }
}

/**
 * 获取单帖详情（含 raw Markdown）
 */
export async function getShuiyuanPostDetail(postId: number): Promise<ShuiyuanPostDetail | null> {
  try {
    let res = await shuiyuanFetch(`${BASE}/posts/${postId}.json`);

    if (res.status === 403) {
      const ok = await loginShuiyuan();
      if (!ok) return null;
      res = await shuiyuanFetch(`${BASE}/posts/${postId}.json`);
    }

    if (res.status !== 200) return null;

    const p = res.data;
    return {
      id: p.id,
      username: p.username,
      name: p.name || p.username,
      avatarTemplate: p.avatar_template || '',
      postNumber: p.post_number,
      createdAt: p.created_at,
      cooked: p.cooked || '',
      raw: p.raw || '',
      replyCount: p.reply_count || 0,
      replyToPostNumber: p.reply_to_post_number || null,
      retorts: (p.retorts || []).map((r: any) => ({
        emoji: r.emoji || '',
        usernames: r.usernames || [],
      })),
      reads: p.reads || 0,
      userId: p.user_id || 0,
      trustLevel: p.trust_level || 0,
      bookmarked: p.bookmarked || false,
    };
  } catch (e) {
    console.warn('[shuiyuan] getPostDetail failed:', e);
    return null;
  }
}
