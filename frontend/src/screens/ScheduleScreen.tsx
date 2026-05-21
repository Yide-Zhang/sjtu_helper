import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, PanResponder, Dimensions, LayoutAnimation, UIManager, Platform, Animated, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchWeeklyScheduleJSON, fetchCourseHTML } from '../api/jaccount';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJAccountUsername, getScheduleUpdateInterval } from '../utils/storage';

const SCHEDULE_CACHE_PREFIX = 'SCHEDULE_CACHE_';
const CALENDAR_CACHE_KEY = 'CALENDAR_CACHE'; // 校历数据，单独存储

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 教学节次时间表（来自 timetable.txt）
const TIMETABLE = [
  { session: 1, start: '0800', end: '0845' },
  { session: 2, start: '0855', end: '0940' },
  { session: 3, start: '1000', end: '1045' },
  { session: 4, start: '1055', end: '1140' },
  { session: 5, start: '1200', end: '1245' },
  { session: 6, start: '1255', end: '1340' },
  { session: 7, start: '1400', end: '1445' },
  { session: 8, start: '1455', end: '1540' },
  { session: 9, start: '1600', end: '1645' },
  { session: 10, start: '1655', end: '1740' },
  { session: 11, start: '1800', end: '1845' },
  { session: 12, start: '1855', end: '1940' },
  { session: 13, start: '1945', end: '2020' },
];

// 格式化节次时间为 HH:MM 字符串
const formatSlotTime = (time: string) => `${time.substring(0, 2)}:${time.substring(2, 4)}`;

// 计算当前时间处于第几节课（0 表示非上课时间）
const getCurrentSession = () => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (const slot of TIMETABLE) {
    const startM = parseInt(slot.start.substring(0, 2)) * 60 + parseInt(slot.start.substring(2, 4));
    const endM = parseInt(slot.end.substring(0, 2)) * 60 + parseInt(slot.end.substring(2, 4));
    if (currentMinutes >= startM && currentMinutes < endM) return slot.session;
  }
  return 0;
};

// ── 课表缓存 ──
// 缓存键 = 前缀 + jAccount 用户名 hash + xnm + xqm
// 这样换账号时自动失效
const cacheKey = (user: string, xnm: string, xqm: string) =>
  `${SCHEDULE_CACHE_PREFIX}${user}_${xnm}_${xqm}`;

interface ScheduleCache {
  kbList: any[];
  rqazcList: any[];
  semesterStartDate: string; // ISO string
  timestamp: number;
}

const loadScheduleCache = async (user: string, xnm: string, xqm: string): Promise<ScheduleCache | null> => {
  try {
    const json = await AsyncStorage.getItem(cacheKey(user, xnm, xqm));
    if (!json) return null;
    return JSON.parse(json);
  } catch { return null; }
};

const saveScheduleCache = async (user: string, xnm: string, xqm: string, data: ScheduleCache) => {
  try {
    await AsyncStorage.setItem(cacheKey(user, xnm, xqm), JSON.stringify(data));
  } catch (e) {
    console.warn('[ScheduleCache] save failed', e);
  }
};

// 单独存储校历（学期起始日、校历列表），供其它功能使用
const saveCalendarCache = async (data: { xnm: string; xqm: string; semesterStartDate: string; rqazcList: any[]; timestamp: number }) => {
  try {
    await AsyncStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[CalendarCache] save failed', e);
  }
};

