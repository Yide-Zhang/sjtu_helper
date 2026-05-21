import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchExamJSON, fetchGradeList, fetchGradeDetail, checkJAccountSession } from '../api/jaccount';
import { getExamUpdateInterval, EXAM_CACHE_PREFIX, GRADE_CACHE_PREFIX, getJAccountUsername, getJAccountPassword } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { numericToGrade } from '../utils/gradeMapping';

interface ExamItem {
  kcmc: string;
  ksmc: string;
  kssj: string;
  cdmc: string;
  zwh: string;
  jsbm: string;
  [key: string]: any;
}

interface ExamCache {
  items: ExamItem[];
  timestamp: number;
}

const XQM_OPTIONS: { val: string; label: string }[] = [
  { val: '3', label: '秋' },
  { val: '12', label: '春' },
  { val: '16', label: '夏' },
];

const SEM_COLORS: Record<string, string> = {
  '3': '#B8860B',
  '12': '#2E7D32',
  '16': '#01579B',
};

const getCurrentRealSemester = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 2 && month <= 6) return { xnm: String(year - 1), xqm: '12' };
  if (month >= 7 && month <= 8) return { xnm: String(year - 1), xqm: '16' };
  if (month >= 9 && month <= 12) return { xnm: String(year), xqm: '3' };
  return { xnm: String(year - 1), xqm: '3' };
};

const generateYears = (): string[] => {
  const options: string[] = [];
  const baseYear = new Date().getFullYear();
  for (let y = baseYear + 1; y >= baseYear - 4; y--) options.push(String(y));
  return options;
};

const examCacheKey = (xnm: string, xqm: string) => `${EXAM_CACHE_PREFIX}${xnm}_${xqm}`;
const gradeCacheKey = (xnm: string, xqm: string) => `${GRADE_CACHE_PREFIX}${xnm}_${xqm}`;

