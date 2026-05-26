import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Alert, RefreshControl, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, getJAccountUsername, getJAccountPassword, getDevModeEnabled, getCrazyThursdayEnabled, isCrazyThursdayDismissedThisWeek, dismissCrazyThursdayThisWeek, hasShownCrazyThursdayFirstGuide, markCrazyThursdayFirstGuideShown, EXAM_CACHE_PREFIX, getAssignmentsCache, setAssignmentsCache, isAssignmentsCacheFresh, getSectionPriorities } from '../utils/storage';
import { checkJAccountSession, fetchExamJSON, fetchWeeklyScheduleJSON } from '../api/jaccount';
import { fetchAllUpcomingAssignments, CanvasAssignment } from '../api/canvas';
import { ensureMailAuth, fetchInbox, ZimbraMessage } from '../api/mail';
import { removeMailCsrfToken, removeMailAuthToken } from '../utils/mailStorage';
import { fetchJwcNoticeList, fetchJwcNoticeDetail, JwcNotice, extractXuanKeMeta, parsePingJiaoEndTime } from '../api/jwc';
import { fetchIsjtuNotices, IsjtuNotice, parseTiaoKe } from '../api/isjtu';
import { getCache, setCache, clearCache } from '../utils/cache';
import { getCourseColor } from '../utils/colors';
import { AssignmentSummaryCard } from '../components/CardViews';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ScheduleSection } from '../sections/ScheduleSection';
import { AnnouncementSection } from '../sections/AnnouncementSection';
import { NotifSection } from '../sections/NotifSection';
import { MailSection } from '../sections/MailSection';
import { AssignmentSection } from '../sections/AssignmentSection';
import { ExamSection } from '../sections/ExamSection';
import { CommunitySection } from '../sections/CommunitySection';
import { DynamicTwoCol, DynamicSection } from '../sections/DynamicTwoCol';

const USER_NAME_KEY = 'USER_NAME';

const getCurrentSemester = () => {
  const m = new Date().getMonth() + 1, y = new Date().getFullYear();
  if (m >= 2 && m <= 6) return { xnm: String(y - 1), xqm: '12' };
  if (m >= 7 && m <= 8) return { xnm: String(y - 1), xqm: '16' };
  return { xnm: String(y), xqm: '3' };
};

const safeTime = (s: string | undefined | null): number => {
  if (!s) return Infinity;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})\((\d{2}:\d{2})/);
  if (m) { const d = new Date(m[1] + 'T' + m[2]); if (!isNaN(d.getTime())) return d.getTime(); }
  const d = new Date(s.substring(0, 10));
  return isNaN(d.getTime()) ? Infinity : d.getTime();
};

type ExamUrgency = 'none' | 'yellow' | 'orange' | 'red';

const getExamUrgency = (kssj: string | undefined | null): ExamUrgency => {
  const t = safeTime(kssj);
  if (t === Infinity) return 'none';
  const diff = t - Date.now();
  if (diff <= 0) return 'none';
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 24) return 'red';
  if (hours <= 72) return 'orange';
  if (hours <= 168) return 'yellow';
  return 'none';
};

const EXAM_URGENCY_COLORS: Record<ExamUrgency, string> = {
  none: '#F0F0F0',
  yellow: '#f5d741',
  orange: '#e69334',
  red: '#CD2026',
};

const formatDateDiff = (dateStr: string): string => {
  const now = new Date(), target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return '已截止';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} 天后`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours} 小时后`;
  return `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')} 截止`;
};

const PERIODS = [
  { start: 480, end: 525 },  // 1  08:00-08:45
  { start: 535, end: 580 },  // 2  08:55-09:40
  { start: 600, end: 645 },  // 3  10:00-10:45
  { start: 655, end: 700 },  // 4  10:55-11:40
  { start: 720, end: 765 },  // 5  12:00-12:45
  { start: 775, end: 820 },  // 6  12:55-13:40
  { start: 840, end: 885 },  // 7  14:00-14:45
  { start: 895, end: 940 },  // 8  14:55-15:40
  { start: 960, end: 1005 }, // 9  16:00-16:45
  { start: 1015, end: 1060 },// 10 16:55-17:40
  { start: 1080, end: 1125 },// 11 18:00-18:45
  { start: 1135, end: 1180 },// 12 18:55-19:40
  { start: 1185, end: 1220 },// 13 19:45-20:20
];

