// 选课社区 API 封装 (course.sjtu.plus)
// 使用原生 CookieManager 管理 cookie

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import CookieManager from '@react-native-cookies/cookies';
import { getJAccountUsername, getCommunityPassword, getJAccountPassword } from '../utils/storage';

const BASE_URL = 'https://course.sjtu.plus';

// ========== 类型定义 ==========

export interface Review {
  id: number;
  reactions: { approves: number; disapproves: number; reaction: string | null };
  is_mine: boolean;
  semester: string;
  rating: number;
  comment: string;
  created_at: string;
  modified_at: string;
  score: string | null;
  moderator_remark: string | null;
}

/** 带课程信息的 Review（来自 /api/review/ 全局列表） */
export interface ReviewWithCourse extends Review {
  course: {
    id: number;
    code: string;
    name: string;
    teacher: string;
    categories?: string[];
    department?: string;
    credit?: number;
  };
}

export interface CourseInfo {
  id: number;
  categories: string[];
  department: string;
  main_teacher: { tid: string; name: string } | null;
  teacher_group: { tid: string; name: string }[];
  rating: { count: number; avg: number };
  related_teachers: any[];
  related_courses: any[];
  notification_level: string | null;
  code: string;
  name: string;
  credit: number;
  moderator_remark: string | null;
}

export interface CourseListItem {
  id: number;
  categories: string[];
  department: string;
  teacher: string;
  rating: { count: number; avg: number };
  code: string;
  name: string;
  credit: number;
}

export interface CommonData {
  user: { id: number; username: string; is_staff: boolean };
  announcements: any[];
  semesters: { id: number; name: string; available: boolean }[];
  enrolled_courses: any[];
  my_reviews: any[];
  promotions: any[];
}

// ========== Cookie 管理 ==========

let authClient: AxiosInstance | null = null;
let _cookieCache: string = '';
let _cookieCacheTime = 0;
const COOKIE_CACHE_TTL = 30000;

const refreshCookieCache = async (): Promise<string> => {
  try {
    const cookies = await CookieManager.get('https://course.sjtu.plus');
    const parts: string[] = [];
    for (const [name, c] of Object.entries(cookies)) {
      if (c?.value) parts.push(`${name}=${c.value}`);
    }
    _cookieCache = parts.join('; ');
    _cookieCacheTime = Date.now();
    return _cookieCache;
  } catch {
    return _cookieCache;
  }
};

const generateCsrfToken = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
};

const ensureCsrfToken = async (): Promise<string> => {
  if (_cookieCache) {
    const m = _cookieCache.match(/csrftoken=([^;]+)/);
    if (m) return m[1];
  }
  const cookies = await CookieManager.get('https://course.sjtu.plus');
  if (cookies?.csrftoken?.value) {
    await refreshCookieCache();
    return cookies.csrftoken.value;
  }
  const token = generateCsrfToken();
  await CookieManager.set('https://course.sjtu.plus', {
    name: 'csrftoken', value: token, path: '/', domain: 'course.sjtu.plus',
  });
  const verify = await CookieManager.get('https://course.sjtu.plus');
  if (verify?.csrftoken?.value) {
    await refreshCookieCache();
    return token;
  }
  return '';
};

const createClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  });
  client.interceptors.request.use(async (config: any) => {
    if (!_cookieCache || Date.now() - _cookieCacheTime > COOKIE_CACHE_TTL) {
      await refreshCookieCache();
    }
    if (_cookieCache) config.headers.Cookie = _cookieCache;
    return config;
  });
  let retryCount = 0;
  client.interceptors.response.use(undefined, async (error) => {
    if (retryCount < 2 && error.config && !error.config._retry) {
      retryCount++;
      error.config._retry = true;
      await new Promise(r => setTimeout(r, 2000 * retryCount));
      return client.request(error.config);
    }
    return Promise.reject(error);
  });
  return client;
};

export const getClient = (): AxiosInstance | null => authClient;

export const loginCommunity = async (): Promise<boolean> => {
  try {
    const account = await getJAccountUsername();
    if (!account) return false;
    let password = await getCommunityPassword();
    if (!password) password = await getJAccountPassword();
    if (!password) return false;

    const csrfToken = await ensureCsrfToken();
    if (!csrfToken) return false;

    const loginResp = await fetch('https://course.sjtu.plus/oauth/email/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
        'Referer': 'https://course.sjtu.plus/login',
      },
      body: JSON.stringify({ account, password }),
    });
    if (loginResp.status === 400 || loginResp.status === 403) return false;
    if (loginResp.status !== 200) return false;

    authClient = createClient();
    const verifyResp = await authClient.get('/api/common/');
    const ok = verifyResp.status === 200 && !!verifyResp.data?.user?.id;
    if (!ok) { authClient = null; return false; }
    return true;
  } catch (err: any) {
    console.warn('[courseCommunity] 登录异常:', err?.message);
    authClient = null;
    return false;
  }
};

