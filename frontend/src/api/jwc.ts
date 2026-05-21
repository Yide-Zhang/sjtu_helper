// 教务处 (jwc.sjtu.edu.cn) 通知公告 API
import { getJAccountUsername } from '../utils/storage';

const JWC_BASE = 'https://jwc.sjtu.edu.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface JwcNotice {
  id: string;           // 文章ID
  url: string;          // 完整URL
  title: string;
  date: string;         // "2026.05.20"
  summary: string;
  isXuanKe: boolean;    // 是否为选课通知
  isPingJiao: boolean;  // 是否为评教通知
  // 选课通知特有字段
  xuankeInfo?: XuanKeInfo;
  // 评教通知特有字段
  pingJiaoEndTime?: string; // ISO datetime "2026-01-02T17:00"
}

export interface XuanKeInfo {
  academicYear: string; // "2025-2026"
  season: string;       // "spring" | "summer" | "fall"
  seasonCn: string;     // "春季" | "夏季" | "秋季"
  rounds: XuanKeRound[];
}

export interface XuanKeRound {
  round: string;        // "试选" | "海选" | "抢选" | "第三轮选课（暂定）"
  start: string;        // ISO datetime "2025-12-15T13:00"
  end: string;
  startWeek: number;
  endWeek: number;
}

export interface JwcNoticeDetail {
  title: string;
  publishDate: string;
  contentHtml: string;
  attachments: { name: string; url: string }[];
}

/** 获取列表页通知 */
export async function fetchJwcNoticeList(page = 1): Promise<JwcNotice[]> {
  try {
    const url = page === 1
      ? `${JWC_BASE}/xwtg/tztg.htm`
      : `${JWC_BASE}/xwtg/tztg/${232 - page}.htm`;
    
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const html = await res.text();

    // 正则解析列表项
    const itemRegex = /<li class="clearfix"[^>]*>[\s\S]*?<div class="sj">\s*<h2>(\d+)<\/h2>\s*<p>([\d.]+)<\/p>[\s\S]*?<a href="([^"]+)"[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<\/a>\s*<p>([\s\S]*?)<\/p>[\s\S]*?<\/li>/g;
    const notices: JwcNotice[] = [];
    let m: RegExpExecArray | null;
    
    while ((m = itemRegex.exec(html)) !== null) {
      const day = m[1].padStart(2, '0');
      const yearMonth = m[2];
      const date = `${yearMonth.replace('.', '-')}-${day}`;
      const href = m[3].trim();
      const title = m[4].replace(/<[^>]+>/g, '').trim();
      const summary = m[5].replace(/<[^>]+>/g, '').trim();
      const url = href.startsWith('http') ? href : `${JWC_BASE}${href.startsWith('/') ? '' : '/'}${href}`;
      const id = href.match(/(\d+)\.htm$/)?.[1] || '';
      const isXuanKe = /上海交通大学\d{4}-\d{4}学年[春秋夏]季学期选课通知/.test(title);
      const isPingJiao = /评教/.test(title) && !/试评教/.test(title) && !isXuanKe;

      notices.push({ id, url, title, date, summary, isXuanKe, isPingJiao });
    }
    return notices;
  } catch (e) {
    console.warn('[JWC] fetch list error:', e);
    return [];
  }
}

/** 获取通知详情 */
export async function fetchJwcNoticeDetail(url: string): Promise<JwcNoticeDetail | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const html = await res.text();

    const titleMatch = html.match(/<h3>([\s\S]*?)<\/h3>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const dateMatch = html.match(/发布日期[：:]\s*([\d-]+)/);
    const publishDate = dateMatch ? dateMatch[1] : '';

    const contentMatch = html.match(/<div class="v_news_content">([\s\S]*?)<\/div>\s*<\/div>/);
    const contentHtml = contentMatch ? contentMatch[1] : '';

    const attachRegex = /<li>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g;
    const attachments: { name: string; url: string }[] = [];
    let am: RegExpExecArray | null;
    while ((am = attachRegex.exec(html)) !== null) {
      const aUrl = am[1].startsWith('http') ? am[1] : `${JWC_BASE}${am[1]}`;
      attachments.push({ name: am[2].trim(), url: aUrl });
    }

    return { title, publishDate, contentHtml, attachments };
  } catch (e) {
    console.warn('[JWC] fetch detail error:', e);
    return null;
  }
}

