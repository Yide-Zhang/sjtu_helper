// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'SJTU_CANVAS_AUTH_TOKEN';
const USER_CREDENTIALS_KEY = 'SJTU_USER_CREDENTIALS';

export const storeToken = async (token: string) => {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (e) {
    console.error('Failed to save auth token', e);
  }
};

export const getToken = async () => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to get auth token', e);
    return null;
  }
};

export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (e) {
    console.error('Failed to remove auth token', e);
  }
};

// jAccount 凭据
const JACCOUNT_USERNAME_KEY = 'JACCOUNT_USERNAME';
const JACCOUNT_PASSWORD_KEY = 'JACCOUNT_PASSWORD';

export const getJAccountUsername = async () => {
  try { return await AsyncStorage.getItem(JACCOUNT_USERNAME_KEY); }
  catch (e) { return null; }
};
export const setJAccountUsername = async (val: string) => {
  await AsyncStorage.setItem(JACCOUNT_USERNAME_KEY, val);
};
export const getJAccountPassword = async () => {
  try { return await AsyncStorage.getItem(JACCOUNT_PASSWORD_KEY); }
  catch (e) { return null; }
};
export const setJAccountPassword = async (val: string) => {
  await AsyncStorage.setItem(JACCOUNT_PASSWORD_KEY, val);
};
export const removeJAccountUsername = async () => {
  await AsyncStorage.removeItem(JACCOUNT_USERNAME_KEY);
};
export const removeJAccountPassword = async () => {
  await AsyncStorage.removeItem(JACCOUNT_PASSWORD_KEY);
};

// 选课社区密码
const COMMUNITY_PASSWORD_KEY = 'COMMUNITY_PASSWORD';

export const getCommunityPassword = async () => {
  try { return await AsyncStorage.getItem(COMMUNITY_PASSWORD_KEY); }
  catch (e) { return null; }
};
export const setCommunityPassword = async (val: string) => {
  await AsyncStorage.setItem(COMMUNITY_PASSWORD_KEY, val);
};
export const removeCommunityPassword = async () => {
  await AsyncStorage.removeItem(COMMUNITY_PASSWORD_KEY);
};

// 后续如果在需要后台重新拉取token时，也可以考虑加密存储账密
export const storeCredentials = async (username: string, password: string) => {
  try {
    const creds = JSON.stringify({ username, password });
    await AsyncStorage.setItem(USER_CREDENTIALS_KEY, creds);
  } catch (e) {
    console.error('Failed to save credentials', e);
  }
};

export const getCredentials = async () => {
  try {
    const creds = await AsyncStorage.getItem(USER_CREDENTIALS_KEY);
    return creds ? JSON.parse(creds) : null;
  } catch (e) {
    console.error('Failed to get credentials', e);
    return null;
  }
};

// 课表更新间隔（天数），默认 1 天
const SCHEDULE_UPDATE_INTERVAL_KEY = 'SCHEDULE_UPDATE_INTERVAL';

export const getScheduleUpdateInterval = async (): Promise<number> => {
  try {
    const val = await AsyncStorage.getItem(SCHEDULE_UPDATE_INTERVAL_KEY);
    return val ? parseInt(val, 10) : 1;
  } catch { return 1; }
};

export const setScheduleUpdateInterval = async (days: number) => {
  await AsyncStorage.setItem(SCHEDULE_UPDATE_INTERVAL_KEY, String(days));
};

// 考试更新间隔（天数），默认 1 天
const EXAM_UPDATE_INTERVAL_KEY = 'EXAM_UPDATE_INTERVAL';

export const getExamUpdateInterval = async (): Promise<number> => {
  try {
    const val = await AsyncStorage.getItem(EXAM_UPDATE_INTERVAL_KEY);
    return val ? parseInt(val, 10) : 1;
  } catch { return 1; }
};

export const setExamUpdateInterval = async (days: number) => {
  await AsyncStorage.setItem(EXAM_UPDATE_INTERVAL_KEY, String(days));
};

// 考试缓存键前缀
export const EXAM_CACHE_PREFIX = 'EXAM_CACHE_';
// 成绩缓存键前缀
export const GRADE_CACHE_PREFIX = 'GRADE_CACHE_';

// 开发者模式状态
const DEV_MODE_KEY = 'DEV_MODE_ENABLED';