export const ensureAuth = async (): Promise<boolean> => {
  if (authClient) return true;
  return loginCommunity();
};

export const clearCourseCache = () => { allCoursesCache = null; };

// ========== 课程数据 ==========

let allCoursesCache: CourseListItem[] | null = null;
let allCoursesLoading = false;
let allCoursesPromise: Promise<CourseListItem[]> | null = null;

const fetchAllCourses = async (): Promise<CourseListItem[]> => {
  if (allCoursesCache) return allCoursesCache;
  if (allCoursesLoading && allCoursesPromise) return allCoursesPromise;
  allCoursesLoading = true;
  allCoursesPromise = (async () => {
    const courses: CourseListItem[] = [];
    let page = 1;
    const size = 100;
    try {
      while (true) {
        const resp = await authClient!.get('/api/course/', { params: { page, size }, timeout: 20000 });
        const data = resp.data;
        if (!data?.results?.length) break;
        courses.push(...data.results);
        if (!data.next) break;
        page++;
      }
      allCoursesCache = courses;
      return courses;
    } catch {
      return courses;
    } finally {
      allCoursesLoading = false;
      allCoursesPromise = null;
    }
  })();
  return allCoursesPromise;
};

export const searchCourses = async (query: string): Promise<{ count: number; results: CourseListItem[] } | null> => {
  if (!await ensureAuth()) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const resp = await authClient!.get('/api/search/', { params: { q: trimmed, page: 1, size: 50 }, timeout: 20000 });
    if (resp.data?.results?.length > 0) {
      return { count: resp.data.count, results: resp.data.results };
    }
    // 客户端 fallback
    const all = await fetchAllCourses();
    const lower = trimmed.toLowerCase();
    const filtered = all.filter(c =>
      c.code.toLowerCase().includes(lower) ||
      c.name.toLowerCase().includes(lower) ||
      c.teacher.toLowerCase().includes(lower) ||
      c.categories.some(cat => cat.toLowerCase().includes(lower))
    );
    return { count: filtered.length, results: filtered.slice(0, 50) };
  } catch {
    return null;
  }
};

export const getCourseDetail = async (courseId: number): Promise<CourseInfo | null> => {
  if (!authClient) return null;
  try {
    const resp = await authClient.get(`/api/course/${courseId}/`);
    return resp.data;
  } catch { return null; }
};

export const getAllCourseReviews = async (courseId: number): Promise<Review[]> => {
  if (!authClient) return [];
  const reviews: Review[] = [];
  let page = 1;
  const size = 50;
  try {
    while (true) {
      const resp = await authClient.get(`/api/course/${courseId}/review/`, { params: { page, size } });
      const data = resp.data;
      if (!data?.results?.length) break;
      reviews.push(...data.results);
      if (!data.next) break;
      page++;
    }
  } catch {}
  return reviews;
};

/** 分页获取课程评论，返回当前页评论 + 是否还有更多 */
export const getCourseReviewsPage = async (
  courseId: number, page: number = 1, size: number = 10
): Promise<{ reviews: Review[]; hasMore: boolean; count: number }> => {
  if (!authClient) return { reviews: [], hasMore: false, count: 0 };
  try {
    const resp = await authClient.get(`/api/course/${courseId}/review/`, { params: { page, size } });
    const data = resp.data;
    return {
      reviews: data?.results || [],
      hasMore: !!data?.next,
      count: data?.count || 0,
    };
  } catch {
    return { reviews: [], hasMore: false, count: 0 };
  }
};

export const getCommonData = async (): Promise<CommonData | null> => {
  if (!await ensureAuth()) return null;
  try {
    const resp = await authClient!.get('/api/common/');
    return resp.data;
  } catch { return null; }
};

export const logoutCommunity = () => { authClient = null; };

/** 获取最新 N 条评论（首页预览用） */
export const getRecentReviews = async (limit: number = 2): Promise<ReviewWithCourse[]> => {
  if (!await ensureAuth()) return [];
  let reviews: any[] = [];
  try {
    const resp = await authClient!.get('/api/review/', {
      params: { page: 1, size: limit * 2, ordering: '-created_at' },
      timeout: 15000,
    });
    reviews = resp.data?.results || [];
  } catch {}
  if (!reviews.length) return [];
  const results: ReviewWithCourse[] = [];
  for (const rv of reviews) {
    const c = rv.course;
    if (!c?.id) continue;
    let cat: string[] = [];
    let dept = '';
    let cred: number | undefined;
    try {
      const det = await authClient!.get(`/api/course/${c.id}/`, { timeout: 8000 });
      const d = det.data;
      cat = d.categories || [];
      dept = d.department || '';
      cred = d.credit;
    } catch {}
    results.push({
      ...rv,
      course: { id: c.id, code: c.code || '', name: c.name || '', teacher: c.teacher || '', categories: cat, department: dept, credit: cred },
    });
    if (results.length >= limit) break;
  }
  return results;
};