/** 解析选课通知中的轮次信息 */
export function parseXuanKeContent(contentHtml: string, pubYear: number, pubMonth: number): XuanKeInfo | null {
  // 提取 v_news_content 容器
  const contentMatch = contentHtml.match(/<div class="v_news_content">([\s\S]*?)<\/div>\s*<\/div>/);
  const inner = contentMatch ? contentMatch[1] : contentHtml;

  // 1) 尝试从红色 <strong> 块逐个提取
  const strongBlocks = inner.match(/<strong[^>]*>[\s\S]*?<\/strong>/g) || [];
  const redSegments: string[] = [];
  for (const block of strongBlocks) {
    if (!/color:red/i.test(block)) continue;
    const spans = block.match(/<span[^>]*>([\s\S]*?)<\/span>/g) || [];
    const text = spans.map(s => s.replace(/<[^>]+>/g, '').trim()).join('').replace(/\u200b/g, '');
    if (text) redSegments.push(text);
  }

  // 2) 从纯文本按编号分割
  const plain = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\u200b/g, '');
  const plainSegments = plain.split(/(?=\d+[、．])/).map(s => s.trim()).filter(Boolean);

  // 3) 优先使用红色块（如果它们包含时间信息），否则用纯文本
  const tpCheck = /(\d+)月(\d+)日[（(]/;
  const hasTimeInRed = redSegments.some(s => tpCheck.test(s));
  const segments = hasTimeInRed ? redSegments : plainSegments;

  // 时间正则：支持 "6月4日(第16周周三)15:00-20:45"（同日）和 "6月3日...-6月6日..."（跨日）
  // 捕获组: 1=月 2=日 3=周 4=开始时间  [5=结束月] 6=结束日 7=结束周  8=结束时间
  const tp = /(\d+)月(\d+)日[（(](?:夏季学期)?第(\d+)周周[一二三四五六日][)）](\d+:\d+)\s*-\s*(?:(?:\d+年)?(?:(\d+)月)?(\d+)日[（(]?(?:夏季学期)?第(\d+)周周[一二三四五六日][)）]?)?(\d+:\d+)/g;

  // 已知轮次名匹配器
  const knownRounds: { match: (s: string) => boolean; name: string }[] = [
    { match: (s) => s.includes('试选'), name: '试选' },
    { match: (s) => s.includes('海选'), name: '海选' },
    { match: (s) => /^\d*[、．]\s*第一轮抢选/.test(s), name: '第一轮抢选' },
    { match: (s) => /^\d*[、．]\s*第二轮抢选/.test(s), name: '第二轮抢选' },
    { match: (s) => s.includes('第一轮抢选'), name: '第一轮抢选' },
    { match: (s) => /抢选\s*[（(]\s*第一/.test(s), name: '抢选（第一阶段）' },
    { match: (s) => /抢选\s*[（(]\s*第二/.test(s), name: '抢选（第二阶段）' },
    { match: (s) => /^\d*[、．]\s*抢选\s*[：:]/.test(s) || (s.includes('抢选') && !s.includes('阶段') && !s.includes('轮')), name: '抢选' },
    { match: (s) => s.includes('第三轮选课'), name: '第三轮选课' },
    { match: (s) => /暂停选课|暂停/.test(s), name: '__pause__' },
  ];

  // 提取所有轮次（含暂停）
  const extRounds: { name: string; sm: number; sd: number; sh: string; em: number; ed: number; eh: string; weekS: number; weekE: number }[] = [];

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    let name = '';
    for (const kn of knownRounds) {
      if (kn.match(s)) { name = kn.name; break; }
    }
    if (!name) {
      const rm = s.match(/(\d+)[、．]([^：:]*?)\s*[：:]/);
      if (rm) {
        const candidate = rm[2].trim();
        if (candidate.length <= 15) name = candidate;
      }
    }
    if (!name) continue;

    // 一个段内可能有多个时间区间（如抢选段内嵌暂停）
    tp.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = tp.exec(s)) !== null) {
      const hasEndDate = tm[6] !== undefined;
      const sm = parseInt(tm[1]), sd = parseInt(tm[2]), sw = parseInt(tm[3]), sh = tm[4];
      const em = hasEndDate && tm[5] ? parseInt(tm[5]) : sm;
      const ed = hasEndDate ? parseInt(tm[6]) : sd;
      const ew = hasEndDate ? parseInt(tm[7]) : sw;
      const eh = tm[8]; // 最后捕获组永远是结束时间
      extRounds.push({
        name, sm, sd, sh, em, ed, eh, weekS: sw, weekE: ew,
      });
    }
  }

  // 后处理：抢选段如果内嵌暂停，拆分为两阶段
  // 暂停文本在同一段内被误标为 '抢选'，通过时间范围包含关系识别
  const qiangItems = extRounds.filter(r => r.name === '抢选');
  for (let i = 0; i < qiangItems.length; i++) {
    const outer = qiangItems[i];
    // 找包含在 outer 内部的时间段（即暂停）
    const inner = qiangItems.find((r, j) =>
      i !== j &&
      (r.sm * 100 + r.sd >= outer.sm * 100 + outer.sd) &&
      (r.em * 100 + r.ed <= outer.em * 100 + outer.ed) &&
      (r.sm * 100 + r.sd > outer.sm * 100 + outer.sd || r.sh > outer.sh) &&
      (r.em * 100 + r.ed < outer.em * 100 + outer.ed || r.eh < outer.eh)
    );
    if (!inner) continue;

    // 阶段一：从抢选开始到暂停开始
    const p1 = {
      ...outer,
      name: '抢选（第一阶段）',
      em: inner.sm, ed: inner.sd, eh: inner.sh,
      weekE: inner.weekS,
    };
    // 阶段二：从暂停结束到抢选结束
    const p2 = {
      name: '抢选（第二阶段）',
      sm: inner.em, sd: inner.ed, sh: inner.eh,
      em: outer.em, ed: outer.ed, eh: outer.eh,
      weekS: inner.weekE, weekE: outer.weekE,
    };
    const oi = extRounds.indexOf(outer);
    if (oi !== -1) extRounds[oi] = p1;
    const ii = extRounds.indexOf(inner);
    if (ii !== -1) extRounds.splice(ii, 1);
    extRounds.push(p2);
  }

  // 后处理：第三轮选课同名时间段拆阶段（不太会跨年，保留原 dayOfYear 逻辑）
  const dayOfYear = (m: number, d: number) => { let days = d; for (let i = 1; i < m; i++) days += (i === 2 ? 28 : [4,6,9,11].includes(i) ? 30 : 31); return days; };
  const thirdGroups = new Map<string, typeof extRounds>();
  for (const r of extRounds) {
    if (r.name !== '第三轮选课') continue;
    if (!thirdGroups.has(r.name)) thirdGroups.set(r.name, []);
    thirdGroups.get(r.name)!.push(r);
  }
  for (const [, items] of thirdGroups) {
    if (items.length < 2) continue;
    const norms = items.map(r => ({ r, s: dayOfYear(r.sm, r.sd), e: dayOfYear(r.em, r.ed) + (r.sm > r.em ? 365 : 0) }));
    const main = norms.find(m => norms.every(o => m === o || (m.s <= o.s && m.e >= o.e)));
    if (!main) continue;
    const subs = norms.filter(o => o !== main && main.s <= o.s && main.e >= o.e).sort((a, b) => a.s - b.s);
    if (subs.length === 0) continue;
    extRounds.splice(extRounds.indexOf(main.r), 1);
    for (let k = 0; k < subs.length; k++) {
      const si = extRounds.indexOf(subs[k].r);
      if (si !== -1) { extRounds[si] = { ...subs[k].r, name: `第三轮选课（第${['一','二','三','四'][k] || k + 1}阶段）` }; }
    }
  }

  const rounds: XuanKeRound[] = extRounds
    .filter(r => r.name !== '__pause__')
    .map(r => {
      const sy = (pubMonth >= 9 && r.sm <= 3) ? pubYear + 1 : pubYear;
      const ey = (pubMonth >= 9 && r.em <= 3) ? pubYear + 1 : pubYear;
      return {
        round: r.name,
        start: `${sy}-${String(r.sm).padStart(2, '0')}-${String(r.sd).padStart(2, '0')}T${r.sh}`,
        end: `${ey}-${String(r.em).padStart(2, '0')}-${String(r.ed).padStart(2, '0')}T${r.eh}`,
        startWeek: r.weekS,
        endWeek: r.weekE,
      };
    });

  if (!rounds.length) return null;

  return { academicYear: '', season: '', seasonCn: '', rounds };
}

/** 从标题提取学年和季节 */
export function extractXuanKeMeta(title: string): { academicYear: string; season: string; seasonCn: string } | null {
  const m = title.match(/上海交通大学(\d{4}-\d{4})学年([春秋夏])季学期选课通知/);
  if (!m) return null;
  const smap: Record<string, string> = { '春': 'spring', '夏': 'summer', '秋': 'fall' };
  return { academicYear: m[1], season: smap[m[2]] || m[2], seasonCn: m[2] + '季' };
}

/** 从评教通知 HTML 中解析评教截止时间 */
export function parsePingJiaoEndTime(contentHtml: string): string | null {
  // 匹配 "评教时间为：YYYY年MM月DD日HH:MM-YYYY年MM月DD日HH:MM"
  const m = contentHtml.match(/评教时间[为：:]\s*(?:.*?)\s*-\s*(\d{4})?\s*年?\s*(\d+)\s*月\s*(\d+)\s*日\s*(\d+:\d+)/);
  if (!m) return null;
  const year = m[1] ? parseInt(m[1]) : new Date().getFullYear();
  const month = parseInt(m[2]);
  const day = parseInt(m[3]);
  const time = m[4];
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${time}`;
}