export const MainScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('');
  const [hasCanvasToken, setHasCanvasToken] = useState<boolean | null>(null);
  const [hasJAccountCreds, setHasJAccountCreds] = useState<boolean | null>(null);
  const [jaccountSessionAlive, setJaccountSessionAlive] = useState<boolean | null>(null);
  const [loginChecking, setLoginChecking] = useState(false);
  const checkingRef = useRef(false);
  const [scheduleInfo, setScheduleInfo] = useState('');
  const [scheduleDetail, setScheduleDetail] = useState('');
  const [scheduleBadge, setScheduleBadge] = useState('');
  const [scheduleCourse, setScheduleCourse] = useState('');
  const [nextCourseName, setNextCourseName] = useState('');
  const [nextCourseDetail, setNextCourseDetail] = useState('');
  const [upcomingAssigns, setUpcomingAssigns] = useState<CanvasAssignment[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [recentAnnouncement, setRecentAnnouncement] = useState<CanvasAssignment | null>(null);
  const [mailUnread, setMailUnread] = useState(0);
  const [mailLatest, setMailLatest] = useState<ZimbraMessage | null>(null);
  const [mailAuthed, setMailAuthed] = useState(false);
  const [mailChecking, setMailChecking] = useState(false);
  const [jwcNotices, setJwcNotices] = useState<JwcNotice[]>([]);
  const [isjtuNotices, setIsjtuNotices] = useState<IsjtuNotice[]>([]);
  const [pinnedXuanKe, setPinnedXuanKe] = useState<JwcNotice | null>(null);
  const [pingJiaoNotice, setPingJiaoNotice] = useState<JwcNotice | null>(null);
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const prioritiesLoaded = useRef(false);
  const [jwcLoading, setJwcLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCrazyThu, setShowCrazyThu] = useState(false);
  const [showCrazyThuModal, setShowCrazyThuModal] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scheduleKbRef = useRef<any[]>([]);

  // ── 凭证检测 + 自动重登录 ──
  const refreshSessionState = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true; setLoginChecking(true);
    // 安全超时：30 秒后无论如何重置检测状态
    const safetyTimer = setTimeout(() => { setLoginChecking(false); checkingRef.current = false; }, 30000);
    try {
      const token = await getToken(); setHasCanvasToken(!!token);
      const jUser = await getJAccountUsername(), jPass = await getJAccountPassword();
      const hasCreds = !!(jUser && jPass); setHasJAccountCreds(hasCreds);
      const name = await AsyncStorage.getItem(USER_NAME_KEY); setUserName(name || '');
      const dm = await getDevModeEnabled(); setDevMode(dm);

      if (hasCreds) {
        // 检测 i.sjtu 会话
        const isAlive = await checkJAccountSession();
        setJaccountSessionAlive(isAlive);
        if (!isAlive) {
          // 用 ensureJAccountLogin 自动重登录（不依赖验证码）
          let loginSuccess = false;
          try {
            const { ensureJAccountLogin } = await import('../api/jaccount');
            loginSuccess = await ensureJAccountLogin();
          } catch {}
          setJaccountSessionAlive(loginSuccess);
          if (loginSuccess) {
            // jAccount 重登录成功 → 清空邮箱旧凭证
            await removeMailCsrfToken().catch(() => {});
            await removeMailAuthToken().catch(() => {});
          }
          // 登录失败不导航，由 UI 展示"登录失效"让用户手动点击
        }
      } else {
        setJaccountSessionAlive(null);
      }

      // 检测邮箱认证（自动重试已内置于 ensureMailAuth）
      // 无论 jAccount 会话之前是否存活，都尝试邮箱认证（cookie 共享）
      if (hasCreds) {
        setMailChecking(true);
        const mailOk = await ensureMailAuth();
        setMailAuthed(mailOk);
        setMailChecking(false);
        if (mailOk) await loadMailSummary();
      } else {
        setMailAuthed(false);
      }

      // 聚焦时后台刷新所有数据（并行）
      refreshAllData();
    } finally { clearTimeout(safetyTimer); setLoginChecking(false); checkingRef.current = false; }
  }, [navigation]);

  // ── Crazy Thursday ──
  const checkCrazyThursday = useCallback(async () => {
    if (new Date().getDay() !== 4) { setShowCrazyThu(false); return; }
    if (!(await getCrazyThursdayEnabled())) { setShowCrazyThu(false); return; }
    if (await isCrazyThursdayDismissedThisWeek()) { setShowCrazyThu(false); return; }
    setShowCrazyThu(true);
  }, []);

  useFocusEffect(useCallback(() => {
    // 每次聚焦时重置检测锁，确保凭证失效后能重新登录
    checkingRef.current = false;
    refreshSessionState();
    loadPersistentCache();
    checkCrazyThursday();
  }, [refreshSessionState, checkCrazyThursday]));

  const loadData = async () => {
    // 阶段1：从持久缓存加载，几乎瞬间显示
    setLoading(true);
    await Promise.all([
      loadPersistentCache(),
      loadScheduleSummary(),
    ]);
    setLoading(false);

    // 阶段2：后台刷新网络数据（不阻塞 UI）
    refreshAllData();
  };

  /** 加载持久缓存的作业/公告数据 */
  const loadPersistentCache = async () => {
    try {
      const cache = await getAssignmentsCache();
      if (cache && cache.data) {
        const data = cache.data as CanvasAssignment[];
        const now = Date.now();
        setUpcomingAssigns(
          data.filter(a => a.display_date && new Date(a.display_date).getTime() >= now && !a.submission_types?.includes('none') && !a.has_submitted_submissions)
            .sort((a, b) => new Date(a.display_date!).getTime() - new Date(b.display_date!).getTime())
            .slice(0, 2)
        );
        const announcements = data.filter(a =>
          a.is_canvas_announcement ||
          (a.submission_types && (a.submission_types.includes('none') || a.submission_types.includes('not_graded')))
        );
        if (announcements.length > 0) {
          const sorted = announcements.sort((a, b) => {
            const ta = a.display_date ? new Date(a.display_date).getTime() : 0;
            const tb = b.display_date ? new Date(b.display_date).getTime() : 0;
            return tb - ta;
          });
          setRecentAnnouncement(sorted[0]);
        }
        // 同步到内存缓存
        setCache('assignments', data);
      }
    } catch { /* 缓存不存在或损坏，等网络刷新 */ }
  };

  /** 后台刷新所有数据 */
  const refreshAllData = async () => {
    await Promise.all([
      loadAssignmentsSummary(),
      loadAnnouncementsSummary(),
      loadExamsSummary(),
      loadMailSummary(),
      loadScheduleSummary(),
      loadJwcNotices(),
      loadIsjtuNotices(),
    ]);
  };

  /** 下拉刷新 — 弹出确认框 */
  const onRefresh = () => {
    if (refreshing) return;
    setShowRefreshModal(true);
  };

  /** 确认后执行刷新 — 清除内存/磁盘缓存后强制从云端拉取所有数据 */
  const confirmRefresh = async () => {
    setShowRefreshModal(false);
    setRefreshing(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    try {
      clearCache('assignments');
      await AsyncStorage.removeItem('CALENDAR_CACHE');
      // 清除所有课表、考试、通知缓存，确保重新从云端拉取
      const allKeys = await AsyncStorage.getAllKeys();
      const removeKeys = allKeys.filter(k =>
        k.startsWith('SCHEDULE_CACHE_') ||
        k.startsWith('EXAM_CACHE_') ||
        k === 'JWC_NOTICES_CACHE'
      );
      if (removeKeys.length > 0) await AsyncStorage.multiRemove(removeKeys);
      await Promise.all([
        loadAssignmentsSummary(),
        loadAnnouncementsSummary(),
        loadExamsSummary(),
        loadMailSummary(),
        loadScheduleSummary(),
        loadJwcNotices(),
        loadIsjtuNotices(),
      ]);
    } finally {
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
        setRefreshing(false);
      });
    }
  };

  // 只在挂载时加载一次数据（后续聚焦时直接读已有状态）
  useEffect(() => { loadData(); }, []);

  // ── 课表数据加载（优先读缓存，缓存无 kbList 则网络拉取并回写）──
  const loadScheduleSummary = async () => {
    try {
      const jUser = await getJAccountUsername(), jPass = await getJAccountPassword();
      if (!jUser || !jPass) { setScheduleInfo('请先设置 jAccount 凭据'); setScheduleDetail(''); setNextCourseName(''); setNextCourseDetail(''); return; }
      const cur = getCurrentSemester();
      // 如果 CALENDAR_CACHE 不存在，尝试从网络获取第1周数据来建立校历缓存
      let cacheJson = await AsyncStorage.getItem('CALENDAR_CACHE');
      if (!cacheJson) {
        try {
          const w1Raw = await fetchWeeklyScheduleJSON(cur.xnm, cur.xqm, 1);
          const w1Data = JSON.parse(w1Raw);
          if (w1Data.rqazcList && w1Data.rqazcList.length > 0) {
            const day1 = w1Data.rqazcList.find((d: any) => d.xqj == 1);
            if (day1 && day1.rq) {
              const startDate = new Date(day1.rq);
              const calData = JSON.stringify({
                xnm: cur.xnm, xqm: cur.xqm,
                semesterStartDate: startDate.toISOString(),
                rqazcList: w1Data.rqazcList,
                timestamp: Date.now(),
              });
              await AsyncStorage.setItem('CALENDAR_CACHE', calData);
              cacheJson = calData;
            }
          }
        } catch {}
      }
      if (!cacheJson) { setScheduleInfo('加载课表中...'); setNextCourseName(''); setNextCourseDetail(''); return; }
      const cache = JSON.parse(cacheJson);
      if (!cache.semesterStartDate) { setScheduleInfo('未找到校历'); setNextCourseName(''); setNextCourseDetail(''); return; }
      const startDate = new Date(cache.semesterStartDate);
      const diffDays = Math.floor((Date.now() - startDate.getTime()) / 86400000);
      const week = Math.floor(diffDays / 7) + 1;
      const maxWeek = cur.xqm === '16' ? 4 : 18;
      if (week < 1 || week > maxWeek) { setScheduleInfo('当前不在学期内'); setScheduleDetail(''); setNextCourseName(''); setNextCourseDetail(''); return; }

      // 优先从每学期详细缓存读取 kbList（含完整课表），没有才走网络
      const semesterKey = `SCHEDULE_CACHE_${jUser}_${cur.xnm}_${cur.xqm}`;
      let kbList: any[] = [];
      try {
        const semesterJson = await AsyncStorage.getItem(semesterKey);
        if (semesterJson) {
          const semesterCache = JSON.parse(semesterJson);
          kbList = semesterCache.kbList || [];
        }
      } catch {}

      if (kbList.length === 0) {
        try {
          const raw = await fetchWeeklyScheduleJSON(cur.xnm, cur.xqm, week);
          const d = JSON.parse(raw);
          kbList = d.kbList || [];
          // 拉取成功后回写到两个缓存
          if (kbList.length > 0) {
            const now = Date.now();
            await AsyncStorage.setItem(semesterKey, JSON.stringify({
              kbList, semesterStartDate: cache.semesterStartDate, timestamp: now,
            }));
            await AsyncStorage.setItem('CALENDAR_CACHE', JSON.stringify({ ...cache, kbList, timestamp: now }));
          }
        } catch {}
      }
      scheduleKbRef.current = kbList;
      recalcSchedule();
    } catch { setScheduleInfo('获取课表失败'); setNextCourseName(''); setNextCourseDetail(''); }
  };

  // ── 工具：获取课程的全部节次时间段 ──
  const getCoursePeriods = (c: any): { startMin: number; endMin: number }[] => {
    const match = (c.jcs || '').match(/(\d+)/g);
    if (!match) return [];
    return match.map((num: string) => {
      const p = PERIODS[parseInt(num, 10) - 1];
      return p ? { startMin: p.start, endMin: p.end } : null;
    }).filter(Boolean) as { startMin: number; endMin: number }[];
  };

  // ── 工具：获取课程的最早开始和最晚结束时间 ──
  const getCourseRange = (c: any): { startMin: number; endMin: number } => {
    const periods = getCoursePeriods(c);
    if (!periods.length) return { startMin: Infinity, endMin: Infinity };
    return {
      startMin: periods[0].startMin,
      endMin: periods[periods.length - 1].endMin,
    };
  };

  // ── 课表实时计算（只依赖 ref 数据和当前时间）──
  const recalcSchedule = () => {
    const kbList = scheduleKbRef.current;
    if (kbList.length === 0) { setScheduleInfo('暂无课表'); setScheduleDetail(''); setScheduleBadge(''); setScheduleCourse(''); setNextCourseName(''); setNextCourseDetail(''); return; }
    const now = new Date();
    const monIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const today = kbList.filter((c: any) => parseInt(c.xqj || '1', 10) === monIdx + 1);
    if (today.length === 0) { setScheduleInfo('今天没课~'); setScheduleDetail(''); setScheduleBadge(''); setScheduleCourse(''); setNextCourseName(''); setNextCourseDetail(''); return; }
    const parsed = today.map((c: any) => {
      const range = getCourseRange(c);
      return { ...c, startMin: range.startMin, endMin: range.endMin };
    }).sort((a: any, b: any) => a.startMin - b.startMin);
    // 当前正在上的课：currentMin 落在该课的任意小节内，或处于课间休息（startMin ≤ currentMin < endMin）
    const current = parsed.find((c: any) => {
      const periods = getCoursePeriods(c);
      if (periods.some(p => currentMin >= p.startMin && currentMin < p.endMin)) return true;
      // 课间休息：处于该课最早开始到最晚结束之间，但不在任一小节内
      return currentMin >= c.startMin && currentMin < c.endMin;
    });
    // 下一节课：还没开始的课（startMin > currentMin）
    const next = parsed.find((c: any) => c.startMin > currentMin);
    if (current) {
      setScheduleBadge('现在');
      setScheduleCourse(current.kcmc || '');
      setScheduleInfo(`正在上 ${current.kcmc}`);
      const remain = parsed.filter((c: any) => c.startMin > currentMin);
      if (remain.length > 0) {
        const nc = remain[0];
        const h = Math.floor(nc.startMin / 60), m = nc.startMin % 60;
        setNextCourseName(nc.kcmc || '');
        setNextCourseDetail(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  ${nc.cdmc || '待定'}`);
        setScheduleDetail(''); // 旧 detail 不再使用，改为双卡片
      } else {
        setNextCourseName('');
        setNextCourseDetail('');
        setScheduleDetail('这是今天最后一节课啦~');
      }
    } else if (next) {
      setScheduleBadge('下节');
      setScheduleCourse(next.kcmc || '');
      setNextCourseName('');
      setNextCourseDetail('');
      const h = Math.floor(next.startMin / 60), m2 = next.startMin % 60;
      setScheduleInfo(`下一节课: ${next.kcmc}`);
      setScheduleDetail(`${String(h).padStart(2, '0')}:${String(m2).padStart(2, '0')}  ${next.cdmc || '待定'}`);
    } else {
      setScheduleBadge('');
      setScheduleCourse('');
      setNextCourseName('');
      setNextCourseDetail('');
      setScheduleInfo('今天的课都上完了~');
      setScheduleDetail('');
    }
  };

  // ── 每分钟自动重算课表，聚焦时也重算 ──
  useEffect(() => {
    const timer = setInterval(recalcSchedule, 60000);
    return () => clearInterval(timer);
  }, []);
  useFocusEffect(useCallback(() => {
    recalcSchedule();
  }, []));

  // ── 邮件摘要每 30 秒后台刷新（但聚焦时立即刷新）──
  useEffect(() => {
    const timer = setInterval(loadMailSummary, 30000);
    return () => clearInterval(timer);
  }, []);

  // ── 作业（仅当有 Canvas Token 时才拉取，拉取后持久化缓存）──
  const loadAssignmentsSummary = async () => {
    try {
      const token = await getToken();
      if (!token) { setUpcomingAssigns([]); return; }
      // 先检查内存缓存（子页面切换时复用）
      const cached = getCache<CanvasAssignment[]>('assignments');
      let data = cached || [];
      if (data.length === 0) {
        try { data = await fetchAllUpcomingAssignments(); setCache('assignments', data); } catch {}
      }
      // 持久化到 AsyncStorage
      if (data.length > 0) await setAssignmentsCache(data);
      const now = Date.now();
      setUpcomingAssigns(
        data.filter(a => a.display_date && new Date(a.display_date).getTime() >= now && !a.submission_types?.includes('none') && !a.has_submitted_submissions)
          .sort((a, b) => new Date(a.display_date!).getTime() - new Date(b.display_date!).getTime())
          .slice(0, 2)
      );
    } catch { setUpcomingAssigns([]); }
  };

  // ── 公告（最新一条，也依赖 Canvas Token，拉取后持久化缓存）──
  const loadAnnouncementsSummary = async () => {
    try {
      const token = await getToken();
      if (!token) { setRecentAnnouncement(null); return; }
      const cached = getCache<CanvasAssignment[]>('assignments');
      let data = cached || [];
      if (data.length === 0) {
        try { data = await fetchAllUpcomingAssignments(); setCache('assignments', data); } catch {}
      }
      if (data.length > 0) await setAssignmentsCache(data);
      const announcements = data.filter(a =>
        a.is_canvas_announcement ||
        (a.submission_types && (a.submission_types.includes('none') || a.submission_types.includes('not_graded')))
      );
      if (announcements.length > 0) {
        const sorted = announcements.sort((a, b) => {
          const ta = a.display_date ? new Date(a.display_date).getTime() : 0;
          const tb = b.display_date ? new Date(b.display_date).getTime() : 0;
          return tb - ta;
        });
        setRecentAnnouncement(sorted[0]);
      }
    } catch { setRecentAnnouncement(null); }
  };

  // ── 考试 ──
  const loadExamsSummary = async () => {
    try {
      const jUser = await getJAccountUsername(), jPass = await getJAccountPassword();
      if (!jUser || !jPass) { setUpcomingExams([]); return; }
      const cur = getCurrentSemester();
      const cacheKey = `${EXAM_CACHE_PREFIX}${cur.xnm}_${cur.xqm}`;
      let exams: any[] = [];
      const cachedJson = await AsyncStorage.getItem(cacheKey);
      if (cachedJson) { const c = JSON.parse(cachedJson); exams = c.items || []; }
      if (exams.length === 0) {
        try { const raw = await fetchExamJSON(cur.xnm, cur.xqm); const d = JSON.parse(raw); exams = d.items || []; } catch {}
      }
      const now = Date.now();
      setUpcomingExams(
        exams.filter(e => e.kssj && safeTime(e.kssj) >= now)
          .sort((a, b) => safeTime(a.kssj) - safeTime(b.kssj))
          .slice(0, 2)
      );
    } catch { setUpcomingExams([]); }
  };

  // ── 邮件摘要 ──
  const loadMailSummary = async () => {
    try {
      const result = await fetchInbox(1, 0);
      if (result) {
        setMailUnread(result.messages.filter(m => m.flags?.includes('u')).length);
        setMailLatest(result.messages[0] || null);
      }
    } catch { /* ignore */ }
  };

  // ── 教务处通知 ──
  const loadJwcNotices = async () => {
    try {
      setJwcLoading(true);
      const notices = await fetchJwcNoticeList(1);
      setJwcNotices(notices.slice(0, 5));

      // 检测评教通知（取最新一条未过期的）
      let foundPj: JwcNotice | null = null;
      for (const n of notices) {
        if (n.isPingJiao) {
          try {
            const detail = await fetchJwcNoticeDetail(n.url);
            if (detail?.contentHtml) {
              const endTime = parsePingJiaoEndTime(detail.contentHtml);
              if (endTime) {
                n.pingJiaoEndTime = endTime;
                if (new Date(endTime).getTime() > Date.now()) {
                  foundPj = n;
                  break;
                }
              }
            }
          } catch {}
        }
      }
      setPingJiaoNotice(foundPj);

      // 从本地缓存读取置顶选课通知
      try {
        const pinJson = await AsyncStorage.getItem('XUANKE_PINNED');
        const cacheJson = await AsyncStorage.getItem('JWC_NOTICES_CACHE');
        if (pinJson && cacheJson) {
          const pinnedIds: string[] = JSON.parse(pinJson);
          const cached: JwcNotice[] = JSON.parse(cacheJson);
          if (pinnedIds.length > 0 && cached.length > 0) {
            const pinSet = new Set(pinnedIds);
            const now = Date.now();
            const found = cached.find(n => {
              if (!n.isXuanKe || !pinSet.has(n.id) || !n.xuankeInfo) return false;
              const rounds = n.xuankeInfo.rounds;
              const lastEnd = rounds.reduce((latest, r) => {
                const t = new Date(r.end).getTime();
                return t > latest ? t : latest;
              }, 0);
              return lastEnd > now;
            });
            setPinnedXuanKe(found || null);
          } else {
            setPinnedXuanKe(null);
          }
        } else {
          setPinnedXuanKe(null);
        }
      } catch { setPinnedXuanKe(null); }

      setJwcLoading(false);
    } catch { setJwcLoading(false); }
  };

  // ── i.sjtu 待阅通知 ──
  const loadIsjtuNotices = async () => {
    try {
      const notices = await fetchIsjtuNotices(1, 50);
      setIsjtuNotices(notices.slice(0, 10));
    } catch { /* ignore */ }
  };

  // ── 加载自定义优先级 ──
  useEffect(() => {
    (async () => {
      const p = await getSectionPriorities();
      setPriorities(p);
      prioritiesLoaded.current = true;
    })();
  }, []);
  useFocusEffect(useCallback(() => {
    (async () => {
      const p = await getSectionPriorities();
      setPriorities(p);
    })();
  }, []));

  const sections = React.useMemo<DynamicSection[]>(() => {
    const p = Object.keys(priorities).length > 0 ? priorities : undefined;
    const pri = (id: string, fallback: number) => p?.[id] ?? fallback;
    return [
    {
      id: "schedule",
      priority: pri("schedule", 1),
      render: () => <ScheduleSection navigation={navigation} hasJAccountCreds={hasJAccountCreds} jaccountSessionAlive={jaccountSessionAlive} scheduleInfo={scheduleInfo} scheduleDetail={scheduleDetail} scheduleBadge={scheduleBadge} scheduleCourse={scheduleCourse} nextCourseName={nextCourseName} nextCourseDetail={nextCourseDetail} />,
    },
    {
      id: "announce",
      priority: pri("announce", 3),
      render: () => <AnnouncementSection navigation={navigation} hasCanvasToken={hasCanvasToken} recentAnnouncement={recentAnnouncement} />,
    },
    {
      id: "notif",
      priority: pri("notif", 5),
      render: () => <NotifSection navigation={navigation} pinnedXuanKe={pinnedXuanKe} jwcNotices={jwcNotices} isjtuNotices={isjtuNotices} />,
    },
    {
      id: "mail",
      priority: pri("mail", 6),
      render: () => <MailSection navigation={navigation} hasJAccountCreds={hasJAccountCreds} mailChecking={mailChecking} mailAuthed={mailAuthed} mailUnread={mailUnread} mailLatest={mailLatest} />,
    },
    {
      id: "assignments",
      priority: pri("assignments", 2),
      render: () => <AssignmentSection navigation={navigation} hasCanvasToken={hasCanvasToken} upcomingAssigns={upcomingAssigns} />,
    },
    {
      id: "exams",
      priority: pri("exams", 4),
      render: () => <ExamSection navigation={navigation} hasJAccountCreds={hasJAccountCreds} upcomingExams={upcomingExams} />,
    },
    {
      id: "community",
      priority: pri("community", 7),
      render: () => <CommunitySection navigation={navigation} />,
    },
  ];}, [hasJAccountCreds, jaccountSessionAlive, hasCanvasToken, scheduleInfo, scheduleDetail, scheduleBadge, scheduleCourse, nextCourseName, nextCourseDetail, upcomingAssigns, upcomingExams, recentAnnouncement, pinnedXuanKe, jwcNotices, isjtuNotices, mailUnread, mailChecking, mailAuthed, mailLatest, priorities]);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
    <ScrollView style={[styles.safeArea, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0055A8']} tintColor="#0055A8" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{userName ? `欢迎回来，${userName}` : '欢迎回来'}</Text>
          <Text style={styles.subGreeting}>今天又是美好的一天</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.gearBtn} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={24} color="#666" />
        </TouchableOpacity>
      </View>
      {devMode && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginTop: 4, gap: 10 }}>
        </View>
      )}

      {loginChecking && <View style={styles.checkingRow}><ActivityIndicator size="small" color="#0055A8" /><Text style={styles.checkingText}>检测中...</Text></View>}

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#0055A8" /><Text style={{ marginTop: 12, color: '#999' }}>正在为你准备摘要...</Text></View>
      ) : (
        <View style={styles.sections}>

          {pingJiaoNotice && (
            <TouchableOpacity
              style={[styles.section, { backgroundColor: '#F3E5F6', borderWidth: 1.5, borderColor: '#6A1B9A', marginBottom: 10 }]}
              onPress={() => navigation.navigate('Notif')}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#6A1B9A', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <MaterialIcons name="rate-review" size={22} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#6A1B9A' }}>评教通知</Text>
                  <Text style={{ fontSize: 12, color: '#7B1FA2', marginTop: 2 }} numberOfLines={1}>
                    {pingJiaoNotice.title.replace(/上海交通大学/, '')}
                  </Text>
                  {pingJiaoNotice.pingJiaoEndTime && (
                    <Text style={{ fontSize: 12, color: '#C62828', fontWeight: '600', marginTop: 2 }}>
                      截止：{pingJiaoNotice.pingJiaoEndTime.substring(0, 16).replace('T', ' ')}
                    </Text>
                  )}
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#6A1B9A" />
              </View>
            </TouchableOpacity>
          )}
          <DynamicTwoCol sections={sections} twoColStyle={styles.twoCol} colStyle={styles.col} />

          {/* 刷新确认弹窗 */}

          {/* 刷新确认弹窗 */}
          <Modal visible={showRefreshModal} transparent animationType="fade" onRequestClose={() => setShowRefreshModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.refreshModal}>
                <MaterialIcons name="warning" size={40} color="#E53935" style={{ marginBottom: 12 }} />
                <Text style={styles.refreshModalTitle}>刷新所有数据</Text>
                <Text style={styles.refreshModalBody}>此操作将重新获取所有数据。{'\n'}确认继续吗？</Text>
                <Text style={styles.refreshModalWarn}>⚠ 此操作需要一些时间！</Text>
                <View style={styles.refreshModalActions}>
                  <TouchableOpacity style={styles.refreshBtnNo} onPress={() => setShowRefreshModal(false)} activeOpacity={0.7}>
                    <Text style={styles.refreshBtnNoText}>否</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.refreshBtnYes} onPress={confirmRefresh} activeOpacity={0.7}>
                    <Text style={styles.refreshBtnYesText}>是</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {showCrazyThu && (
            <View style={styles.crazyOuter}>
              <Image source={require('../../assets/crazyThursday.png')} style={styles.crazyImg} resizeMode="cover" />
              <TouchableOpacity style={styles.crazyClose} onPress={async () => {
                // 每次点击都先隐藏本周
                await dismissCrazyThursdayThisWeek();
                // 仅第一次弹出引导
                if (!(await hasShownCrazyThursdayFirstGuide())) {
                  await markCrazyThursdayFirstGuideShown();
                  setShowCrazyThuModal(true);
                } else {
                  setShowCrazyThu(false);
                }
              }} activeOpacity={0.7}>
                <MaterialIcons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* 首次关闭引导弹窗 */}
          <Modal visible={showCrazyThuModal} transparent animationType="fade" onRequestClose={() => { setShowCrazyThu(false); setShowCrazyThuModal(false); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.refreshModal}>
                <MaterialIcons name="celebration" size={40} color="#FF6F00" style={{ marginBottom: 12 }} />
                <Text style={styles.refreshModalTitle}>不再显示此图片</Text>
                <Text style={styles.refreshModalBody}>你可以前往设置中彻底关闭，或稍后再说。</Text>
                <View style={[styles.refreshModalActions, { justifyContent: 'center' }]}>
                  <TouchableOpacity
                    style={styles.refreshBtnYes}
                    onPress={() => {
                      setShowCrazyThuModal(false);
                      setShowCrazyThu(false);
                      navigation.navigate('Settings');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.refreshBtnYesText}>去设置中禁用</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.refreshBtnNo, { borderWidth: 1, borderColor: '#DDD' }]}
                    onPress={() => { setShowCrazyThu(false); setShowCrazyThuModal(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.refreshBtnNoText}>稍后</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Text style={styles.footer}>SJTU Helper v1.0</Text>
        </View>
      )}
    </ScrollView>

      {/* 刷新加载遮罩（渐变显隐） */}
      {refreshing && (
        <Animated.View style={[styles.refreshOverlay, { opacity: fadeAnim }]}>
          <ActivityIndicator size="large" color="#0055A8" />
          <Text style={styles.refreshOverlayText}>正在重新加载所有数据……</Text>
          <Text style={styles.refreshOverlaySub}>这需要花费一些时间。</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 8, marginTop: 4 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#333' },
  subGreeting: { fontSize: 14, color: '#999', marginTop: 2 },
  gearBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  communityBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#7B1FA2',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, gap: 4,
  },
  communityBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  checkingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  checkingText: { fontSize: 12, color: '#0055A8', marginLeft: 6 },
  loadingWrap: { paddingVertical: 80, alignItems: 'center' },

  sections: { paddingHorizontal: 12, paddingBottom: 8 },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, gap: 12 },

  section: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 14,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginLeft: 5,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },

  cmain: { fontSize: 13, color: '#333', fontWeight: '500' },
  csub: { fontSize: 12, color: '#888', marginTop: 3 },
  citem: { fontSize: 12, color: '#555', marginTop: 2, lineHeight: 18, flexShrink: 1 },
  clocation: { fontSize: 11, color: '#999', marginTop: 2 },
  examMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  examGlowWrapper: {
    position: 'relative',
    overflow: 'visible',
  },
  examPureColorBase: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: -3,
    right: -3,
    borderRadius: 13,
    opacity: 0.5,
  },

  scheduleRow: { flexDirection: 'row', alignItems: 'center' },
  scheduleBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8,
  },
  scheduleBadgeNow: { backgroundColor: '#4CAF50' },
  scheduleBadgeNext: { backgroundColor: '#FF9800' },
  scheduleBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  courseBadgeSmall: {
    alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4,
  },
  courseBadgeText: { fontSize: 11, fontWeight: '600', color: '#FFF' },

  unreadBadge: {
    backgroundColor: '#E53935', borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, marginLeft: 6,
  },
  unreadBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  mailFromRow: { flexDirection: 'row', alignItems: 'center' },
  mailDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CCC', marginRight: 6 },
  mailDotUnread: { backgroundColor: '#1A73E8' },

  guideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  guideText: { fontSize: 12, color: '#FF8C00', flex: 1 },

  // 刷新确认弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  refreshModal: {
    width: '82%', backgroundColor: '#FFF', borderRadius: 16, padding: 24,
    alignItems: 'center', elevation: 8,
  },
  refreshModalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  refreshModalBody: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  refreshModalWarn: { fontSize: 12, color: '#E53935', fontWeight: '600', marginBottom: 20 },
  refreshModalActions: { flexDirection: 'row', gap: 12 },
  refreshBtnNo: {
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  refreshBtnNoText: { fontSize: 15, color: '#666', fontWeight: '600' },
  refreshBtnYes: {
    paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#0055A8',
  },
  refreshBtnYesText: { fontSize: 15, color: '#FFF', fontWeight: '600' },

  // 刷新加载遮罩
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  refreshOverlayText: { fontSize: 15, color: '#333', fontWeight: '600', marginTop: 16 },
  refreshOverlaySub: { fontSize: 12, color: '#999', marginTop: 4 },

  crazyOuter: { borderRadius: 14, overflow: 'hidden', marginTop: 12, marginBottom: 8, position: 'relative' },
  crazyImg: { width: '100%', height: 100 },
  crazyClose: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },

  // 教务通知卡片
  notifMinorCard: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 10,
    padding: 10,
  },
  notifBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  notifRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  notifIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555',
    marginBottom: 4,
  },
  notifText: {
    fontSize: 12,
    color: '#999',
  },
  notifItem: {
    marginBottom: 6,
  },
  notifItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifItemTitle: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  notifItemDate: {
    fontSize: 11,
    color: '#AAA',
    marginTop: 1,
  },
  notifItemDetail: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    lineHeight: 16,
  },
  badgeXuanKe: {
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  badgeXuanKeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
  },
  badgeTiaoKe: {
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  badgeTiaoKeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E65100',
  },

  footer: { textAlign: 'center', color: '#CCC', fontSize: 12, marginTop: 8, marginBottom: 8 },
});