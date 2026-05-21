import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CanvasAssignment } from '../api/canvas';
import { CustomTodo } from '../utils/todoStorage';
import { getJAccountUsername } from '../utils/storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface Props {
  assignments: CanvasAssignment[];
  todos: CustomTodo[];
  exams?: any[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  onAddTodoForDate?: (date: Date) => void;
}

const WEEK_HEADER = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const TOTAL_CELLS = 42; // 6 rows × 7 days
const ROWS = 6;
const COLS = 7;

// 汉字数字（1~18）
const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八'];

// 学期主题色 → 周号文字颜色
const WEEK_COLORS: Record<string, string> = {
  '3': '#B8860B',  // 秋季：深金
  '12': '#2E7D32', // 春季：深绿
  '16': '#01579B', // 夏季：深蓝
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// 周一为首日：返回 0=周一, 1=周二, … 6=周日
const getMonDay = (year: number, month: number, day: number) => {
  const d = new Date(year, month, day).getDay();
  return d === 0 ? 6 : d - 1;
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const isToday = (date: Date) => isSameDay(date, new Date());

const isPastDay = (date: Date) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date.getTime() < now.getTime();
};

const DOT_COLORS: Record<string, string> = {
  '1': '#F0C000',
  '2': '#FF8C00',
  '3': '#E53935',
  '4': '#FF4500',
};
const DOT_COLOR_PAST = '#CCC';
const DOT_COLOR_EXAM = '#222';

const hasExamOnDate = (exams: any[] | undefined, year: number, month: number, day: number): boolean => {
  if (!exams) return false;
  return exams.some(e => {
    if (!e.kssj) return false;
    const ds = e.kssj.substring(0, 10);
    if (!ds) return false;
    const d = new Date(ds);
    return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
};

const countIncompleteForDate = (todos: CustomTodo[], assignments: CanvasAssignment[], year: number, month: number, day: number): number => {
  const todoCount = todos.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  }).length;

  const assignmentCount = assignments.filter(a => {
    if (!a.display_date || a.has_submitted_submissions) return false;
    const d = new Date(a.display_date);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return false;
    const isAnnouncement = a.submission_types && (a.submission_types.includes('none') || a.submission_types.includes('not_graded'));
    if (isAnnouncement) return false;
    return d.getTime() >= Date.now();
  }).length;

  return todoCount + assignmentCount;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CALENDAR_CONTENT_WIDTH = SCREEN_WIDTH - 24 - 20;
const LABEL_WIDTH = 20;
const CELL_SIZE = (CALENDAR_CONTENT_WIDTH - LABEL_WIDTH) * 0.1428 / 1.1;
const GRID_MIN_HEIGHT = CELL_SIZE * 6;

type DayCell = { day: number; month: number; year: number; isCurrent: boolean };

const buildDayCells = (year: number, month: number): DayCell[] => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getMonDay(year, month, 1); // 周一=0
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells: DayCell[] = [];

  // 周一为首日，leadCount=firstDay（周一=0，周二=1...）
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrent: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrent: true });
  }

  // Trailing cells from next month
  const remaining = TOTAL_CELLS - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: nextMonth, year: nextYear, isCurrent: false });
  }

  return cells;
};

// 42 cells → 6 rows × 7 cols
const groupRows = (cells: DayCell[]): DayCell[][] => {
  const rows: DayCell[][] = [];
  for (let r = 0; r < ROWS; r++) rows.push(cells.slice(r * COLS, (r + 1) * COLS));
  return rows;
};

// 校历信息：起止日期由缓存中的起始日 + 最大周数算出
interface SemesterInfo {
  xnm: string;
  xqm: string;
  startDate: Date;
  endDate: Date;
}