// ── 批量获取所有学期校历（仅当缓存过旧或不存在时）──
const BATCH_FETCH_KEY = 'CALENDAR_BATCH_FETCH_TIME';
const batchFetchAllSemesters = async () => {
  try {
    // 判断是否需要重新获取：上次获取时间在"上一个8月1日 - 365天"之前
    const lastBatchStr = await AsyncStorage.getItem(BATCH_FETCH_KEY);
    const lastBatchTime = lastBatchStr ? parseInt(lastBatchStr, 10) : 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    // 上一个8月1日（如果当前月份<8，则是去年8月1日）
    const lastAug1 = currentMonth < 8
      ? new Date(currentYear - 1, 7, 1) // 0-indexed, 7=August
      : new Date(currentYear, 7, 1);
    const threshold = lastAug1.getTime() - 365 * 24 * 60 * 60 * 1000;

    if (lastBatchTime > threshold) {
      console.log('[CalendarBatch] 校历缓存较新，跳过批量获取');
      return;
    }

    console.log('[CalendarBatch] 校历缓存过旧或不存在，开始批量获取所有学期');

    const jUser = await getJAccountUsername();
    const cacheUser = jUser || '__no_user__';

    // 生成所有可能的学年学期
    const baseYear = now.getFullYear();
    const years: string[] = [];
    for (let y = baseYear + 1; y >= baseYear - 4; y--) years.push(String(y));
    const xqms = ['3', '12', '16'];
    const allSemesters: { xnm: string; xqm: string }[] = [];
    for (const y of years) {
      for (const q of xqms) allSemesters.push({ xnm: y, xqm: q });
    }

    let fetchedCount = 0;
    for (const s of allSemesters) {
      const key = `${SCHEDULE_CACHE_PREFIX}${cacheUser}_${s.xnm}_${s.xqm}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) continue;

      try {
        const w1DataStr = await fetchWeeklyScheduleJSON(s.xnm, s.xqm, 1);
        const w1Data = JSON.parse(w1DataStr);
        let startDate: Date | null = null;
        let rqazcList: any[] = [];
        if (w1Data.rqazcList && w1Data.rqazcList.length > 0) {
          rqazcList = w1Data.rqazcList;
          const day1 = w1Data.rqazcList.find((d: any) => d.xqj == 1);
          if (day1 && day1.rq) startDate = new Date(day1.rq);
        }
        if (!startDate) continue;

        await AsyncStorage.setItem(key, JSON.stringify({
          kbList: [],
          rqazcList,
          semesterStartDate: startDate.toISOString(),
          timestamp: Date.now(),
        }));
        fetchedCount++;
      } catch {
        // 单个学期失败不阻塞其它
      }
    }

    // 记录本次批量获取时间
    await AsyncStorage.setItem(BATCH_FETCH_KEY, String(Date.now()));
    console.log(`[CalendarBatch] 批量获取完成，新获取 ${fetchedCount} 个学期`);
  } catch (e) {
    console.warn('[CalendarBatch] 批量获取失败', e);
  }
};

export const ScheduleScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [fullSchedule, setFullSchedule] = useState<any[]>([]);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [calendarWeek, setCalendarWeek] = useState<number>(1);
  const [semesterStartDate, setSemesterStartDate] = useState<Date | null>(null);
  const [vacationName, setVacationName] = useState<string>('');

  const getCurrentRealSemester = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    if (month >= 2 && month <= 6) return { xnm: String(year - 1), xqm: '12' }; // 春
    if (month >= 7 && month <= 8) return { xnm: String(year - 1), xqm: '16' }; // 夏
    if (month >= 9 && month <= 12) return { xnm: String(year), xqm: '3' };    // 秋
    return { xnm: String(year - 1), xqm: '3' }; // 1月依然是秋季
  };

  const currentReal = getCurrentRealSemester();
  const [xnm, setXnm] = useState(currentReal.xnm);
  const [xqm, setXqm] = useState(currentReal.xqm); // 3: 秋季, 12: 春季, 16: 夏季
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  
  // 模态框临时状态
  const [tempXnm, setTempXnm] = useState(xnm);
  const [tempXqm, setTempXqm] = useState(xqm);

  useEffect(() => {
    if (showSemesterModal) {
      setTempXnm(xnm);
      setTempXqm(xqm);
    }
  }, [showSemesterModal, xnm, xqm]);

  const semesterName = `${xnm}-${Number(xnm) + 1}学年 ${xqm === '3' ? '秋季' : xqm === '12' ? '春季' : '夏季'}`;

  const generateYears = () => {
    const options = [];
    const baseYear = new Date().getFullYear();
    for (let y = baseYear + 1; y >= baseYear - 4; y--) {
      options.push(String(y));
    }
    return options;
  };

  // Local ZCD parser to check if a class falls in a specific week
  const isWeekInZcd = (week: number, zcd: string) => {
    if (!zcd) return false;
    let valid = false;
    const segments = zcd.replace(/周/g, '').split(',');
    for (const seg of segments) {
      let type = 'all';
      let rangeTag = seg;
      if (seg.includes('(单)')) { type = 'odd'; rangeTag = seg.replace('(单)', ''); }
      if (seg.includes('(双)')) { type = 'even'; rangeTag = seg.replace('(双)', ''); }
      
      if (rangeTag.includes('-')) {
        const [s, e] = rangeTag.split('-').map(Number);
        if (week >= s && week <= e) {
          if (type === 'all' || (type === 'odd' && week % 2 === 1) || (type === 'even' && week % 2 === 0)) valid = true;
        }
      } else {
        if (Number(rangeTag) === week) valid = true;
      }
    }
    return valid;
  };

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);

        // ── 读取用户设置的更新间隔 ──
        const updateIntervalDays = await getScheduleUpdateInterval(); // 1, 3, 7
        const maxAgeMs = updateIntervalDays * 24 * 60 * 60 * 1000;

        // ── 尝试从缓存读取 ──
        const jUser = await getJAccountUsername();
        const cacheUser = jUser || '__no_user__';
        const cached = await loadScheduleCache(cacheUser, xnm, xqm);
        const now = Date.now();

        // 缓存命中且未过期 → 直接使用
        if (cached && (now - cached.timestamp) < maxAgeMs) {
          // 缓存命中，直接恢复状态
          setFullSchedule(cached.kbList || []);
          if (cached.semesterStartDate) {
            const startDate = new Date(cached.semesterStartDate);
            setSemesterStartDate(startDate);

            // 计算周次
            const diffDays = Math.floor((now - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const calcWeek = Math.floor(diffDays / 7) + 1;
            const maxWeek = xqm === '16' ? 4 : 18;
            let vName = '';

            let targetWeek = 1;
            if (calcWeek < 1) {
              targetWeek = 1;
              setCalendarWeek(-1);
              vName = xqm === '12' ? '寒假' : '暑假';
            } else if (calcWeek > maxWeek) {
              targetWeek = maxWeek;
              setCalendarWeek(-1);
              vName = xqm === '3' ? '寒假' : '暑假';
            } else {
              targetWeek = calcWeek;
              setCalendarWeek(targetWeek);
            }
            setVacationName(vName);
            setCurrentWeek(targetWeek);
          }
          // 同步保存/更新校历缓存（可能之前从未存过）
          if (cached.semesterStartDate) {
            saveCalendarCache({
              xnm,
              xqm,
              semesterStartDate: cached.semesterStartDate,
              rqazcList: cached.rqazcList || [],
              timestamp: Date.now(),
            });
          }
          console.log('[Schedule] 使用缓存课表（未过期）');
          setLoading(false);
          return;
        }

        if (cached) {
          console.log(`[Schedule] 缓存已过期（超过 ${updateIntervalDays} 天），重新拉取`);
        }

        // ── 无缓存，从网络拉取 ──
        const w1DataStr = await fetchWeeklyScheduleJSON(xnm, xqm, 1);
        const w1Data = JSON.parse(w1DataStr);
        let startDate: Date | null = null;
        let cachedRqazcList: any[] = [];
        
        if (w1Data.rqazcList && w1Data.rqazcList.length > 0) {
          cachedRqazcList = w1Data.rqazcList;
          const day1 = w1Data.rqazcList.find((d: any) => d.xqj == 1);
          if (day1 && day1.rq) {
            startDate = new Date(day1.rq);
            setSemesterStartDate(startDate);
          }
        }

        // Calculate absolute calendar week mapped to real time
        let targetWeek = 1;
        if (startDate) {
          const now = new Date();
          const diffTime = now.getTime() - startDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
          const calcWeek = Math.floor(diffDays / 7) + 1;
          const maxWeek = xqm === '16' ? 4 : 18;
          let vName = '';

          if (calcWeek < 1) {
            targetWeek = 1;
            setCalendarWeek(-1);
            if (xqm === '12') vName = '寒假';
            else vName = '暑假';
          } else if (calcWeek > maxWeek) {
            targetWeek = maxWeek;
            setCalendarWeek(-1);
            if (xqm === '3') vName = '寒假';
            else vName = '暑假';
          } else {
            targetWeek = calcWeek;
            setCalendarWeek(targetWeek);
          }
          setVacationName(vName);
          setCurrentWeek(targetWeek);
        }

        // Fetch full semester schedule at once for ultra-fast local switching
        const fullDataStr = await fetchCourseHTML(xnm, xqm); 
        const fullData = JSON.parse(fullDataStr);
        const kbList = fullData.kbList || [];
        setFullSchedule(kbList);

        // ── 写入缓存 ──
        if (jUser) {
          await saveScheduleCache(cacheUser, xnm, xqm, {
            kbList,
            rqazcList: cachedRqazcList,
            semesterStartDate: startDate ? startDate.toISOString() : '',
            timestamp: Date.now(),
          });
        }

        // ── 单独存储校历数据 ──
        if (startDate) {
          await saveCalendarCache({
            xnm,
            xqm,
            semesterStartDate: startDate.toISOString(),
            rqazcList: cachedRqazcList,
            timestamp: Date.now(),
          });
        }

      } catch (e: any) {
        if (e.message && e.message.includes('登录失效')) {
          Alert.alert('提示', '教务系统登录已失效，请去设置页重新登录');
        } else {
         console.warn("Init week failed", e);
        }
      } finally {
        setLoading(false);
      }
    };
    initData();
    // 批量获取所有学期校历（后台静默执行）
    batchFetchAllSemesters();
  }, [xnm, xqm]);

  // Keep a ref of currentWeek to avoid stale closure in PanResponder
  const currentWeekRef = useRef(currentWeek);
  useEffect(() => {
    currentWeekRef.current = currentWeek;
  }, [currentWeek]);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const changeWeek = (delta: number) => {
    const minWeek = 1;
    const maxWeek = xqm === '16' ? 4 : 18;
    const targetWeek = currentWeekRef.current + delta;
    
    if (targetWeek < minWeek || targetWeek > maxWeek) return;

    // A subtle nudge animation instead of full screen slide to prevent white/gray flashes
    Animated.timing(slideAnim, {
      toValue: delta > 0 ? -30 : 30, // move opposite slightly
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setCurrentWeek(targetWeek);
      // instantly position the other side
      slideAnim.setValue(delta > 0 ? 30 : -30);
      
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  const getWeekDateDisplay = (dayIndex: number) => {
    if (!semesterStartDate) return '';
    const date = new Date(semesterStartDate);
    date.setDate(date.getDate() + (currentWeek - 1) * 7 + (dayIndex - 1));
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const panResponder = useRef(
    PanResponder.create({
      // Intercept the gesture before ScrollView can grab it
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 30) changeWeek(-1); // swipe right
        else if (gestureState.dx < -30) changeWeek(1); // swipe left
      }
    })
  ).current;

  // Local filter
  const scheduleData = fullSchedule.filter(c => isWeekInZcd(currentWeek, c.zcd));

  const renderGrid = () => {
    const days = [1, 2, 3, 4, 5, 6, 7];
    const sessions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    // Determine today for highlighting
    const today = new Date();
    const todayDay = today.getDay() === 0 ? 7 : today.getDay();
    const isCurrentCalendarWeek = calendarWeek === currentWeek;
    // 当前所处的节次（仅当在本周时有效）
    const currentSession = isCurrentCalendarWeek ? getCurrentSession() : 0;

    return (
      <View style={styles.gridContainer} {...panResponder.panHandlers}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
          {/* Header Row */}
          <View style={[styles.headerRow, { backgroundColor: themeBgColor }]}>
            <View style={[styles.timeColumnHeader, { backgroundColor: themeBgColor }]} />
            {days.map(day => {
               const isHighlight = isCurrentCalendarWeek && day === todayDay;
             return (
              <View key={day} style={[styles.dayHeader, isHighlight && styles.dayHeaderHighlight]}>
                <Text style={[styles.dayText, isHighlight && styles.textHighlight]}>周{['一', '二', '三', '四', '五', '六', '日'][day - 1]}</Text>
                <Text style={[styles.dateText, isHighlight && styles.textHighlight]}>{getWeekDateDisplay(day)}</Text>
              </View>
            );
          })}
        </View>

        <ScrollView style={styles.gridScroll}>
          {sessions.map((session) => {
            const timeLabel = `${session}`;
            // 当前时间所在行高亮
            const isTimeHighlight = currentSession === session;

            return (
            <View key={session} style={[styles.gridRow, isTimeHighlight && styles.gridRowHighlight]}>
            <View style={[styles.timeColumn, isTimeHighlight && styles.timeColumnHighlight, !isTimeHighlight && { backgroundColor: themeBgColor }]}>
                <Text style={[styles.timeText, isTimeHighlight && styles.timeTextHighlight]}>
                  {timeLabel}
                </Text>
              </View>
              {days.map(day => {
                const isDayHighlight = isCurrentCalendarWeek && day === todayDay;
                const startingClasses = scheduleData.filter(c => {
                  if (parseInt(c.xqj, 10) !== day) return false;
                  const parts = c.jcs.split('-');
                  const startSession = parseInt(parts[0], 10);
                  return startSession === session;
                });

                // 没有课程且是当前时间行 → 显示 "现在" 标记
                const showNowTag = isTimeHighlight && isDayHighlight && startingClasses.length === 0;

                return (
                 <View key={`${day}-${session}`} style={[
                   styles.cell,
                   isDayHighlight && styles.cellHighlight,
                   isTimeHighlight && isDayHighlight && styles.cellNow
                 ]}>
                   {startingClasses.map((c, i) => {
                     const parts = c.jcs.split('-');
                     const startSession = parseInt(parts[0], 10);
                     const endSession = parts.length > 1 ? parseInt(parts[1].replace('节',''), 10) : startSession;
                     const sessionCount = endSession - startSession + 1;
                     
                     return (
                        <View 
                          key={i} 
                          style={[
                            styles.classCard, 
                            { 
                              backgroundColor: getColorForCourse(c.kcmc),
                              height: sessionCount * 50 - 4,
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              right: 2,
                              zIndex: 10
                            }
                          ]}
                        >
                          <Text style={styles.classTitle} numberOfLines={3}>{c.kcmc}</Text>
                          <Text style={styles.classRoom}>{c.cdmc}</Text>
                          <Text style={styles.classTeacher}>{c.xm}</Text>
                        </View>
                        );
                      })}
                      {showNowTag && (
                        <View style={styles.nowBadge}>
                          <Text style={styles.nowBadgeText}>现在</Text>
                        </View>
                      )}
                  </View>
                );
              })}
            </View>
          );})}
          <View style={{height: 50}} />
        </ScrollView>
        </Animated.View>
      </View>
    );
  };

  // Simple color generator based on course name
  const getColorForCourse = (name: string) => {
    const colors = ['#E3F2FD', '#E8F5E9', '#F3E5F5', '#FFF3E0', '#FFEBEE', '#FCE4EC', '#E0F7FA'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getThemeBgColor = () => {
    if (xqm === '3') return '#FFFBF2'; // 秋季: 极淡橙色
    if (xqm === '12') return '#F4FAF4'; // 春季: 极淡草绿
    if (xqm === '16') return '#F0F9FF'; // 夏季: 极淡海蓝
    return '#F5F5F5';
  };
  const themeBgColor = getThemeBgColor();
  const isSelectedSemesterCurrent = xnm === currentReal.xnm && xqm === currentReal.xqm;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: themeBgColor }]}>
      <View style={[styles.header, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-left" size={28} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => setShowSemesterModal(true)}>
          <Text style={styles.headerTitle}>课表 <Icon name="chevron-down" size={16} color="#333" /></Text>
          <Text style={styles.headerSubtitle}>{semesterName}</Text>
        </TouchableOpacity>
        <View style={styles.placeholder} />
      </View>

      <View style={[styles.weekSelector, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity onPress={() => changeWeek(-1)} disabled={currentWeek <= 1}>
          <Icon name="chevron-left" size={24} color={currentWeek <= 1 ? '#ccc' : '#0055A8'} />
        </TouchableOpacity>
        <View style={styles.weekTextContainer}>
          <Text style={styles.weekText}>第 {currentWeek} 周{isSelectedSemesterCurrent && calendarWeek === -1 ? ` (${vacationName || '假期'})` : (currentWeek === calendarWeek ? ' (本周)' : '')}</Text>
        </View>
        <TouchableOpacity onPress={() => changeWeek(1)} disabled={currentWeek >= (xqm === '16' ? 4 : 18)}>
          <Icon name="chevron-right" size={24} color={currentWeek >= (xqm === '16' ? 4 : 18) ? '#ccc' : '#0055A8'} />
        </TouchableOpacity>
        
        {/* Back to current week button */}
        {calendarWeek !== -1 && currentWeek !== calendarWeek && (
          <TouchableOpacity style={styles.backToWeekBtn} onPress={() => setCurrentWeek(calendarWeek)}>
            <Text style={styles.backToWeekText}>回到本周</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && fullSchedule.length === 0 ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0055A8" />
      ) : (
        renderGrid()
      )}

      {/* Semester Selection Modal */}
      <Modal visible={showSemesterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择学年与学期</Text>
              <TouchableOpacity onPress={() => setShowSemesterModal(false)}>
                <Icon name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', height: 250 }}>
              {/* 学年列表 */}
              <ScrollView style={{ flex: 1, borderRightWidth: 1, borderColor: '#eee' }}>
                {generateYears().map(y => (
                  <TouchableOpacity 
                    key={y}
                    style={[styles.modalOption, tempXnm === y && styles.modalOptionActive]}
                    onPress={() => setTempXnm(y)}
                  >
                    <Text style={[styles.modalOptionText, tempXnm === y && styles.modalOptionTextActive]}>
                      {y}-{Number(y)+1} 学年
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* 学期列表 */}
              <ScrollView style={{ flex: 1 }}>
                {[
                  {val: '3', label: '秋季'}, 
                  {val: '12', label: '春季'}, 
                  {val: '16', label: '夏季'}
                ].map(t => (
                  <TouchableOpacity 
                    key={t.val}
                    style={[styles.modalOption, tempXqm === t.val && styles.modalOptionActive]}
                    onPress={() => setTempXqm(t.val)}
                  >
                    <Text style={[styles.modalOptionText, tempXqm === t.val && styles.modalOptionTextActive]}>
                      {t.label}学期
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <View style={{ flexDirection: 'row', padding: 16, justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#eee' }}>
              <TouchableOpacity 
                style={{ padding: 12, justifyContent: 'center' }}
                onPress={() => {
                  setXnm(currentReal.xnm);
                  setXqm(currentReal.xqm);
                  setShowSemesterModal(false);
                }}
              >
                <Text style={{ color: '#0055A8', fontWeight: 'bold' }}>回到本学期</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ paddingVertical: 12, paddingHorizontal: 32, backgroundColor: '#0055A8', borderRadius: 8 }}
                onPress={() => {
                  setXnm(tempXnm);
                  setXqm(tempXqm);
                  setShowSemesterModal(false);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  placeholder: {
    width: 36,
  },
  weekSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  weekTextContainer: {
    width: 150,
    alignItems: 'center',
  },
  weekText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  backToWeekBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  backToWeekText: {
    color: '#0055A8',
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#FAFAFA',
  },
  timeColumnHeader: {
    width: 36,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderHighlight: {
    backgroundColor: 'rgba(0, 85, 168, 0.08)',
    borderRadius: 4,
  },
  dayText: {
    fontSize: 12,
    color: '#666',
  },
  dateText: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  textHighlight: {
    color: '#0055A8',
    fontWeight: 'bold',
  },
  gridScroll: {
    flex: 1,
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
    height: 50,
  },
  gridRowHighlight: {
    backgroundColor: 'rgba(255, 152, 0, 0.06)',
    borderBottomColor: 'rgba(255, 152, 0, 0.2)',
  },
  timeColumn: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRightWidth: 1,
    borderRightColor: '#efefef',
  },
  timeColumnHighlight: {
    backgroundColor: 'rgba(255, 152, 0, 0.12)',
    borderRightColor: 'rgba(255, 152, 0, 0.25)',
  },
  timeText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  timeTextHighlight: {
    color: '#E65100',
    fontWeight: '700',
    fontSize: 12,
  },
  cell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#efefef',
  },
  cellHighlight: {
    backgroundColor: 'rgba(0, 85, 168, 0.05)',
  },
  cellNow: {
    backgroundColor: 'rgba(255, 152, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nowBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  classCard: {
    padding: 4,
    borderRadius: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  classTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    lineHeight: 12,
  },
  classRoom: {
    fontSize: 9,
    color: '#555',
    marginTop: 4,
  },
  classTeacher: {
    fontSize: 9,
    color: '#555',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    marginBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    paddingBottom: 20,
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalOptionActive: {
    backgroundColor: '#E8F4FF',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  modalOptionTextActive: {
    color: '#0055A8',
    fontWeight: 'bold',
  },
});