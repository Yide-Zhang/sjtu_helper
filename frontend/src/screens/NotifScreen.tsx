import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Dimensions, Animated, Modal } from 'react-native';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchJwcNoticeList, fetchJwcNoticeDetail, JwcNotice, extractXuanKeMeta, parseXuanKeContent, parsePingJiaoEndTime } from '../api/jwc';
import { fetchIsjtuNotices, IsjtuNotice } from '../api/isjtu';
import { getJAccountUsername } from '../utils/storage';
import { getCourseColor } from '../utils/colors';
import { addTodo } from '../utils/todoStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const PINNED_KEY = 'XUANKE_PINNED';
const JWC_CACHE_KEY = 'JWC_NOTICES_CACHE';

/** 选课通知卡片——纯同步，仅当 data 已就绪才展示轮次，否则普通样式 */
/** 安全渲染：捕获子组件异常，防止整个列表崩溃 */
class SafeCard extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}

/** 选课通知卡片——纯同步，仅当 data 已就绪才展示轮次，否则普通样式 */
const XuanKeCard = ({ notice, navigation, isPinned, onTogglePin, onShowTodo }: { notice: JwcNotice; navigation: any; isPinned: boolean; onTogglePin: () => void; onShowTodo: () => void }) => {
  const info = notice.xuankeInfo;
  if (!info) { return null; }
  
  const sorted = [...info.rounds].sort((a, b) => {
    const idx = (name: string) => {
      if (name.includes('试选')) return 0;
      if (name.includes('海选')) return 1;
      if (name.includes('抢选') && name.includes('第一')) return 2;
      if (name.includes('抢选') && name.includes('第二')) return 3;
      if (name.includes('抢选')) return 4;
      if (name.includes('第三轮') && name.includes('第一')) return 5;
      if (name.includes('第三轮') && name.includes('第二')) return 6;
      if (name.includes('第三轮')) return 7;
      return 999;
    };
    return idx(a.round) - idx(b.round);
  });

  // 判断最后轮次是否已过期
  const lastRound = sorted[sorted.length - 1];
  const lastEnd = lastRound?.end ? new Date(lastRound.end).getTime() : 0;
  const notExpired = lastEnd > Date.now();

  return (
    <TouchableOpacity
      style={[styles.item, { flexDirection: 'row' }]}
      onPress={() => navigation.navigate('WebView', { url: notice.url, title: notice.title })}
      activeOpacity={0.7}
    >
      {/* 左侧内容 */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.xkTitle, { marginBottom: 6 }]}>{info.academicYear} {info.seasonCn}选课</Text>
        {sorted.map((r, i) => {
          return (
            <View key={i} style={styles.xkRow}>
              <Text style={styles.xkRound}>{r.round || ''}</Text>
              <View style={styles.xkTimeCol}>
                <View style={styles.xkTimeBlock}>
                  <Text style={styles.xkTime}>{r.start?.substring(5, 10)} {r.start?.substring(11, 16)} 至</Text>
                  <Text style={styles.xkTime}>{r.end?.substring(5, 10)} {r.end?.substring(11, 16)}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <Text style={styles.itemDate}>{notice.date}</Text>
      </View>
      {/* 右侧操作按钮 */}
      {notExpired && (
        <View style={{ justifyContent: 'center', gap: 10, paddingLeft: 8 }}>
          <TouchableOpacity
            onPress={onTogglePin}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isPinned ? '#FFF3E0' : '#F5F5F5', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={0.7}
          >
            <MaterialIcons name={isPinned ? 'bookmark' : 'bookmark-border'} size={20} color={isPinned ? '#E65100' : '#999'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onShowTodo}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="playlist-add" size={20} color="#1565C0" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

/** 评教通知卡片 */
const PingJiaoCard = ({ notice, navigation, onShowTodo }: { notice: JwcNotice; navigation: any; onShowTodo: () => void }) => {
  const endTime = notice.pingJiaoEndTime;
  const expired = endTime ? new Date(endTime).getTime() < Date.now() : false;

  return (
    <TouchableOpacity
      style={[styles.item, { borderLeftWidth: 3, borderLeftColor: '#6A1B9A' }]}
      onPress={() => navigation.navigate('WebView', { url: notice.url, title: notice.title })}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={styles.pjIconWrap}>
          <MaterialIcons name="rate-review" size={22} color="#6A1B9A" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.itemTitle, { color: '#6A1B9A', fontWeight: '700' }]}>评教通知</Text>
            {expired && <Text style={[styles.pjStatus, { backgroundColor: '#E0E0E0', color: '#999' }]}>已截止</Text>}
            {!expired && endTime && <Text style={[styles.pjStatus, { backgroundColor: '#F3E5F5', color: '#6A1B9A' }]}>进行中</Text>}
          </View>
          <Text style={[styles.itemSummary, { marginTop: 0 }]} numberOfLines={2}>{notice.title.replace(/上海交通大学/, '')}</Text>
          {endTime && !expired && (
            <Text style={[styles.itemDate, { color: '#C62828', fontWeight: '600', marginTop: 4 }]}>
              截止：{endTime.substring(0, 16).replace('T', ' ')}
            </Text>
          )}
          {endTime && expired && (
            <Text style={[styles.itemDate, { color: '#999', marginTop: 4 }]}>
              已截止：{endTime.substring(0, 16).replace('T', ' ')}
            </Text>
          )}
          {!endTime && <Text style={[styles.itemDate, { marginTop: 4 }]}>{notice.date}</Text>}
        </View>
        {/* 待办按钮 */}
        {!expired && endTime && (
          <TouchableOpacity
            onPress={onShowTodo}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="playlist-add" size={20} color="#6A1B9A" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const DAY_NUM: Record<string, number> = {
  '星期一': 1, '星期二': 2, '星期三': 3, '星期四': 4, '星期五': 5, '星期六': 6, '星期日': 7, '星期天': 7,
  '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7,
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7,
};

/** 根据校历起始日和周次+星期推算具体日期（仅当有校历时精确计算） */
function getDateStr(week: number, dayStr: string, startDate: Date): string {
  const dayNum = DAY_NUM[dayStr] ?? 1;
  const d = new Date(startDate);
  d.setDate(d.getDate() + (week - 1) * 7 + (dayNum - 1));
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

type NotifTab = 'jwc' | 'isjtu';

export const NotifScreen = ({ navigation }: any) => {
  const { showAlert, alertProps } = useAlertModal();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<NotifTab>('jwc');
  const [jwcNotices, setJwcNotices] = useState<JwcNotice[]>([]);
  const [isjtuNotices, setIsjtuNotices] = useState<IsjtuNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCreds, setHasCreds] = useState(false);
  /** 所有已知学期的起始日，按时间排序 */
  const [semesterList, setSemesterList] = useState<{ start: Date; end: Date }[]>([]);
  const [jwcPage, setJwcPage] = useState(1);
  const [isjtuPage, setIsjtuPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [jwcHasMore, setJwcHasMore] = useState(true);
  const [isjtuHasMore, setIsjtuHasMore] = useState(true);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [todoRounds, setTodoRounds] = useState<{ round: string; start: string }[]>([]);
  const [todoNotice, setTodoNotice] = useState<JwcNotice | null>(null);
  const [showBackTop, setShowBackTop] = useState(false);
  const listRef = useRef<any>(null);
  const backTopOpacity = useRef(new Animated.Value(0)).current;
  const loadAll = useCallback(async () => {
    // 加载置顶 ID
    let pinnedList: string[] = [];
    try {
      const json = await AsyncStorage.getItem(PINNED_KEY);
      if (json) pinnedList = JSON.parse(json);
    } catch {}
    const pinSet = new Set(pinnedList);
    setPinnedIds(pinSet);
    const jUser = await getJAccountUsername();
    setHasCreds(!!jUser);

    // === 第一步：从本地缓存加载，优先渲染置顶项 ===
    let hasCached = false;
    try {
      const cachedJson = await AsyncStorage.getItem(JWC_CACHE_KEY);
      if (cachedJson) {
        const raw: JwcNotice[] = JSON.parse(cachedJson);
        // 去重（可能残留之前 bug 产生的重复项）
        const seen = new Set<string>();
        const cached: JwcNotice[] = [];
        for (const item of raw) {
          const key = item.id || `__idx_${cached.length}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // 旧缓存可能缺失 isPingJiao 标记，根据标题重新计算（覆盖错误标记）
          if (/评教/.test(item.title) && !/试评教/.test(item.title) && !item.isXuanKe) {
            item.isPingJiao = true;
          } else {
            item.isPingJiao = false;
          }
          cached.push(item);
        }
        cached.sort((a, b) => {
          const pa = a.isXuanKe && pinSet.has(a.id) ? 0 : 1;
          const pb = b.isXuanKe && pinSet.has(b.id) ? 0 : 1;
          return pa - pb;
        });
        setJwcNotices(cached);
        hasCached = true;
      }
    } catch {}

    // 有本地缓存则提前结束 loading，让用户马上看到置顶项
    if (hasCached) setLoading(false);

    // 有本地缓存则提前结束 loading，让用户马上看到置顶项
    if (hasCached) setLoading(false);

    // 扫描所有已缓存的学期，提取起始日
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const schedKeys = allKeys.filter(k => k.startsWith('SCHEDULE_CACHE_'));
      const semesters: { start: Date; end: Date }[] = [];
      for (const key of schedKeys) {
        try {
          const json = await AsyncStorage.getItem(key);
          if (!json) continue;
          const data = JSON.parse(json);
          if (data.semesterStartDate) {
            const start = new Date(data.semesterStartDate);
            const parts2 = key.split('_');
            const xqm = parts2[parts2.length - 1];
            const maxWeeks = xqm === '16' ? 4 : 18;
            const end = new Date(start);
            end.setDate(end.getDate() + maxWeeks * 7);
            semesters.push({ start, end });
          }
        } catch {}
      }
      semesters.sort((a, b) => a.start.getTime() - b.start.getTime());
      setSemesterList(semesters);
    } catch {}

    // === 第二步：从网络拉取最新数据 ===
    await Promise.all([
      (async () => {
        let list = await fetchJwcNoticeList(1);
        // 预先拉取选课通知详情解析轮次
        const xkItems = list.filter(n => n.isXuanKe && !n.xuankeInfo);
        if (xkItems.length > 0) {
          await Promise.all(xkItems.map(async (n) => {
            try {
              const detail = await fetchJwcNoticeDetail(n.url);
              if (!detail?.contentHtml) return;
              const pubYear = parseInt(detail.publishDate?.substring(0, 4)) || new Date().getFullYear();
              const pubMonth = parseInt(detail.publishDate?.substring(5, 7)) || new Date().getMonth() + 1;
              const parsed = parseXuanKeContent(detail.contentHtml, pubYear, pubMonth);
              if (!parsed) return;
              const meta = extractXuanKeMeta(n.title);
              if (meta) {
                parsed.academicYear = meta.academicYear;
                parsed.season = meta.season;
                parsed.seasonCn = meta.seasonCn;
                n.xuankeInfo = parsed;
              }
            } catch {} // 失败则保持普通样式
          }));
        }
        // 预先拉取评教通知详情解析截止时间
        const pjItems = list.filter(n => n.isPingJiao && !n.pingJiaoEndTime);
        if (pjItems.length > 0) {
          await Promise.all(pjItems.map(async (n) => {
            try {
              const detail = await fetchJwcNoticeDetail(n.url);
              if (!detail?.contentHtml) return;
              const endTime = parsePingJiaoEndTime(detail.contentHtml);
              if (endTime) n.pingJiaoEndTime = endTime;
            } catch {} // 失败则无截止时间
          }));
        }
        // 置顶项排最前
        const pinSet2 = new Set(pinnedList);
        list.sort((a, b) => {
          const pa = a.isXuanKe && pinSet2.has(a.id) ? 0 : 1;
          const pb = b.isXuanKe && pinSet2.has(b.id) ? 0 : 1;
          return pa - pb;
        });
        // 合并已有缓存中的额外页（第2页+），保留用户之前滚动加载的置顶项
        try {
          const existingJson = await AsyncStorage.getItem(JWC_CACHE_KEY);
          if (existingJson) {
            const existing: JwcNotice[] = JSON.parse(existingJson);
            const page1Ids = new Set(list.map(n => n.id));
            const extras = existing.filter(n => !page1Ids.has(n.id));
            // 旧缓存的额外项可能缺失 isPingJiao 标记，根据标题重新计算（覆盖错误标记）
            for (const n of extras) {
              if (/评教/.test(n.title) && !/试评教/.test(n.title) && !n.isXuanKe) {
                n.isPingJiao = true;
              } else {
                n.isPingJiao = false;
              }
            }
            if (extras.length > 0) {
              list = [...list, ...extras];
              // 推进 jwcPage 使后续 loadMore 从正确页码开始
              setJwcPage(prev => Math.max(prev, 1 + Math.ceil(extras.length / 10)));
              // 重新排序（置顶排前）
              list.sort((a, b) => {
                const pa = a.isXuanKe && pinSet2.has(a.id) ? 0 : 1;
                const pb = b.isXuanKe && pinSet2.has(b.id) ? 0 : 1;
                return pa - pb;
              });
            }
          }
        } catch {}
        // 最终去重，确保写回缓存的数据干净
        const finalSeen = new Set<string>();
        list = list.filter(item => {
          const key = item.id || `__final_${Math.random()}`;
          if (finalSeen.has(key)) return false;
          finalSeen.add(key);
          return true;
        });
        setJwcNotices(list);
        // 写入本地缓存（包含第1页+之前加载的后续页），下次进入立即可见
        AsyncStorage.setItem(JWC_CACHE_KEY, JSON.stringify(list)).catch(() => {});
        // 清理已过期的置顶
        (async () => {
          try {
            const json = await AsyncStorage.getItem(PINNED_KEY);
            if (!json) return;
            const ids: string[] = JSON.parse(json);
            const now = Date.now();
            const valid: string[] = [];
            for (const id of ids) {
              const n = list.find(n => n.id === id);
              if (!n?.xuankeInfo) { valid.push(id); continue; }
              const last = n.xuankeInfo.rounds.reduce((latest, r) => {
                const t = new Date(r.end).getTime();
                return t > latest ? t : latest;
              }, 0);
              if (last > now) valid.push(id);
            }
            if (valid.length !== ids.length) {
              await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(valid));
              setPinnedIds(new Set(valid));
            }
          } catch {}
        })();
      })(),
      (async () => {
        if (!jUser) return;
        const list = await fetchIsjtuNotices(1, 50);
        setIsjtuNotices(list);
      })(),
    ]);

    // 如果缓存没命中，此时结束 loading
    if (!hasCached) setLoading(false);
  }, []);

  useEffect(() => { (async () => { setLoading(true); await loadAll(); })(); }, [loadAll]);


  const togglePin = useCallback(async (id: string) => {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPinnedIds(next);
    await AsyncStorage.setItem(PINNED_KEY, JSON.stringify([...next])).catch(() => {});
    // 立即重排：置顶排前，非置顶按日期降序
    setJwcNotices(prev => [...prev].sort((a, b) => {
      const pa = a.isXuanKe && next.has(a.id) ? 0 : 1;
      const pb = b.isXuanKe && next.has(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      // 同为非置顶时按日期降序，回到自然位置
      return b.date.localeCompare(a.date);
    }));
  }, [pinnedIds]);

  const showTodoModal = useCallback((notice: JwcNotice, rounds: { round: string; start: string; end: string; startWeek: number; endWeek: number }[]) => {
    const now = Date.now();
    const future = rounds.filter(r => new Date(r.start).getTime() > now);
    if (future.length === 0) { showAlert({ title: '提示', message: '所有轮次均已开始，无需创建待办', icon: 'info', simple: true }); return; }
    setTodoRounds(future.map(r => ({ round: r.round, start: r.start })));
    setTodoNotice(notice);
    setTodoModalVisible(true);
  }, []);

  const showPingJiaoTodo = useCallback((notice: JwcNotice) => {
    if (!notice.pingJiaoEndTime) return;
    const endTime = new Date(notice.pingJiaoEndTime).getTime();
    if (endTime < Date.now()) { showAlert({ title: '提示', message: '评教已截止', icon: 'info', simple: true }); return; }
    setTodoRounds([{ round: '评教', start: notice.pingJiaoEndTime }]);
    setTodoNotice(notice);
    setTodoModalVisible(true);
  }, []);

  const confirmCreateTodo = useCallback(async () => {
    const courseName = `${todoNotice?.xuankeInfo?.academicYear || ''}选课`;
    for (const r of todoRounds) {
      try { await addTodo(courseName, r.round, r.start); } catch {}
    }
    setTodoModalVisible(false);
    showAlert({ title: '✅ 已创建', message: `已为 ${todoRounds.length} 个轮次创建待办，可在作业页面查看`, icon: 'check-circle', iconColor: '#43A047', simple: true });
  }, [todoRounds, todoNotice]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setJwcPage(1);
    setIsjtuPage(1);
    setJwcHasMore(true);
    setIsjtuHasMore(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  /** 滚动加载更多 */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const hasMore = tab === 'jwc' ? jwcHasMore : isjtuHasMore;
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      if (tab === 'jwc') {
        const next = jwcPage + 1;
        let list = await fetchJwcNoticeList(next);
        if (list.length > 0) {
          // 同样预加载选课详情
          await Promise.all(list.filter(n => n.isXuanKe).map(async (n) => {
            try {
              const detail = await fetchJwcNoticeDetail(n.url);
              if (!detail?.contentHtml) return;
              const pubYear = parseInt(detail.publishDate?.substring(0, 4)) || new Date().getFullYear();
              const pubMonth = parseInt(detail.publishDate?.substring(5, 7)) || new Date().getMonth() + 1;
              const parsed = parseXuanKeContent(detail.contentHtml, pubYear, pubMonth);
              if (!parsed) return;
              const meta = extractXuanKeMeta(n.title);
              if (meta) { parsed.academicYear = meta.academicYear; parsed.season = meta.season; parsed.seasonCn = meta.seasonCn; n.xuankeInfo = parsed; }
            } catch {}
          }));
          // 预加载评教截止时间
          await Promise.all(list.filter(n => n.isPingJiao).map(async (n) => {
            try {
              const detail = await fetchJwcNoticeDetail(n.url);
              if (!detail?.contentHtml) return;
              const endTime = parsePingJiaoEndTime(detail.contentHtml);
              if (endTime) n.pingJiaoEndTime = endTime;
            } catch {}
          }));
          setJwcNotices(prev => {
            const existingMap = new Map(prev.map(n => [n.id, n]));
            const added: JwcNotice[] = [];
            for (const n of list) {
              const existing = existingMap.get(n.id);
              if (existing) {
                // 已有项同步新属性（isPingJiao/pingJiaoEndTime 等可能是旧缓存缺失的）
                if (n.isPingJiao) existing.isPingJiao = true;
                if (n.pingJiaoEndTime) existing.pingJiaoEndTime = n.pingJiaoEndTime;
                if (n.isXuanKe) existing.isXuanKe = true;
                if (n.xuankeInfo) existing.xuankeInfo = n.xuankeInfo;
                existing.title = n.title;
                existing.date = n.date;
                existing.summary = n.summary;
                existing.url = n.url;
              } else {
                added.push(n);
              }
            }
            if (added.length === 0) {
              // 没有真正的新项，但已有项可能已更新属性，推进页码下次继续尝试
              setJwcPage(prev => prev + 1);
              return [...prev]; // 触发重渲染
            }
            const merged = [...prev, ...added];
            // 追加后同步更新本地缓存
            AsyncStorage.setItem(JWC_CACHE_KEY, JSON.stringify(merged)).catch(() => {});
            return merged;
          });
          setJwcPage(next);
        } else {
          setJwcHasMore(false);
        }
      } else {
        const next = isjtuPage + 1;
        const list = await fetchIsjtuNotices(next, 50);
        if (list.length > 0) {
          setIsjtuNotices(prev => [...prev, ...list]);
          setIsjtuPage(next);
        } else {
          setIsjtuHasMore(false);
        }
      }
    } catch {} finally {
      setLoadingMore(false);
    }
  }, [tab, jwcPage, isjtuPage, loadingMore, jwcHasMore, isjtuHasMore]);

  /** 滚动监听：显示/隐藏回到顶部按钮 */
  const handleScroll = useCallback((e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const threshold = SCREEN_HEIGHT * 2;
    if (y > threshold && !showBackTop) {
      setShowBackTop(true);
      Animated.timing(backTopOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    } else if (y <= threshold && showBackTop) {
      setShowBackTop(false);
      Animated.timing(backTopOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [showBackTop]);

  const renderJwcItem = ({ item }: { item: JwcNotice }) => {
    const fallback = (
      <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('WebView', { url: item.url, title: item.title })} activeOpacity={0.7}>
        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.itemSummary} numberOfLines={2}>{item.summary}</Text>
        <Text style={styles.itemDate}>{item.date}</Text>
      </TouchableOpacity>
    );
    try {
      if (item.isXuanKe) {
        return (
          <SafeCard fallback={fallback}>
            <XuanKeCard
              notice={item}
              navigation={navigation}
              isPinned={pinnedIds.has(item.id)}
              onTogglePin={() => togglePin(item.id)}
              onShowTodo={() => item.xuankeInfo && showTodoModal(item, item.xuankeInfo.rounds)}
            />
          </SafeCard>
        );
      }
      if (item.isPingJiao) {
        return (
          <PingJiaoCard
            notice={item}
            navigation={navigation}
            onShowTodo={() => item.pingJiaoEndTime && showPingJiaoTodo(item)}
          />
        );
      }
      return fallback;
    } catch { return fallback; }
  };

  /** 格式化周次：处理 "8" → "第8周", "6-16" → "第6-16周", "6-14周,16" → "第6-14周,16周" */
  const fmtWeek = (w: string): string => w.endsWith('周') ? `第${w}` : `第${w}周`;
  /** 是否为简单单周（如 "8"） */
  const isSimple = (w: string): boolean => /^\d+$/.test(w);

  const renderIsjtuItem = ({ item }: { item: IsjtuNotice }) => {
    const tk = item.tiaoKeInfo;
    if (tk) {
      const dayO = tk.original.day.replace('星期', '周');
      const dayN = tk.new.day.replace('星期', '周');
      const simpleOrig = isSimple(tk.original.week);
      const simpleNew = isSimple(tk.new.week);
      // 匹配学期：优先精确命中，否则往后取最近一个学期
      const cjsjTime = item.time ? new Date(item.time.substring(0, 10)).getTime() : 0;
      let matchedSem = cjsjTime ? semesterList.find(s => cjsjTime >= s.start.getTime() && cjsjTime <= s.end.getTime()) : null;
      if (!matchedSem && cjsjTime) {
        // 往后找：取 start > cjsjTime 中最近的一个
        matchedSem = semesterList.find(s => s.start.getTime() > cjsjTime) || null;
      }
      const semStart = matchedSem?.start ?? null;
      const tDiff = tk.original.teacher !== tk.new.teacher;
      const lDiff = tk.original.location !== tk.new.location;
      const wDiff = tk.original.week !== tk.new.week || tk.original.day !== tk.new.day;
      const pDiff = tk.original.periodStart !== tk.new.periodStart || tk.original.periodEnd !== tk.new.periodEnd;
      return (
        <View style={styles.item}>
          {/* 课程名称标签 */}
          <View style={[styles.tkCourseBadge, { backgroundColor: getCourseColor(tk.course) }]}>
            <Text style={styles.tkCourseBadgeText} numberOfLines={1}>{tk.course}</Text>
          </View>

          {/* 教师+地点 / 周次 / 节次 — 逐行左右对比 */}
          <View style={styles.tkSection}>
            {/* 教师 */}
            <View style={styles.tkDataRow}>
              <View style={styles.tkSideLeft}><Text style={[styles.tkTeacher, tDiff && styles.tkChanged]}>{tk.original.teacher}</Text></View>
              <Text style={styles.tkArrow}>→</Text>
              <View style={styles.tkSideRight}><Text style={[styles.tkTeacher, tDiff && styles.tkChanged]}>{tk.new.teacher}</Text></View>
            </View>
            {/* 地点 */}
            <View style={styles.tkDataRow}>
              <View style={styles.tkSideLeft}><Text style={[styles.tkLocation, lDiff && styles.tkChanged]}>{tk.original.location}</Text></View>
              <Text style={styles.tkArrow}>→</Text>
              <View style={styles.tkSideRight}><Text style={[styles.tkLocation, lDiff && styles.tkChanged]}>{tk.new.location}</Text></View>
            </View>
            {/* 周次 */}
            <View style={styles.tkDataRow}>
              <View style={styles.tkSideLeft}>
                <Text style={styles.tkRowInline}>
                  {semStart && simpleOrig && <Text style={[styles.tkDateSmall, wDiff && styles.tkChanged]}>{getDateStr(parseInt(tk.original.week), tk.original.day, semStart)} </Text>}
                  <Text style={[styles.tkWeekLarge, wDiff && styles.tkChanged]}>{fmtWeek(tk.original.week)}{dayO}</Text>
                </Text>
              </View>
              <Text style={styles.tkArrow}>→</Text>
              <View style={styles.tkSideRight}>
                <Text style={styles.tkRowInline}>
                  <Text style={[styles.tkWeekLarge, wDiff && styles.tkChanged]}>{fmtWeek(tk.new.week)}{dayN} </Text>
                  {semStart && simpleNew && <Text style={[styles.tkDateSmall, wDiff && styles.tkChanged]}>{getDateStr(parseInt(tk.new.week), tk.new.day, semStart)}</Text>}
                </Text>
              </View>
            </View>
            {/* 节次 */}
            <View style={styles.tkDataRow}>
              <View style={styles.tkSideLeft}><Text style={[styles.tkPeriod, pDiff && styles.tkChanged]}>第{tk.original.periodStart}-{tk.original.periodEnd}节</Text></View>
              <Text style={styles.tkArrow}>→</Text>
              <View style={styles.tkSideRight}><Text style={[styles.tkPeriod, pDiff && styles.tkChanged]}>第{tk.new.periodStart}-{tk.new.periodEnd}节</Text></View>
            </View>
          </View>

          <Text style={styles.itemDate}>{item.time?.substring(0, 10)}</Text>
        </View>
      );
    }
    return (
      <View style={styles.item}>
        <Text style={styles.itemTitleNotif} numberOfLines={2}>{item.title}</Text>
        {item.content ? <Text style={styles.itemSummary} numberOfLines={2}>{item.content}</Text> : null}
        <Text style={styles.itemDate}>{item.time?.substring(0, 10)}</Text>
      </View>
    );
  };

  const tabs: { key: NotifTab; label: string; icon: string; color: string }[] = [
    { key: 'jwc', label: '教务处公告', icon: 'gavel', color: '#2E7D32' },
    { key: 'isjtu', label: '教学信息服务', icon: 'notifications', color: '#1565C0' },
  ];

  const rawData = tab === 'jwc' ? jwcNotices : isjtuNotices;
  const currentData = tab === 'jwc' ? jwcNotices : isjtuNotices;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>教务通知</Text>
        <View style={styles.backBtn} />
      </View>

      {/* 标签切换 */}
      <View style={styles.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { backgroundColor: t.color + '20' }]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <MaterialIcons name={t.icon as any} size={16} color={tab === t.key ? t.color : '#999'} />
            <Text style={[styles.tabText, { color: tab === t.key ? t.color : '#999' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0055A8" />
        </View>
      ) : !hasCreds && tab === 'isjtu' ? (
        <TouchableOpacity style={styles.emptyWrap} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
          <MaterialIcons name="lock" size={48} color="#E0E0E0" />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#CCC', marginTop: 4 }}>暂不可用</Text>
          <Text style={{ fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
            教学信息服务需要登录 jAccount{'\n'}请先设置凭据
          </Text>
          <View style={{ marginTop: 16, backgroundColor: '#0055A8', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>前往设置 →</Text>
          </View>
        </TouchableOpacity>
      ) : currentData.length === 0 ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="inbox" size={48} color="#CCC" />
          <Text style={styles.emptyText}>暂无通知</Text>
        </View>
      ) : (
        <FlatList<any>
          ref={listRef}
          data={currentData}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={tab === 'jwc' ? renderJwcItem : renderIsjtuItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          ListFooterComponent={loadingMore ? <View style={styles.loadingMore}><ActivityIndicator size="small" color="#0055A8" /><Text style={styles.loadingMoreText}>加载更多…</Text></View> : <View style={styles.listFooter} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0055A8']} tintColor="#0055A8" />}
        />
      )}

      {/* 回到顶部按钮 */}
      {showBackTop && (
        <Animated.View style={[styles.backTopBtn, { opacity: backTopOpacity, bottom: insets.bottom + 16 }]}>
          <TouchableOpacity onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} activeOpacity={0.7}>
            <MaterialIcons name="keyboard-arrow-up" size={28} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* 创建待办确认弹窗 */}
      <Modal visible={todoModalVisible} transparent animationType="fade" onRequestClose={() => setTodoModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 340 }]}>
            <Text style={styles.modalTitle}>📌 创建选课待办</Text>
            <Text style={[styles.devStatusText, { fontSize: 13, marginBottom: 12 }]}>
              将为以下轮次创建待办（已开始的轮次已过滤）：
            </Text>
            {todoRounds.map((r, i) => {
              const d = r.start.substring(0, 16).replace('T', ' ');
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MaterialIcons name="event" size={16} color="#E65100" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13, color: '#333', flex: 1 }}>{r.round}</Text>
                  <Text style={{ fontSize: 12, color: '#999' }}>{d}</Text>
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EEE' }}
                onPress={() => setTodoModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: '#666', fontWeight: '600' }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0055A8' }}
                onPress={confirmCreateTodo}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: '#FFF', fontWeight: '600' }}>确认创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <AlertModal {...alertProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#333', textAlign: 'center' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: '#999' },
  list: { padding: 12, gap: 8 },
  item: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemTitle: { fontSize: 14, color: '#333', fontWeight: '600', flex: 1, lineHeight: 20 },
  itemTitleNotif: { fontSize: 14, color: '#333', fontWeight: '600', lineHeight: 20 },
  itemSummary: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 17 },
  itemDetail: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 17 },
  itemDate: { fontSize: 11, color: '#AAA', marginTop: 6 },
  badgeXuanKe: {
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    marginTop: 2,
  },
  badgeXuanKeText: { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
  badgeTiaoKe: {
    backgroundColor: '#FFF3E0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    marginTop: 2,
  },
  badgeTiaoKeText: { fontSize: 10, fontWeight: '700', color: '#E65100' },

  pjIconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3E5F5',
    justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2,
  },
  pjStatus: {
    fontSize: 10, fontWeight: '700', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8, overflow: 'hidden',
  },

  loadingMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  loadingMoreText: { fontSize: 12, color: '#999' },
  listFooter: { height: 20 },
  backTopBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0055A8',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },

  // 弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '82%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 8 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 8 },
  devStatusText: { fontSize: 12, color: '#666', lineHeight: 17, marginTop: 4 },

  // 选课卡片
  xkTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 8 },
  xkRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 4,
  },
  xkRound: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E65100',
    width: 132,
  },
  xkTimeCol: {
    flex: 1,
  },
  xkTimeBlock: {
    alignSelf: 'flex-end',
    marginRight: 18,
  },
  xkTime: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },

  // 调课卡片布局（双列对比）
  tkCourseBadge: {
    alignSelf: 'center',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  tkCourseBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  tkSection: {
    gap: 4,
  },
  tkDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tkSideLeft: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  tkSideRight: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  tkTeacher: { fontSize: 12, color: '#666', fontWeight: '600' },
  tkChanged: { color: '#E53935' },
  tkLocation: { fontSize: 11, color: '#999' },
  tkDateSmall: { fontSize: 11, color: '#999' },
  tkRowInline: { flexDirection: 'row', alignItems: 'baseline' },
  tkArrow: { fontSize: 12, color: '#CCC', fontWeight: '600', marginHorizontal: 4 },
  tkWeekLarge: { fontSize: 15, fontWeight: '700', color: '#333' },
  tkPeriod: { fontSize: 12, color: '#888' },
});