export const getDevModeEnabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(DEV_MODE_KEY);
    return val === 'true';
  } catch { return false; }
};

export const persistDevModeEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(DEV_MODE_KEY, enabled ? 'true' : 'false');
};

// Crazy Thursday
const CRAZY_THURSDAY_ENABLED_KEY = 'CRAZY_THURSDAY_ENABLED';
const CRAZY_THURSDAY_DISMISSED_WEEK_KEY = 'CRAZY_THURSDAY_DISMISSED_WEEK';

export const getCrazyThursdayEnabled = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(CRAZY_THURSDAY_ENABLED_KEY);
    return val !== 'false'; // 默认开启
  } catch { return true; }
};

export const setCrazyThursdayEnabled = async (enabled: boolean) => {
  await AsyncStorage.setItem(CRAZY_THURSDAY_ENABLED_KEY, enabled ? 'true' : 'false');
};

/** 获取本周四的 "年-周" 标识，用于判断是否已关闭过 */
const getWeekKey = (): string => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
};

export const isCrazyThursdayDismissedThisWeek = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(CRAZY_THURSDAY_DISMISSED_WEEK_KEY);
    return val === getWeekKey();
  } catch { return false; }
};

export const dismissCrazyThursdayThisWeek = async () => {
  await AsyncStorage.setItem(CRAZY_THURSDAY_DISMISSED_WEEK_KEY, getWeekKey());
};

// ── 疯狂星期四首次关闭引导标记 ──
const CRAZY_THURSDAY_FIRST_CLOSE_KEY = 'CRAZY_THURSDAY_FIRST_CLOSE_DONE';

export const hasShownCrazyThursdayFirstGuide = async (): Promise<boolean> => {
  try { return await AsyncStorage.getItem(CRAZY_THURSDAY_FIRST_CLOSE_KEY) === 'true'; }
  catch { return false; }
};

export const markCrazyThursdayFirstGuideShown = async () => {
  await AsyncStorage.setItem(CRAZY_THURSDAY_FIRST_CLOSE_KEY, 'true');
};

// ── 手动完成作业（书面提交等无在线提交的作业）──
const MANUALLY_COMPLETED_KEY = 'MANUALLY_COMPLETED_ASSIGNMENTS';

export const getManuallyCompletedIds = async (): Promise<number[]> => {
  try {
    const val = await AsyncStorage.getItem(MANUALLY_COMPLETED_KEY);
    return val ? JSON.parse(val) : [];
  } catch { return []; }
};

export const setManuallyCompleted = async (ids: number[]) => {
  await AsyncStorage.setItem(MANUALLY_COMPLETED_KEY, JSON.stringify(ids));
};

export const toggleManuallyCompleted = async (id: number): Promise<boolean> => {
  const ids = await getManuallyCompletedIds();
  if (ids.includes(id)) {
    await setManuallyCompleted(ids.filter(i => i !== id));
    return false; // 已取消完成
  } else {
    await setManuallyCompleted([...ids, id]);
    return true; // 已标记完成
  }
};

// ── 作业/公告持久缓存（跨应用重启）──
const ASSIGNMENTS_CACHE_KEY = 'ASSIGNMENTS_PERSISTENT_CACHE';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 分钟