export const ExamsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const current = getCurrentRealSemester();
  const [xnm, setXnm] = useState(current.xnm);
  const [xqm, setXqm] = useState(current.xqm);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasCreds, setHasCreds] = useState<boolean | null>(null);
  const [sessionAlive, setSessionAlive] = useState<boolean | null>(null);

  // 检测 jAccount 凭据与会话
  useEffect(() => {
    (async () => {
      const jUser = await getJAccountUsername();
      const jPass = await getJAccountPassword();
      const creds = !!(jUser && jPass);
      setHasCreds(creds);
      if (creds) {
        const alive = await checkJAccountSession();
        setSessionAlive(alive);
      } else {
        setSessionAlive(null);
      }
    })();
  }, []);

  const fetchData = async (xn: string, xq: string, forceRefresh: boolean = false) => {
    if (!forceRefresh) setLoading(true);
    setError('');

    try {
      const maxAgeMs = (await getExamUpdateInterval()) * 24 * 60 * 60 * 1000;

      // 成绩：预先拉取所有学期，缓存下来
      if (forceRefresh) {
        // 下拉刷新时重新拉取所有学期的成绩
        const years = generateYears();
        const allSemesters: { xnm: string; xqm: string }[] = [];
        for (const y of years) {
          for (const xqVal of ['3', '12', '16']) allSemesters.push({ xnm: y, xqm: xqVal });
        }
        await Promise.all(allSemesters.map(async ({ xnm: yn, xqm: yq }) => {
          try {
            const raw = await fetchGradeList(yn, yq);
            const data = JSON.parse(raw);
            const items = data.items || [];
            await AsyncStorage.setItem(gradeCacheKey(yn, yq), JSON.stringify({ items, timestamp: Date.now() }));
          } catch { /* 无成绩的学期跳过 */ }
        }));
      }

      // 当前学期考试（走缓存）
      const examItems = await (async () => {
        if (!forceRefresh) {
          const cachedJson = await AsyncStorage.getItem(examCacheKey(xn, xq));
          if (cachedJson) {
            const cached: ExamCache = JSON.parse(cachedJson);
            if (Date.now() - cached.timestamp < maxAgeMs) return cached.items;
          }
        }
        const raw = await fetchExamJSON(xn, xq);
        const data = JSON.parse(raw);
        const items = data.items || [];
        await AsyncStorage.setItem(examCacheKey(xn, xq), JSON.stringify({ items, timestamp: Date.now() } as ExamCache));
        return items;
      })();

      // 当前学期成绩（读缓存，预拉取已经写入了）
      let gradeItems: any[] = [];
      const cachedJson = await AsyncStorage.getItem(gradeCacheKey(xn, xq));
      if (cachedJson) {
        const cached = JSON.parse(cachedJson);
        if (Date.now() - cached.timestamp < maxAgeMs) gradeItems = cached.items;
      }
      // 如果缓存未命中（首次安装后第一次打开），单独拉取当前学期
      if (!cachedJson) {
        try {
          const raw = await fetchGradeList(xn, xq);
          const data = JSON.parse(raw);
          gradeItems = data.items || [];
          await AsyncStorage.setItem(gradeCacheKey(xn, xq), JSON.stringify({ items: gradeItems, timestamp: Date.now() }));
        } catch {}
      }

      setExams(examItems);
      setCourses(gradeItems);

      if (examItems.length === 0 && gradeItems.length === 0) setError('该学期暂无考试安排与成绩记录');
    } catch (e: any) {
      setError(e?.message || '获取数据失败');
      setExams([]);
      setCourses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 首次加载：预拉取所有学期成绩（需会话有效）
  const prefetched = React.useRef(false);
  useEffect(() => {
    if (prefetched.current || sessionAlive !== true) return;
    prefetched.current = true;
    (async () => {
      const years = generateYears();
      const allSemesters: { xnm: string; xqm: string }[] = [];
      for (const y of years) {
        for (const xqVal of ['3', '12', '16']) allSemesters.push({ xnm: y, xqm: xqVal });
      }
      await Promise.all(allSemesters.map(async ({ xnm: yn, xqm: yq }) => {
        try {
          const raw = await fetchGradeList(yn, yq);
          const data = JSON.parse(raw);
          const items = data.items || [];
          await AsyncStorage.setItem(gradeCacheKey(yn, yq), JSON.stringify({ items, timestamp: Date.now() }));
        } catch {}
      }));
    })();
  }, [sessionAlive]);

  // 切换学期时加载（成绩走缓存），需会话有效
  useEffect(() => {
    if (sessionAlive !== true) return;
    fetchData(xnm, xqm);
  }, [xnm, xqm, sessionAlive]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(xnm, xqm, true);
  }, [xnm, xqm]);

  const hasData = exams.length > 0 || courses.length > 0;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>考试与成绩</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Semester Selector */}
        <View style={styles.semesterRow}>
          <TouchableOpacity
            onPress={() => {
              const years = generateYears();
              const idx = years.indexOf(xnm);
              if (idx < years.length - 1) { setXnm(years[idx + 1]); }
            }}
            style={styles.arrowBtn}
            activeOpacity={0.6}
          >
            <MaterialIcons name="chevron-left" size={22} color="#0055A8" />
          </TouchableOpacity>
          <Text style={styles.semYearText}>{xnm}-{Number(xnm) + 1}</Text>
          <TouchableOpacity
            onPress={() => {
              const opts = XQM_OPTIONS;
              const idx = opts.findIndex(o => o.val === xqm);
              const next = (idx + 1) % opts.length;
              setXqm(opts[next].val);
            }}
            style={[styles.semBtn, { backgroundColor: SEM_COLORS[xqm] || '#E0E0E0' }]}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={styles.semBtnText}>{XQM_OPTIONS.find(o => o.val === xqm)?.label || ''}</Text>
              <MaterialIcons name="loop" size={16} color="rgba(255,255,255,0.85)" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const years = generateYears();
              const idx = years.indexOf(xnm);
              if (idx > 0) { setXnm(years[idx - 1]); }
            }}
            style={styles.arrowBtn}
            activeOpacity={0.6}
          >
            <MaterialIcons name="chevron-right" size={22} color="#0055A8" />
          </TouchableOpacity>
        </View>

        {/* 会话检测 */}
        {hasCreds === false && (
          <View style={styles.sessionBlock}>
            <MaterialIcons name="lock" size={40} color="#999" />
            <Text style={styles.sessionText}>请先填写 jAccount 凭据</Text>
            <TouchableOpacity style={styles.sessionBtn} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
              <Text style={styles.sessionBtnText}>去设置</Text>
            </TouchableOpacity>
          </View>
        )}
        {hasCreds === true && sessionAlive === false && (
          <View style={styles.sessionBlock}>
            <MaterialIcons name="warning" size={40} color="#E65100" />
            <Text style={styles.sessionText}>jAccount 会话已过期</Text>
            <TouchableOpacity style={styles.sessionBtn} onPress={() => navigation.navigate('JAccountLogin', { mode: 'auto' })} activeOpacity={0.7}>
              <Text style={styles.sessionBtnText}>重新登录</Text>
            </TouchableOpacity>
          </View>
        )}
        {hasCreds === true && sessionAlive === null && (
          <View style={styles.sessionBlock}>
            <ActivityIndicator size="small" color="#999" />
            <Text style={styles.sessionText}>正在检测会话状态...</Text>
          </View>
        )}

        {/* Loading */}
        {loading && <ActivityIndicator size="large" color="#0055A8" style={{ marginTop: 40 }} />}

        {/* Error */}
        {!loading && !hasData && error && (
          <ScrollView
            contentContainerStyle={styles.errorContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0055A8']} tintColor="#0055A8" />
            }
          >
            <Text style={styles.errorText}>{error}</Text>
          </ScrollView>
        )}

        {/* Combined List */}
        {!loading && hasData && (
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0055A8']} tintColor="#0055A8" />
            }
          >
            {/* 成绩列表 */}
            {courses.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>课程成绩</Text>
                {courses.map((c, i) => {
                  const isW = c.zpcj === 'W';
                  const isGrade = /^[A-Z][+-]?$/.test((c.zpcj || '').trim());
                  return (
                    <TouchableOpacity
                      key={`g-${i}`}
                      style={styles.card}
                      activeOpacity={0.7}
                      onPress={() => {
                        (async () => {
                          try {
                            const detailRaw = await fetchGradeDetail(c.jxb_id, xnm, xqm);
                            const detailData = JSON.parse(detailRaw);
                            const items = detailData.items || [];
                            navigation.navigate('ScoreDetail', {
                              course: {
                                kcmc: c.kcmc, kch: c.kch, xf: c.xf, zpcj: c.zpcj, items,
                              },
                            });
                          } catch {
                            navigation.navigate('ScoreDetail', {
                              course: {
                                kcmc: c.kcmc, kch: c.kch, xf: c.xf, zpcj: c.zpcj, items: [],
                              },
                            });
                          }
                        })();
                      }}
                    >
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardLeftIcon}>
                          <MaterialIcons name="school" size={18} color={isW ? '#F44336' : '#0055A8'} />
                        </View>
                        <Text style={styles.courseName} numberOfLines={1}>{c.kcmc}</Text>
                        <View style={styles.scoreArea}>
                          <Text style={[styles.score, isW ? styles.scoreW : (isGrade ? styles.scoreGrade : styles.scoreNum)]}>{c.zpcj}</Text>
                          {!isW && !isGrade && (() => {
                            const g = numericToGrade(parseFloat(c.zpcj));
                            return g ? <Text style={styles.gradeLetter}>{g}</Text> : null;
                          })()}
                        </View>
                      </View>
                      <View style={styles.cardBotRow}>
                        <Text style={styles.meta}>{c.kch}</Text>
                        <Text style={styles.meta}>{c.xf} 学分</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* 考试列表（按考试时间从早到晚排序） */}
            {exams.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>考试安排</Text>
                {[...exams]
                  .sort((a, b) => {
                    const safe = (s: string | undefined) => {
                      if (!s) return Infinity;
                      const m = s.match(/^(\d{4}-\d{2}-\d{2})\((\d{2}:\d{2})/);
                      if (m) {
                        const d = new Date(`${m[1]}T${m[2]}`);
                        if (!isNaN(d.getTime())) return d.getTime();
                      }
                      const d = new Date(s.substring(0, 10));
                      return isNaN(d.getTime()) ? Infinity : d.getTime();
                    };
                    return safe(a.kssj) - safe(b.kssj);
                  })
                  .map((exam, i) => {
                  let timeStr = exam.kssj || '待定';
                  if (timeStr.includes(' ')) {
                    const [d, t] = timeStr.split(' ');
                    timeStr = `${d.replace(/-/g, '.')} ${t.substring(0, 5)}`;
                  }
                  return (
                    <View key={`e-${i}`} style={styles.card}>
                      <View style={styles.cardTopRow}>
                        <View style={[styles.cardLeftIcon, { backgroundColor: '#FFF3E0' }]}>
                          <MaterialIcons name="edit-calendar" size={18} color="#E65100" />
                        </View>
                        <Text style={styles.courseName}>{exam.kcmc || '未知课程'}</Text>
                        {exam.ksmc && <Text style={styles.examType}>{exam.ksmc}</Text>}
                      </View>
                      <View style={styles.cardBody}>
                        <View style={styles.infoRow}>
                          <MaterialIcons name="access-time" size={16} color="#0055A8" />
                          <Text style={styles.infoText}>{timeStr}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <MaterialIcons name="location-on" size={16} color="#E65100" />
                          <Text style={styles.infoText}>{exam.cdmc || '待定'}{exam.zwh ? ` 座位号: ${exam.zwh}` : ''}</Text>
                        </View>
                        {exam.jsbm && (
                          <View style={styles.infoRow}>
                            <MaterialIcons name="meeting-room" size={16} color="#666" />
                            <Text style={styles.infoText}>{exam.jsbm}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  container: { flex: 1, padding: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerSpacer: { width: 30 },
  semesterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  arrowBtn: { padding: 8 },
  semYearText: { fontSize: 16, fontWeight: '700', color: '#333', marginHorizontal: 12 },
  semBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginHorizontal: 4,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#999' },
  sessionBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  sessionText: { fontSize: 16, color: '#666', marginTop: 12, marginBottom: 20, textAlign: 'center' },
  sessionBtn: { backgroundColor: '#0055A8', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  sessionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  list: { flex: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#999', marginBottom: 10, marginTop: 4, letterSpacing: 1 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  cardLeftIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F4FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  courseName: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1, marginRight: 8 },
  examType: {
    fontSize: 12, fontWeight: '600', color: '#0055A8',
    backgroundColor: '#E8F4FF', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, marginLeft: 4,
  },
  cardBody: { padding: 14 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: { fontSize: 14, color: '#555', marginLeft: 8 },
  cardBotRow: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 12 },
  meta: { fontSize: 12, color: '#999', marginRight: 16 },
  score: { fontSize: 22, fontWeight: '800', marginLeft: 4 },
  scoreNum: { color: '#0055A8' },
  scoreW: { color: '#F44336' },
  scoreGrade: { color: '#9C27B0' },
  scoreArea: { flexDirection: 'row', alignItems: 'baseline' },
  gradeLetter: { fontSize: 14, fontWeight: '700', color: '#0055A8', marginLeft: 4, opacity: 0.7 },
});
