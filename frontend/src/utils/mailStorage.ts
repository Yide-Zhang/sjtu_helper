import AsyncStorage from '@react-native-async-storage/async-storage';

const MAIL_AUTH_TOKEN_KEY = 'MAIL_ZM_AUTH_TOKEN';
const MAIL_CSRF_TOKEN_KEY = 'MAIL_CSRF_TOKEN';
const MAIL_SESSION_ID_KEY = 'MAIL_SESSION_ID';
const MAIL_CACHE_KEY = 'MAIL_INBOX_CACHE';

export const getMailAuthToken = async (): Promise<string | null> => {
  try { return await AsyncStorage.getItem(MAIL_AUTH_TOKEN_KEY); } catch { return null; }
};

export const setMailAuthToken = async (token: string) => {
  await AsyncStorage.setItem(MAIL_AUTH_TOKEN_KEY, token);
};

export const removeMailAuthToken = async () => {
  await AsyncStorage.removeItem(MAIL_AUTH_TOKEN_KEY);
};

export const getMailCsrfToken = async (): Promise<string | null> => {
  try { return await AsyncStorage.getItem(MAIL_CSRF_TOKEN_KEY); } catch { return null; }
};

export const setMailCsrfToken = async (token: string) => {
  await AsyncStorage.setItem(MAIL_CSRF_TOKEN_KEY, token);
};

export const removeMailCsrfToken = async () => {
  await AsyncStorage.removeItem(MAIL_CSRF_TOKEN_KEY);
};

export const getMailSessionId = async (): Promise<string | null> => {
  try { return await AsyncStorage.getItem(MAIL_SESSION_ID_KEY); } catch { return null; }
};

export const setMailSessionId = async (id: string) => {
  await AsyncStorage.setItem(MAIL_SESSION_ID_KEY, id);
};

export const removeMailSessionId = async () => {
  await AsyncStorage.removeItem(MAIL_SESSION_ID_KEY);
};

export interface MailCache {
  messages: any[];
  timestamp: number;
}

export const getMailCache = async (): Promise<MailCache | null> => {
  try {
    const json = await AsyncStorage.getItem(MAIL_CACHE_KEY);
    return json ? JSON.parse(json) : null;
  } catch { return null; }
};

export const setMailCache = async (cache: MailCache) => {
  await AsyncStorage.setItem(MAIL_CACHE_KEY, JSON.stringify(cache));
};
