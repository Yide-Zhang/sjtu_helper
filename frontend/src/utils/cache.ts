// 内存缓存——避免子页面切换时重复刷新
const cache: Record<string, any> = {};

export const getCache = <T>(key: string): T | null => {
  const entry = cache[key];
  if (!entry) return null;
  return entry.data as T;
};

export const setCache = (key: string, data: any) => {
  cache[key] = { data, timestamp: Date.now() };
};

export const clearCache = (key?: string) => {
  if (key) delete cache[key];
  else Object.keys(cache).forEach(k => delete cache[k]);
};