export const MonthCalendar: React.FC<Props> = ({ assignments, todos, exams, selectedDate, onSelectDate, onAddTodoForDate }) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  // 所有学期校历索引
  const [semesters, setSemesters] = useState<SemesterInfo[]>([]);

  // 首次加载时扫描所有 SCHEDULE_CACHE_* 建立索引
  useEffect(() => {
    (async () => {
      try {
        const jUser = await getJAccountUsername();
        const cacheUser = jUser || '__no_user__';
        const allKeys = await AsyncStorage.getAllKeys();
        const scheduleKeys = allKeys.filter((k: string) => k.startsWith('SCHEDULE_CACHE_'));
        const list: SemesterInfo[] = [];

        for (const key of scheduleKeys) {
          const suffix = key.substring('SCHEDULE_CACHE_'.length);
          const parts = suffix.split('_');
          if (parts.length < 3) continue;
          const xqm2 = parts.pop()!;
          const xnm2 = parts.pop()!;
          const userFromKey = parts.join('_');
          if (userFromKey !== cacheUser) continue;

          const json = await AsyncStorage.getItem(key);
          if (!json) continue;
          const d = JSON.parse(json);
          if (!d.semesterStartDate) continue;
          const startDate = new Date(d.semesterStartDate);
          const maxWeek = xqm2 === '16' ? 4 : 18;
          const endDate = new Date(startDate.getTime() + maxWeek * 7 * 24 * 60 * 60 * 1000);
          list.push({ xnm: xnm2, xqm: xqm2, startDate, endDate });
        }

        setSemesters(list);
      } catch {}
    })();
  }, []);

  const days = buildDayCells(viewYear, viewMonth);
  const rows = useMemo(() => groupRows(days), [days]);

  // 取一行中间那天（周四）找所属学期，同时返回周次和颜色
  const getRowInfo = (rowIndex: number): { wn: number | null; color: string } => {
    const midCell = rows[rowIndex]?.[3];
    if (!midCell) return { wn: null, color: '#666' };
    const d = new Date(midCell.year, midCell.month, midCell.day);
    const sem = semesters.find(s => d >= s.startDate && d < s.endDate);
    if (!sem) return { wn: null, color: '#666' };
    const diffDays = Math.floor((d.getTime() - sem.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const wn = Math.floor(diffDays / 7) + 1;
    const maxWeek = sem.xqm === '16' ? 4 : 18;
    return {
      wn: (wn >= 1 && wn <= maxWeek) ? wn : null,
      color: WEEK_COLORS[sem.xqm] || '#666',
    };
  };

  const swipeGesture = useRef({
    startX: 0,
    threshold: 50,
  }).current;

  // 用 ref 保存当前值，PanResponder 始终读取最新值
  const yearRef = useRef(viewYear);
  const monthRef = useRef(viewMonth);
  yearRef.current = viewYear;
  monthRef.current = viewMonth;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
    onPanResponderRelease: (_, gs) => {
      const y = yearRef.current;
      const m = monthRef.current;
      if (gs.dx > swipeGesture.threshold) {
        if (m === 0) {
          animateTo('prev', y - 1, 11);
        } else {
          animateTo('prev', y, m - 1);
        }
      } else if (gs.dx < -swipeGesture.threshold) {
        if (m === 11) {
          animateTo('next', y + 1, 0);
        } else {
          animateTo('next', y, m + 1);
        }
      }
    },
  })).current;

  const animateTo = (direction: 'prev' | 'next', newYear: number, newMonth: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    const toValue = direction === 'next' ? -SCREEN_WIDTH * 0.8 : SCREEN_WIDTH * 0.8;
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setViewYear(newYear);
      setViewMonth(newMonth);
      slideAnim.setValue(direction === 'next' ? SCREEN_WIDTH * 0.8 : -SCREEN_WIDTH * 0.8);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsAnimating(false));
    });
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      animateTo('prev', viewYear - 1, 11);
    } else {
      animateTo('prev', viewYear, viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      animateTo('next', viewYear + 1, 0);
    } else {
      animateTo('next', viewYear, viewMonth + 1);
    }
  };

  const goToday = () => {
    if (isAnimating) return;
    const diffMonths = (today.getFullYear() - viewYear) * 12 + (today.getMonth() - viewMonth);
    if (diffMonths > 0) {
      slideAnim.setValue(-SCREEN_WIDTH * 0.8);
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    } else if (diffMonths < 0) {
      slideAnim.setValue(SCREEN_WIDTH * 0.8);
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onSelectDate(today);
  };

  const handleCellPress = (cell: DayCell) => {
    const date = new Date(cell.year, cell.month, cell.day);
    if (!cell.isCurrent) {
      // Switch to the tapped month and select the date
      setViewYear(cell.year);
      setViewMonth(cell.month);
    }
    if (selectedDate && isSameDay(date, selectedDate)) {
      onSelectDate(null);
    } else {
      onSelectDate(date);
    }
  };

  const getDotColor = (cell: DayCell): string | null => {
    if (!cell.isCurrent) return null; // No dots for non-current month

    const date = new Date(cell.year, cell.month, cell.day);
    const incompleteCount = countIncompleteForDate(todos, assignments, cell.year, cell.month, cell.day);

    if (isPastDay(date)) {
      const hasAnyItem = incompleteCount > 0
        || todos.some(t => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d.getFullYear() === cell.year && d.getMonth() === cell.month && d.getDate() === cell.day;
        })
        || assignments.some(a => {
          if (!a.display_date) return false;
          const d = new Date(a.display_date);
          return d.getFullYear() === cell.year && d.getMonth() === cell.month && d.getDate() === cell.day;
        });
      return hasAnyItem ? DOT_COLOR_PAST : null;
    }

    if (isToday(date)) {
      const hasAnyItem = incompleteCount > 0
        || todos.some(t => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d.getFullYear() === cell.year && d.getMonth() === cell.month && d.getDate() === cell.day;
        })
        || assignments.some(a => {
          if (!a.display_date) return false;
          const d = new Date(a.display_date);
          return d.getFullYear() === cell.year && d.getMonth() === cell.month && d.getDate() === cell.day;
        });
      if (hasAnyItem && incompleteCount === 0) return '#34A853';
    }

    if (incompleteCount > 0) {
      if (incompleteCount >= 4) return DOT_COLORS['4'];
      return DOT_COLORS[String(incompleteCount)] || DOT_COLORS['1'];
    }

    return null;
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Month navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.6}>
          <MaterialIcons name="chevron-left" size={22} color="#0055A8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} activeOpacity={0.6}>
          <Text style={styles.monthTitle}>
            {viewYear}年 {MONTH_NAMES[viewMonth]}
          </Text>
        </TouchableOpacity>
        <View style={styles.navRight}>
          {!(viewYear === today.getFullYear() && viewMonth === today.getMonth()) && (
            <TouchableOpacity onPress={goToday} style={styles.todayBtn} activeOpacity={0.6}>
              <Text style={styles.todayBtnText}>今天</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.6}>
            <MaterialIcons name="chevron-right" size={22} color="#0055A8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week header + label spacer */}
      <View style={styles.weekRow}>
        <View style={styles.weekLabelCol} />
        {WEEK_HEADER.map((w, i) => (
          <View key={i} style={styles.weekCell}>
            <Text style={[styles.weekText, (i === 5 || i === 6) ? styles.weekendText : null]}>{w}</Text>
          </View>
        ))}
      </View>

      {/* Days grid - six rows with week labels */}
      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        {rows.map((row, ri) => {
          const { wn, color: rowColor } = getRowInfo(ri);
          const cn = wn !== null && wn >= 1 && wn <= 18 ? CN_NUM[wn] : null;

          return (
            <View key={`row-${ri}`} style={styles.calRow}>
              {/* Week number label */}
              <View style={styles.weekLabelCol}>
                {cn && (
                  cn.length > 1 ? (
                    <View style={styles.cnCol}>
                      <Text style={[styles.cnTextTop, { color: rowColor }]}>{cn[0]}</Text>
                      <Text style={[styles.cnTextBottom, { color: rowColor }]}>{cn[1]}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.cnText, { color: rowColor }]}>{cn}</Text>
                  )
                )}
              </View>

              {/* 7 day cells */}
              {row.map((cell, ci) => {
                const date = new Date(cell.year, cell.month, cell.day);
                const isSelectedDay = selectedDate && isSameDay(date, selectedDate);
                const isTodayDay = isToday(date);
                const dotColor = getDotColor(cell);
                const hasExam = hasExamOnDate(exams, cell.year, cell.month, cell.day);

                return (
                  <TouchableOpacity
                    key={`day-${ri}-${ci}`}
                    style={[
                      styles.dayCell,
                      isSelectedDay && styles.dayCellSelected,
                    ]}
                    onPress={() => handleCellPress(cell)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayText,
                      !cell.isCurrent && styles.dayTextOtherMonth,
                      isTodayDay && styles.dayTextToday,
                      isSelectedDay && styles.dayTextSelected,
                    ]}>
                      {cell.day}
                    </Text>
                    <View style={styles.dotRow}>
                      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
                      {hasExam && <View style={[styles.dot, { backgroundColor: DOT_COLOR_EXAM }]} />}
                      {!dotColor && !hasExam && cell.isCurrent && <View style={styles.dotSpacer} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  navBtn: {
    padding: 8,
  },
  navBtnText: {
    fontSize: 16,
    color: '#0055A8',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8F4FF',
    borderRadius: 12,
    marginRight: 4,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0055A8',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  weekendText: {
    color: '#D10000',
  },
  weekLabelCol: {
    width: LABEL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calRow: {
    flexDirection: 'row',
    minHeight: CELL_SIZE,
  },
  dayCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    aspectRatio: 1.1,
  },
  dayCellSelected: {
    backgroundColor: '#0055A8',
  },
  dayText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dayTextOtherMonth: {
    color: '#CCC',
  },
  dayTextToday: {
    color: '#0055A8',
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1,
    marginTop: 2,
  },
  dotRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 8, marginTop: 1 },
  dotSpacer: {
    width: 6,
    height: 6,
    marginTop: 2,
  },
  cnCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cnText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  cnTextTop: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  cnTextBottom: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
});