export const getAssignmentsCache = async (): Promise<{ data: any; timestamp: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(ASSIGNMENTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setAssignmentsCache = async (data: any) => {
  await AsyncStorage.setItem(ASSIGNMENTS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
};

export const isAssignmentsCacheFresh = async (): Promise<boolean> => {
  const cache = await getAssignmentsCache();
  if (!cache) return false;
  return (Date.now() - cache.timestamp) < CACHE_EXPIRY_MS;
};

// ── 后台刷新间隔（分钟） ──
const BACKGROUND_INTERVAL_KEY = 'BACKGROUND_REFRESH_INTERVAL';

export const getBackgroundInterval = async (): Promise<number> => {
  try {
    const val = await AsyncStorage.getItem(BACKGROUND_INTERVAL_KEY);
    if (val) return parseInt(val, 10);
    return 0; // 0 = 关闭
  } catch { return 0; }
};

export const setBackgroundInterval = async (minutes: number) => {
  await AsyncStorage.setItem(BACKGROUND_INTERVAL_KEY, String(minutes));
};

// ── 后台任务上次快照（用于检测变化）──
const BG_LAST_SNAPSHOT_KEY = 'BG_LAST_SNAPSHOT';

export interface BgSnapshot {
  mailCount: number;
  mailPreview: string;
  assignCount: number;
  assignIds: number[];
  timestamp: number;
}

export const getBgSnapshot = async (): Promise<BgSnapshot | null> => {
  try {
    const raw = await AsyncStorage.getItem(BG_LAST_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const setBgSnapshot = async (snap: BgSnapshot) => {
  await AsyncStorage.setItem(BG_LAST_SNAPSHOT_KEY, JSON.stringify(snap));
};

// ── i.sjtu 通知缓存（用于后台通知去重，关联 jAccount 用户名）──
const ISJTU_NOTICES_CACHE_KEY = 'ISJTU_NOTICES_CACHE';
const ISJTU_NOTICES_USER_KEY = 'ISJTU_NOTICES_USER';

export interface IsjtuNoticeCache {
  ids: string[];
  timestamp: number;
}

/** 获取缓存的 i.sjtu 通知 ID 列表，同时返回缓存的用户名 */
export const getIsjtuNoticeCache = async (): Promise<{ data: IsjtuNoticeCache; username: string } | null> => {
  try {
    const [dataRaw, userRaw] = await Promise.all([
      AsyncStorage.getItem(ISJTU_NOTICES_CACHE_KEY),
      AsyncStorage.getItem(ISJTU_NOTICES_USER_KEY),
    ]);
    if (!dataRaw || !userRaw) return null;
    return { data: JSON.parse(dataRaw), username: userRaw };
  } catch { return null; }
};

/** 保存 i.sjtu 通知缓存，关联当前 jAccount 用户名 */
export const setIsjtuNoticeCache = async (ids: string[]) => {
  const username = await getJAccountUsername();
  await Promise.all([
    AsyncStorage.setItem(ISJTU_NOTICES_CACHE_KEY, JSON.stringify({ ids, timestamp: Date.now() })),
    AsyncStorage.setItem(ISJTU_NOTICES_USER_KEY, username || ''),
  ]);
};

// ── 选课社区收藏 ──
const COMMUNITY_FAVORITES_KEY = 'COMMUNITY_FAVORITES';

export interface CommunityFavorite {
  courseId: number;
  courseCode: string;
  courseName: string;
  teacherName: string;
  addedAt: number;
  avgRating?: number;
  reviewCount?: number;
  credibilityLevel?: string;
}

export const getCommunityFavorites = async (): Promise<CommunityFavorite[]> => {
  try {
    const raw = await AsyncStorage.getItem(COMMUNITY_FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const addCommunityFavorite = async (fav: CommunityFavorite) => {
  const list = await getCommunityFavorites();
  if (!list.find(f => f.courseId === fav.courseId)) {
    list.push(fav);
    await AsyncStorage.setItem(COMMUNITY_FAVORITES_KEY, JSON.stringify(list));
  }
};

export const removeCommunityFavorite = async (courseId: number) => {
  const list = await getCommunityFavorites();
  await AsyncStorage.setItem(COMMUNITY_FAVORITES_KEY, JSON.stringify(list.filter(f => f.courseId !== courseId)));
};

export const isCommunityFavorite = async (courseId: number): Promise<boolean> => {
  const list = await getCommunityFavorites();
  return list.some(f => f.courseId === courseId);
};

// ── 主页板块自定义优先级 ──
const SECTION_PRIORITIES_KEY = 'SECTION_PRIORITIES';

/** 默认优先级 */
export const DEFAULT_SECTION_PRIORITIES: Record<string, number> = {
  schedule: 1,
  assignments: 2,
  announce: 3,
  exams: 4,
  notif: 5,
  mail: 6,
  community: 7,
};

export const getSectionPriorities = async (): Promise<Record<string, number>> => {
  try {
    const raw = await AsyncStorage.getItem(SECTION_PRIORITIES_KEY);
    return raw ? { ...DEFAULT_SECTION_PRIORITIES, ...JSON.parse(raw) } : { ...DEFAULT_SECTION_PRIORITIES };
  } catch { return { ...DEFAULT_SECTION_PRIORITIES }; }
};

export const setSectionPriorities = async (priorities: Record<string, number>) => {
  await AsyncStorage.setItem(SECTION_PRIORITIES_KEY, JSON.stringify(priorities));
};
