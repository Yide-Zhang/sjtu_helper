import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJAccountUsername } from '../utils/storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface Props {
  date: Date;
  onChange: (date: Date) => void;
}

const WEEK_HEADER = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const TOTAL_CELLS = 42;
const ROWS = 6;
const COLS = 7;
const LABEL_WIDTH = 18;

const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八'];
const WEEK_COLORS: Record<string, string> = {
  '3': '#B8860B',
  '12': '#2E7D32',
  '16': '#01579B',
};

const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// 周一为首日：0=周一…6=周日
const getMonDay = (y: number, m: number, d: number) => {
  const w = new Date(y, m, d).getDay();
  return w === 0 ? 6 : w - 1;
};

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

interface SemesterInfo {
  xnm: string;
  xqm: string;
  startDate: Date;
  endDate: Date;
}

type DayCell = { day: number; month: number; year: number; isCurrent: boolean };

const buildDayCells = (year: number, month: number): DayCell[] => {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getMonDay(year, month, 1);
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const cells: DayCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrent: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrent: true });
  }

  const remaining = TOTAL_CELLS - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, month: nextMonth, year: nextYear, isCurrent: false });
  }

  return cells;
};

const groupRows = (cells: DayCell[]): DayCell[][] => {
  const rows: DayCell[][] = [];
  for (let r = 0; r < ROWS; r++) rows.push(cells.slice(r * COLS, (r + 1) * COLS));
  return rows;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

export const DatePicker: React.FC<Props> = ({ date, onChange }) => {
  const today = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const touchStartX = useRef(0);
  const currentYear = useRef(year);
  const currentMonth = useRef(month);
  currentYear.current = year;
  currentMonth.current = month;

  const cells = buildDayCells(year, month);
  const rows = useMemo(() => groupRows(cells), [cells]);

  // 学期索引
  const [semesters, setSemesters] = useState<SemesterInfo[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const jUser = await getJAccountUsername();
        const cacheUser = jUser || '__no_user__';
        const allKeys = await AsyncStorage.getAllKeys();
        const list: SemesterInfo[] = [];
        for (const key of allKeys) {
          if (!key.startsWith('SCHEDULE_CACHE_')) continue;
          const suffix = key.substring('SCHEDULE_CACHE_'.length);
          const parts = suffix.split('_');
          if (parts.length < 3) continue;
          const xqm2 = parts.pop()!;
          const xnm2 = parts.pop()!;
          if (parts.join('_') !== cacheUser) continue;
          const json = await AsyncStorage.getItem(key);
          if (!json) continue;
          const d = JSON.parse(json);
          if (!d.semesterStartDate) continue;
          const start = new Date(d.semesterStartDate);
          const maxW = xqm2 === '16' ? 4 : 18;
          list.push({ xnm: xnm2, xqm: xqm2, startDate: start, endDate: new Date(start.getTime() + maxW * 7 * 86400000) });
        }
        setSemesters(list);
      } catch {}
    })();
  }, []);

  const getRowInfo = (rowIndex: number): { wn: number | null; color: string } => {
    const mid = rows[rowIndex]?.[3];
    if (!mid) return { wn: null, color: '#666' };
    const d = new Date(mid.year, mid.month, mid.day);
    const sem = semesters.find(s => d >= s.startDate && d < s.endDate);
    if (!sem) return { wn: null, color: '#666' };
    const diff = Math.floor((d.getTime() - sem.startDate.getTime()) / 86400000);
    const wn = Math.floor(diff / 7) + 1;
    const maxW = sem.xqm === '16' ? 4 : 18;
    return { wn: (wn >= 1 && wn <= maxW) ? wn : null, color: WEEK_COLORS[sem.xqm] || '#666' };
  };

  const goToday = useCallback(() => {
    onChange(new Date());
  }, []);

  const animateTo = useCallback((direction: 'prev' | 'next', newYear: number, newMonth: number) => {
    const toValue = direction === 'next' ? -SCREEN_WIDTH * 0.6 : SCREEN_WIDTH * 0.6;
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      const nd = new Date(date);
      nd.setFullYear(newYear);
      nd.setMonth(newMonth);
      onChange(nd);
      slideAnim.setValue(direction === 'next' ? SCREEN_WIDTH * 0.6 : -SCREEN_WIDTH * 0.6);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [date]);

  // Swipe gesture
  const handleTouchStart = useCallback((e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  }, []);
  const handleTouchEnd = useCallback((e: any) => {
    const dx = e.nativeEvent.pageX - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    const isNext = dx < 0;
    const y = currentYear.current;
    const m = currentMonth.current;
    if (isNext) {
      if (m === 11) { animateTo('next', y + 1, 0); }
      else { animateTo('next', y, m + 1); }
    } else {
      if (m === 0) { animateTo('prev', y - 1, 11); }
      else { animateTo('prev', y, m - 1); }
    }
  }, []);

  const handleCellPress = (cell: DayCell) => {
    const nd = new Date(cell.year, cell.month, cell.day);
    onChange(nd);
  };

  return (
    <View style={styles.container} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Year navigation */}
      <View style={styles.yearRow}>
        <TouchableOpacity onPress={() => animateTo('prev', year - 1, month)} style={styles.bigArrow} activeOpacity={0.6}>
          <MaterialIcons name="skip-previous" size={22} color="#0055A8" />
        </TouchableOpacity>
        <Text style={styles.yearText}>{year}年</Text>
        <TouchableOpacity onPress={() => animateTo('next', year + 1, month)} style={styles.bigArrow} activeOpacity={0.6}>
          <MaterialIcons name="skip-next" size={22} color="#0055A8" />
        </TouchableOpacity>
      </View>

      {/* Month navigation */}
      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={() => {
            if (month === 0) { animateTo('prev', year - 1, 11); }
            else { animateTo('prev', year, month - 1); }
          }}
          style={styles.smallArrow}
          activeOpacity={0.6}
        >
          <MaterialIcons name="chevron-left" size={22} color="#0055A8" />
        </TouchableOpacity>
        <Text style={styles.monthText}>{MONTH_NAMES[month]}</Text>
        <TouchableOpacity
          onPress={() => {
            if (month === 11) { animateTo('next', year + 1, 0); }
            else { animateTo('next', year, month + 1); }
          }}
          style={styles.smallArrow}
          activeOpacity={0.6}
        >
          <MaterialIcons name="chevron-right" size={22} color="#0055A8" />
        </TouchableOpacity>
      </View>

      {/* Week header + label spacer */}
      <View style={styles.weekRow}>
        <View style={styles.labelCol} />
        {WEEK_HEADER.map((w, i) => (
          <View key={i} style={styles.weekCell}>
            <Text style={[styles.weekText, (i === 5 || i === 6) && styles.weekendText]}>{w}</Text>
          </View>
        ))}
      </View>

      {/* Day grid with week labels */}
      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        {rows.map((row, ri) => {
          const { wn, color: rowColor } = getRowInfo(ri);
          const cn = wn !== null && wn >= 1 && wn <= 18 ? CN_NUM[wn] : null;

          return (
            <View key={`row-${ri}`} style={styles.calRow}>
              <View style={styles.labelCol}>
                {cn && (
                  cn.length > 1 ? (
                    <View style={styles.cnCol}>
                      <Text style={[styles.cnText, { color: rowColor }]}>{cn[0]}</Text>
                      <Text style={[styles.cnText, { color: rowColor }]}>{cn[1]}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.cnText, { color: rowColor }]}>{cn}</Text>
                  )
                )}
              </View>
              {row.map((cell, ci) => {
                const d = new Date(cell.year, cell.month, cell.day);
                const isSel = isSameDay(d, date);
                return (
                  <TouchableOpacity
                    key={`day-${ri}-${ci}`}
                    style={[styles.dayCell, isSel && styles.dayCellSel]}
                    onPress={() => handleCellPress(cell)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dayCellText,
                      !cell.isCurrent && styles.otherMonthText,
                      isSel && styles.dayCellTextSel,
                    ]}>
                      {cell.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </Animated.View>

      {/* Today button */}
      {!(year === today.getFullYear() && month === today.getMonth()) && (
        <TouchableOpacity onPress={goToday} style={styles.todayBtn} activeOpacity={0.6}>
          <Text style={styles.todayBtnText}>今天</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  yearRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  bigArrow: { paddingHorizontal: 12, paddingVertical: 4 },
  bigArrowText: { fontSize: 18 },
  yearText: { fontSize: 20, fontWeight: '800', color: '#333', marginHorizontal: 16, minWidth: 80, textAlign: 'center' },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  smallArrow: { padding: 6 },
  smallArrowText: { fontSize: 14, color: '#0055A8' },
  monthText: { fontSize: 17, fontWeight: '700', color: '#555', marginHorizontal: 20, minWidth: 60, textAlign: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  weekText: { fontSize: 12, color: '#666', fontWeight: '600' },
  weekendText: { color: '#D10000' },
  calRow: { flexDirection: 'row', minHeight: 38 },
  labelCol: { width: LABEL_WIDTH, alignItems: 'center', justifyContent: 'center' },
  cnCol: { alignItems: 'center', justifyContent: 'center' },
  cnText: { fontSize: 9, fontWeight: '700', textAlign: 'center', lineHeight: 11 },
  dayCell: { flex: 1, aspectRatio: 1.2, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  dayCellSel: { backgroundColor: '#0055A8' },
  dayCellText: { fontSize: 14, color: '#333', fontWeight: '500' },
  dayCellTextSel: { color: '#FFF', fontWeight: '700' },
  otherMonthText: { color: '#CCC' },
  todayBtn: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#E8F4FF',
    borderRadius: 14,
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0055A8',
  },
});
