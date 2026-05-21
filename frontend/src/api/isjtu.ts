// i.sjtu.edu.cn 教学信息服务网通知 API
import { getJAccountUsername } from '../utils/storage';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface IsjtuNotice {
  id: string;
  title: string;
  content: string;
  time: string;         // "2026-04-11 09:18:47"
  status: string;       // "0"=待阅
  linkUrl?: string;
  isTiaoKe: boolean;    // 是否为调课提醒
  tiaoKeInfo?: TiaoKeInfo;
}

export interface TiaoKeInfo {
  course: string;
  original: TiaoKeChange;
  new: TiaoKeChange;
}

export interface TiaoKeChange {
  teacher: string;
  week: string;   // "8" / "6-16" / "6-14周,16"
  day: string;
  periods: string;
  periodStart: number;
  periodEnd: number;
  location: string;
}

/** 调课提醒解析正则（支持 "8" / "6-16" / "6-14周,16" 等多种周次格式） */
const TIAOKE_RE = /调课提醒:([^老]+)老师于第((?:\d+(?:-\d+)?周?,?)*\d+(?:-\d+)?)周?(\S+?)第([\d-]+)节在(.+?)(?:上)(?=的)的(.+?)课程调课到由([^老]+)老师在第((?:\d+(?:-\d+)?周?,?)*\d+(?:-\d+)?)周?(\S+?)第([\d-]+)节(.+?)(?:上)(?=课)课/;

/** 解析调课提醒标题 */
export function parseTiaoKe(title: string): TiaoKeInfo | null {
  const m = TIAOKE_RE.exec(title);
  if (!m) return null;

  const parsePeriods = (s: string) => {
    const parts = s.split('-');
    return { start: parseInt(parts[0]), end: parts[1] ? parseInt(parts[1]) : parseInt(parts[0]) };
  };

  const op = parsePeriods(m[4]);
  const np = parsePeriods(m[10]);

  return {
    course: m[6],
    original: {
      teacher: m[1],
      week: m[2],
      day: m[3],
      periods: `第${m[4]}节`,
      periodStart: op.start,
      periodEnd: op.end,
      location: m[5],
    },
    new: {
      teacher: m[7],
      week: m[8],
      day: m[9],
      periods: `第${m[10]}节`,
      periodStart: np.start,
      periodEnd: np.end,
      location: m[11],
    },
  };
}

/** 获取 i.sjtu 待阅通知列表 */
/** 内部：用指定 sfyy 参数拉取一页 */
async function fetchIsjtuPage(sfyy: string, page: number, pageSize: number): Promise<{ items: any[]; totalResult: number }> {
  const url = 'https://i.sjtu.edu.cn/xtgl/index_cxDbsy.html?doType=query';
  const body = new URLSearchParams({
    'flag': '',
    'sfyy': sfyy,
    '_search': 'false',
    'nd': String(Date.now()),
    'queryModel.showCount': String(pageSize),
    'queryModel.currentPage': String(page),
    'queryModel.sortName': 'cjsj ',
    'queryModel.sortOrder': 'desc',
    'time': sfyy === '2' ? '3' : '0',
  }).toString();

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
    body,
  });

  if (!res.ok) {
    console.warn('[iSJTU] fetch not ok:', res.status, res.url);
    return { items: [], totalResult: 0 };
  }
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch {
    console.warn('[iSJTU] response not JSON, got HTML? first 200:', text.substring(0, 200));
    return { items: [], totalResult: 0 };
  }
  return { items: json?.items || [], totalResult: json?.totalResult || 0 };
}

/** 解析单个 API item 为 IsjtuNotice */
function parseItem(item: any): IsjtuNotice {
  const title = item.xxbt || '';
  const tiaoKeInfo = parseTiaoKe(title);
  if (tiaoKeInfo) console.log(`[iSJTU] parsed 调课: ${tiaoKeInfo.course}`);
  return {
    id: item.w_id || item.id || '',
    title,
    content: item.xxnr || '',
    time: item.cjsj || '',
    status: item.clzt || '0',
    linkUrl: item.ljdz || '',
    isTiaoKe: !!tiaoKeInfo,
    tiaoKeInfo: tiaoKeInfo || undefined,
  };
}

export async function fetchIsjtuNotices(page = 1, pageSize = 20): Promise<IsjtuNotice[]> {
  try {
    const username = await getJAccountUsername();
    if (!username) return [];

    // sfyy=1 → 待阅 (clzt=0), sfyy=2 → 已办结 (clzt=1,2)
    const [r1, r2] = await Promise.all([
      fetchIsjtuPage('1', page, pageSize),
      fetchIsjtuPage('2', page, pageSize),
    ]);

    console.log(`[iSJTU] sfyy=1: ${r1.items.length} items, sfyy=2: ${r2.items.length} items`);

    // 合并、去重（按 w_id）
    const seen = new Set<string>();
    const allItems: any[] = [];
    for (const item of [...r1.items, ...r2.items]) {
      const id = item.w_id || item.id || '';
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      allItems.push(item);
    }

    // 按时间降序混排
    allItems.sort((a, b) => (b.cjsj || '').localeCompare(a.cjsj || ''));

    return allItems.map(parseItem);
  } catch (e) {
    console.warn('[iSJTU] fetch notices error:', e);
    return [];
  }
}
