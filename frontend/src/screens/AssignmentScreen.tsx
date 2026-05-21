import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform, LayoutAnimation, RefreshControl, Animated, UIManager, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

import { fetchAllUpcomingAssignments, CanvasAssignment } from '../api/canvas';
import { fetchExamJSON } from '../api/jaccount';
import { getExamUpdateInterval, EXAM_CACHE_PREFIX } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssignmentCard } from '../components/AssignmentCard';
import { MonthCalendar } from '../components/MonthCalendar';
import { TodoItem } from '../components/TodoItem';
import { CourseSelector } from '../components/CourseSelector';
import { DatePickerModal } from '../components/DatePickerModal';
import { TimePickerModal } from '../components/TimePickerModal';
import { CustomTodo, getTodos, addTodo, toggleTodo, removeTodo, saveTodos } from '../utils/todoStorage';
import { getCache, setCache } from '../utils/cache';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// Android 必须开启此开关才能支持 LayoutAnimation
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// 格式化为 YYYY.MM.DD HH:MM
const formatDateDot = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}.${month}.${day} ${hours}:${minutes}`;
};

export const AssignmentScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [pastSortOrder, setPastSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pastPage, setPastPage] = useState(1);
  const PAST_PAGE_SIZE = 10;
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [todos, setTodos] = useState<CustomTodo[]>([]);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const [formCourse, setFormCourse] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDateObj, setFormDateObj] = useState<Date | null>(null);
  const [useDate, setUseDate] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const listRef = useRef<FlatList<any>>(null);
  const [tempHour, setTempHour] = useState(12);
  const [tempMinute, setTempMinute] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const showBackToTop = scrollY > SCREEN_HEIGHT * 2;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // 专门用于控制“过去的内容”渐变淡入淡出
  const pastOpacityAnim = useRef(new Animated.Value(0)).current;
  // Crazy Thursday
  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(true), loadTodos()]);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.delay(100),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setToastMsg('刷新成功 ✓');
    setTimeout(() => setToastMsg(''), 1500);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const now = new Date();
    const minutes = now.getMinutes();
    const next = 15 - (minutes % 15);
    const msUntilNext = next * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
    const timer = setTimeout(() => {
      doRefresh();
      setInterval(doRefresh, 15 * 60 * 1000);
    }, msUntilNext);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 优先读取缓存，避免重复加载
    const cached = getCache<CanvasAssignment[]>('assignments');
    if (cached) {
      setAssignments(cached);
      setLoading(false);
    } else {
      loadData();
    }
    loadTodos();
    // 首次加载时也尝试获取考试
    fetchExamsForHome();
  }, []);

  const loadTodos = async () => {
    const data = await getTodos();
    setTodos(data);
  };

  // ── 独立获取本学期考试，可单独调用 ──
  const fetchExamsForHome = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      let curXnm, curXqm;
      if (month >= 2 && month <= 6) { curXnm = String(now.getFullYear() - 1); curXqm = '12'; }
      else if (month >= 7 && month <= 8) { curXnm = String(now.getFullYear() - 1); curXqm = '16'; }
      else if (month >= 9 && month <= 12) { curXnm = String(now.getFullYear()); curXqm = '3'; }
      else { curXnm = String(now.getFullYear() - 1); curXqm = '3'; }

      const cacheKey = `${EXAM_CACHE_PREFIX}${curXnm}_${curXqm}`;
      const cachedJson = await AsyncStorage.getItem(cacheKey);
      const maxAgeMs = (await getExamUpdateInterval()) * 24 * 60 * 60 * 1000;
      if (cachedJson) {
        const cached = JSON.parse(cachedJson);
        if (Date.now() - cached.timestamp < maxAgeMs) {
          setExams(cached.items || []);
          return;
        }
      }
      // 无有效缓存，拉取
      const raw = await fetchExamJSON(curXnm, curXqm);
      const examData = JSON.parse(raw);
      const items = examData.items || [];
      setExams(items);
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ items, timestamp: Date.now() }));
    } catch {
      // 考试获取失败不影响作业
    }
  };

  const loadData = async (isManual?: boolean) => {
    if (!isManual) setLoading(true);
    try {
      const data = await fetchAllUpcomingAssignments();
      setAssignments(data);
      setCache('assignments', data);
    } catch (e: any) {
      console.error('Fetch assignments error:', e);
      let errorMsg = '网络错误或认证失效';
      if (e.response && e.response.status === 401) {
        errorMsg = '登录已过期或Token无效，请重新登录';
      } else if (e.message.includes('Network Error')) {
        errorMsg = '网络跨域问题或无法连接到交大Canvas';
      }
      alert(`无法同步作业: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
    // 同步也刷新考试
    fetchExamsForHome();
  };

  const handleAddTodo = async () => {
    if (!formTitle.trim()) return;
    let dueDate: string | null = null;
    if (useDate && formDateObj) {
      const d = formDateObj;
      if (d.getHours() === 0 && d.getMinutes() === 0) {
        dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else {
        dueDate = d.toISOString();
      }
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (editTodoId) {
      const all = await getTodos();
      const updated = all.map(t => t.id === editTodoId ? { ...t, courseName: formCourse || '个人待办', title: formTitle.trim(), dueDate } : t);
      await saveTodos(updated);
    } else {
      await addTodo(formCourse || '个人待办', formTitle.trim(), dueDate);
    }
    resetForm();
    await loadTodos();
  };

  const handleToggleTodo = async (id: string) => {
    await toggleTodo(id);
    await loadTodos();
  };

  const handleEditTodo = (todo: CustomTodo) => {
    setEditTodoId(todo.id);
    setFormCourse(todo.courseName);
    setFormTitle(todo.title);
    if (todo.dueDate) {
      setFormDateObj(new Date(todo.dueDate));
      setUseDate(true);
    } else {
      setFormDateObj(null);
      setUseDate(false);
    }
    setShowTodoForm(true);
  };

  const handleDeleteTodo = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await removeTodo(id);
    await loadTodos();
  };

  const scrollToTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const resetForm = () => {
    setEditTodoId(null);
    setFormCourse('');
    setFormTitle('');
    setFormDateObj(null);
    setUseDate(false);
    setShowTodoForm(false);
  };

  // 核心改动：统一接管过去区域的 展开（落下来）和 收起（缩回去）
  const togglePastSection = (expand: boolean) => {
    // 预先配置一个非常平滑、带有一点物理回弹效果的布局动画
    const config = {
      duration: 380,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    };

    if (expand) {
      // 展开：先滚到顶部防遮挡
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      
      setTimeout(() => {
        // 告诉布局：下一个状态改变请使用下落动画
        LayoutAnimation.configureNext(config);
        setShowPast(true);

        // 与此同时，淡入内容
        Animated.timing(pastOpacityAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      }, 250);
    } else {
      // 收起：先迅速让透明度变透明（这样往回缩的时候里面内容不会穿帮重叠）
      Animated.timing(pastOpacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        // 告诉布局：下一个状态改变请使用回升缩回动画
        LayoutAnimation.configureNext(config);
        setShowPast(false);
        setPastPage(1);

        setTimeout(() => {
          listRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 150);
      });
    }
  };

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0055A8" />
          <Text style={{ marginTop: 10, color: '#666' }}>正在同步 Canvas 数据...</Text>
        </View>
      );
    }

    const nonAnnouncements = assignments.filter(a =>
      !(a.submission_types && (a.submission_types.includes('none') || a.submission_types.includes('not_graded')))
    );

    const currentTime = Date.now();

    // 所有有课程名的考试
    const validExams = exams.filter(e => e.kcmc);
    const upcomingAssignments = nonAnnouncements.filter(a => {
      if (!a.display_date) return true;
      return new Date(a.display_date).getTime() >= currentTime;
    });

    // 排序：有截止日期的作业 → 考试 → 无截止日期的作业
    type CombinedItem = 
      | { type: 'exam'; data: any; date: number }
      | { type: 'assignment'; data: CanvasAssignment; date: number };

    const safeTime = (s: string | undefined | null): number => {
      if (!s) return Infinity;
      // "2026-07-02(08:00-10:00)" → 取日期+开考时间
      const m = s.match(/^(\d{4}-\d{2}-\d{2})\((\d{2}:\d{2})/);
      if (m) {
        const d = new Date(`${m[1]}T${m[2]}`);
        if (!isNaN(d.getTime())) return d.getTime();
      }
      // fallback: 只取日期
      const d = new Date(s.substring(0, 10));
      return isNaN(d.getTime()) ? Infinity : d.getTime();
    };

    const withDue = upcomingAssignments
      .filter(a => a.display_date)
      .map(a => ({ type: 'assignment' as const, data: a, date: safeTime(a.display_date), sortGroup: 0 }));
    const examItems = validExams
      .map(e => ({ type: 'exam' as const, data: e, date: safeTime(e.kssj), sortGroup: 1 }));
    const withoutDue = upcomingAssignments
      .filter(a => !a.display_date)
      .map(a => ({ type: 'assignment' as const, data: a, date: Infinity, sortGroup: 2 }));

    const pastAssignments = nonAnnouncements.filter(a => {
      if (!a.display_date) return false;
      return new Date(a.display_date).getTime() < currentTime;
    });

    const sortedPast = [...pastAssignments].sort((a, b) => {
      const dateA = a.display_date ? new Date(a.display_date).getTime() : 0;
      const dateB = b.display_date ? new Date(b.display_date).getTime() : 0;
      return pastSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    const activeTodos = todos.filter(t => !t.completed);
    const completedTodos = todos.filter(t => t.completed);
    const totalPast = pastAssignments.length + completedTodos.length;
    // 待办混入主列表
    const todoItems = activeTodos.map(t => ({
      type: 'todo' as const, data: t,
      date: t.dueDate ? (new Date(t.dueDate.substring(0, 10)).getTime() || Infinity) : Infinity,
      sortGroup: 1.5,
    }));
    const allWithDate = [...withDue, ...examItems, ...todoItems].sort((a, b) => {
      if (a.date !== b.date) return a.date - b.date;
      return (a as any).sortGroup - (b as any).sortGroup;
    });
    const combined = [...allWithDate, ...withoutDue];

    return (
      <FlatList
        ref={listRef}
        onScroll={(e: any) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={doRefresh} colors={['#0055A8']} />
        }
        data={combined}
        keyExtractor={(item, idx) => `${item.type}-${idx}`}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          if (item.type === 'todo') {
            return <TodoItem key={item.data.id} todo={item.data} onToggle={handleToggleTodo} onEdit={handleEditTodo} onDelete={handleDeleteTodo} />;
          }
          if (item.type === 'exam') {
            const e = item.data;
            let timeStr = e.kssj || '待定';
            if (timeStr.includes(' ')) {
              const [d, t] = timeStr.split(' ');
              timeStr = `${d.replace(/-/g, '.')} ${t.substring(0, 5)}`;
            }
            return (
              <View style={styles.examCard}>
                <View style={styles.examCardTop}>
                  <View style={styles.examBadge}>
                    <Text style={styles.examBadgeText}>考试</Text>
                  </View>
                  <Text style={styles.examCourseName} numberOfLines={1}>{e.kcmc}</Text>
                </View>
                <View style={styles.examInfoRow}>
                  <MaterialIcons name="access-time" size={14} color="#0055A8" />
                  <Text style={styles.examInfoText}>{timeStr}</Text>
                </View>
                {e.cdmc && (
                  <View style={styles.examInfoRow}>
                    <MaterialIcons name="location-on" size={14} color="#E65100" />
                    <Text style={styles.examInfoText}>{e.cdmc}{e.zwh ? ` 座位 ${e.zwh}` : ''}</Text>
                  </View>
                )}
              </View>
            );
          }
          const a = item.data;
          const isFuture = a.display_date && new Date(a.display_date).getTime() > new Date().getTime();
          return (
            <AssignmentCard
              assignment={a}
              forceShowActions={true}
              footerDateStr={a.has_submitted_submissions && isFuture && a.display_date ? `截止日期：${formatDateDot(a.display_date)}` : undefined}
              navigation={navigation}
            />
          );
        }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* 考试数调试 */}
            {exams.length > 0 && (
              <View style={{ paddingHorizontal: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: '#999' }}>已加载 {exams.length} 条考试信息</Text>
              </View>
            )}
            {/* 过去的内容 */}
            {totalPast > 0 && (
              <View style={styles.pastSection}>
                <TouchableOpacity 
                  style={styles.pastExpandBtn} 
                  onPress={() => togglePastSection(!showPast)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pastExpandBtnText}>
                    {showPast ? '▲' : '▼'} 已经过去的 ({totalPast})
                  </Text>
                </TouchableOpacity>

                {/* 【重要修正】：这里移除了 {showPast && ...} 的条件渲染。
                  改为让外层包裹容器通过 style 的 height 和 overflow 隐藏。
                  这样 React Native 的 LayoutAnimation 才能捕捉到它的尺寸边界，从而做出伸展（落下来）和收缩（升上去）的平滑连贯动画。
                */}
                <View style={{ height: showPast ? 'auto' : 0, overflow: 'hidden' }}>
                  <Animated.View style={{ opacity: pastOpacityAnim }}>
                    <View style={styles.sortRow}>
                      <TouchableOpacity
                        style={styles.sortToggleBtn}
                        onPress={() => setPastSortOrder(pastSortOrder === 'desc' ? 'asc' : 'desc')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.sortToggleText}>
                          {pastSortOrder === 'desc' ? '从新到旧 ↓' : '从旧到新 ↑'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {(() => {
                      const allPast: any[] = [];
                      completedTodos.forEach(t => {
                        const date = t.dueDate ? new Date(t.dueDate).getTime() : 0;
                        allPast.push({ type: 'todo', item: t, date });
                      });
                      sortedPast.forEach(a => {
                        const date = a.display_date ? new Date(a.display_date).getTime() : 0;
                        allPast.push({ type: 'assign', item: a, date });
                      });
                      allPast.sort((a, b) => pastSortOrder === 'asc' ? a.date - b.date : b.date - a.date);

                      const visibleCount = pastPage * PAST_PAGE_SIZE;
                      const visibleItems = allPast.slice(0, visibleCount);
                      const hasMore = visibleCount < allPast.length;

                      return (
                        <View>
                          {visibleItems.map((entry: any) => {
                            if (entry.type === 'todo') {
                              return <TodoItem key={entry.item.id} todo={entry.item} onToggle={handleToggleTodo} onEdit={handleEditTodo} onDelete={handleDeleteTodo} />;
                            }
                            const a = entry.item;
                            return (
                              <AssignmentCard
                                key={a.id.toString()}
                                assignment={a}
                                footerDateStr={a.display_date ? `截止日期：${formatDateDot(a.display_date)}` : undefined}
                                navigation={navigation}
                              />
                            );
                          })}

                          {hasMore ? (
                            <TouchableOpacity
                              style={styles.loadMoreBtn}
                              onPress={() => {
                                LayoutAnimation.configureNext({...LayoutAnimation.Presets.easeInEaseOut, duration: 300});
                                setPastPage(pastPage + 1);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.loadMoreBtnText}>展开更多（{Math.min(PAST_PAGE_SIZE, allPast.length - visibleCount)}条）</Text>
                            </TouchableOpacity>
                          ) : allPast.length > 0 && (
                            <Text style={styles.noMoreText}>没有更早的作业了</Text>
                          )}

                          <TouchableOpacity
                            style={styles.pastCollapseBtn}
                            onPress={() => togglePastSection(false)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.pastCollapseBtnText}>▲ 收起</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })()}
                  </Animated.View>
                </View>

              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>恭喜！近期没有待完成的作业</Text>
          </View>
        }
      />
    );
  };

  const selectedDayAssignments = selectedDate
    ? assignments.filter(a => {
        if (!a.display_date) return false;
        const d = new Date(a.display_date);
        return d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
      })
    : [];

  const selectedDayTodos = selectedDate
    ? todos.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
      })
    : [];

  const selectedDayExams = selectedDate
    ? exams.filter(e => {
        if (!e.kssj) return false;
        const ds = e.kssj.substring(0, 10);
        if (!ds) return false;
        const d = new Date(ds);
        return !isNaN(d.getTime()) &&
          d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
      })
    : [];

  const renderCalendarView = () => {
    type DayItem = { type: 'todo'; todo: CustomTodo } | { type: 'assignment'; assignment: CanvasAssignment } | { type: 'exam'; exam: any };
    const dayItems: DayItem[] = [
      ...selectedDayTodos.map(t => ({ type: 'todo' as const, todo: t })),
      ...selectedDayAssignments.map(a => ({ type: 'assignment' as const, assignment: a })),
      ...selectedDayExams.map(e => ({ type: 'exam' as const, exam: e })),
    ];
    dayItems.sort((a) => (a.type === 'todo' ? -1 : 1));

    return (
    <FlatList
      onScroll={(e: any) => setScrollY(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={100}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={doRefresh} colors={['#0055A8']} />
      }
      data={dayItems}
      keyExtractor={item => {
        if (item.type === 'todo') return `todo-${item.todo.id}`;
        if (item.type === 'exam') return `exam-${item.exam.kcmc}-${item.exam.kssj}`;
        return `assign-${item.assignment.id}`;
      }}
      renderItem={({ item }) => {
        if (item.type === 'todo') {
          return (
            <TodoItem
              todo={item.todo}
              onToggle={handleToggleTodo}
              onEdit={handleEditTodo}
              onDelete={handleDeleteTodo}
            />
          );
        }
        if (item.type === 'exam') {
          const e = item.exam;
          let timeStr = e.kssj || '待定';
          if (timeStr.includes('(')) {
            // "2026-07-02(08:00-10:00)" → 取括号内
            const tm = timeStr.match(/\((.+?)\)/);
            if (tm) timeStr = tm[1];
          }
          return (
            <View style={styles.examCard}>
              <View style={styles.examCardTop}>
                <View style={styles.examBadge}>
                  <Text style={styles.examBadgeText}>考试</Text>
                </View>
                <Text style={styles.examCourseName} numberOfLines={1}>{e.kcmc}</Text>
              </View>
              <View style={styles.examInfoRow}>
                <MaterialIcons name="access-time" size={14} color="#0055A8" />
                <Text style={styles.examInfoText}>{timeStr}</Text>
              </View>
              {e.cdmc && (
                <View style={styles.examInfoRow}>
                  <MaterialIcons name="location-on" size={14} color="#E65100" />
                  <Text style={styles.examInfoText}>{e.cdmc}</Text>
                </View>
              )}
            </View>
          );
        }
        const isSubmitted = item.assignment.has_submitted_submissions || false;
        return (
          <AssignmentCard
            assignment={item.assignment}
            footerDateStr={isSubmitted && item.assignment.display_date ? `截止日期：${formatDateDot(item.assignment.display_date)}` : undefined}
            navigation={navigation}
          />
        );
      }}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          <MonthCalendar
            assignments={assignments}
            todos={todos}
            exams={exams}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onAddTodoForDate={(d: Date) => {
              setFormDateObj(d);
              setUseDate(true);
              setEditTodoId(null);
              setFormCourse('');
              setFormTitle('');
              setShowTodoForm(true);
            }}
          />
          {selectedDate && (
            <View style={styles.selectedDateHeader}>
              <Text style={styles.selectedDateTitle}>
                {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
              </Text>
              <TouchableOpacity
                style={styles.addTodoInlineBtn}
                onPress={() => {
                  setFormDateObj(selectedDate);
                  setUseDate(true);
                  setEditTodoId(null);
                  setFormCourse('');
                  setFormTitle('');
                  setShowTodoForm(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.addTodoInlineText}>创建待办</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        selectedDate ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>当天没有作业、待办或公告</Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>点击日期查看当天的作业和公告</Text>
          </View>
        )
      }
    />
  );};

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{viewMode === 'list' ? '近期作业' : '日历'}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.viewToggleBtn}
              onPress={() => { setViewMode(viewMode === 'list' ? 'calendar' : 'list'); setSelectedDate(null); }}
              activeOpacity={0.7}
            >
              <Text style={styles.viewToggleText}>
                {viewMode === 'list' ? '日历' : '列表'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTodoBtn} onPress={() => { resetForm(); setShowTodoForm(true); }} activeOpacity={0.7}>
              <MaterialIcons name="add" size={18} color="#34A853" style={{ marginRight: 2 }} /><Text style={styles.addTodoBtnText}>待办</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {viewMode === 'list' ? renderList() : renderCalendarView()}
        </Animated.View>

        {toastMsg !== '' && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toastMsg}</Text>
          </View>
        )}

        {showBackToTop && (
          <TouchableOpacity
            style={styles.backToTopBtn}
            onPress={scrollToTop}
            activeOpacity={0.8}
          >
            <Text style={styles.backToTopArrow}>↑</Text>
          </TouchableOpacity>
        )}

        <Modal visible={showTodoForm} transparent animationType="slide" onRequestClose={resetForm}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editTodoId ? '编辑待办' : '新建待办'}</Text>
              <CourseSelector
                courses={[...new Set(assignments.map(a => a.course_name).filter(Boolean) as string[])]}
                selected={formCourse}
                onSelect={setFormCourse}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="待办名称"
                placeholderTextColor="#999"
                value={formTitle}
                onChangeText={setFormTitle}
                autoFocus={!editTodoId}
              />
              <TouchableOpacity style={styles.pickerRow} onPress={() => { setUseDate(true); setShowDateModal(true); }} activeOpacity={0.7}>
                <Text style={styles.pickerRowText}>
                  {useDate && formDateObj
                    ? `${formDateObj.getFullYear()}年${formDateObj.getMonth() + 1}月${formDateObj.getDate()}日`
                    : '设置日期（选填）'}
                </Text>
              </TouchableOpacity>
              <DatePickerModal
                visible={showDateModal}
                date={formDateObj || new Date()}
                onChange={setFormDateObj}
                onClose={() => setShowDateModal(false)}
                onClear={() => { setFormDateObj(null); setUseDate(false); }}
              />
              <TouchableOpacity 
                style={styles.pickerRow} 
                onPress={() => { 
                  const currentHour = formDateObj ? formDateObj.getHours() : new Date().getHours();
                  const currentMinute = formDateObj ? formDateObj.getMinutes() : new Date().getMinutes();
                  setTempHour(currentHour);
                  setTempMinute(currentMinute);
                  setShowTimeModal(true); 
                }} 
                activeOpacity={0.7}
              >
                <Text style={styles.pickerRowText}>
                  {formDateObj && (formDateObj.getHours() !== 0 || formDateObj.getMinutes() !== 0)
                    ? `${String(formDateObj.getHours()).padStart(2, '0')}:${String(formDateObj.getMinutes()).padStart(2, '0')}`
                    : '时间（可选）'}
                </Text>
              </TouchableOpacity>
              <TimePickerModal
                visible={showTimeModal}
                hour={tempHour}
                minute={tempMinute}
                onHourChange={(h) => setTempHour(h)}
                onMinuteChange={(m) => setTempMinute(m)}
                onClose={() => {
                  const d = new Date(formDateObj || new Date());
                  d.setHours(tempHour, tempMinute, 0, 0);
                  setFormDateObj(d);
                  setShowTimeModal(false);
                }}
                onClear={() => {
                  const d = new Date(formDateObj || new Date());
                  d.setHours(0, 0, 0, 0);
                  setFormDateObj(d);
                  setShowTimeModal(false);
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={resetForm} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleAddTodo} activeOpacity={0.7}>
                  <Text style={styles.modalConfirmText}>{editTodoId ? '保存' : '添加'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  // 保留原有所有样式不变...
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggleBtn: { backgroundColor: '#E8F0FE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  viewToggleText: { color: '#0055A8', fontWeight: '600', fontSize: 13 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#0055A8', fontWeight: '700', fontSize: 22 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { padding: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, borderStyle: 'dashed', borderColor: '#CCC', borderWidth: 1, marginTop: 10, marginBottom: 20 },
  emptyText: { fontSize: 16, color: '#999' },
  pastSection: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 10 },
  pastExpandBtn: { backgroundColor: '#E2E8F0', paddingVertical: 12, marginHorizontal: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  pastExpandBtnText: { color: '#555', fontSize: 14, fontWeight: 'bold' },
  sortRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  loadMoreBtn: { backgroundColor: '#E8F0FE', paddingVertical: 12, marginHorizontal: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  loadMoreBtnText: { color: '#0055A8', fontSize: 14, fontWeight: '700' },
  noMoreText: { textAlign: 'center', color: '#AAA', fontSize: 12, marginVertical: 10 },
  pastCollapseBtn: { backgroundColor: '#E2E8F0', paddingVertical: 10, marginHorizontal: 10, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  pastCollapseBtnText: { color: '#666', fontSize: 13, fontWeight: '600' },
  sortToggleBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  sortToggleText: { color: '#666', fontSize: 12, fontWeight: '600' },
  selectedDateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 12 },
  selectedDateTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  addTodoInlineBtn: { backgroundColor: '#E6F7E6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addTodoInlineText: { color: '#34A853', fontWeight: '600', fontSize: 13 },
  addTodoBtn: { backgroundColor: '#E6F7E6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  addTodoBtnText: { color: '#34A853', fontWeight: '600', fontSize: 13 },
  todoSection: { marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  todoSectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 20, textAlign: 'center' },
  modalInput: { backgroundColor: '#F9FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, fontSize: 15, borderRadius: 10, color: '#333', marginBottom: 12 },
  modalLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 6, marginTop: 4 },
  pickerRow: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#F9FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 12 },
  pickerRowText: { fontSize: 15, color: '#333' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center' },
  modalCancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  modalConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0055A8', alignItems: 'center' },
  modalConfirmText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  backToTopBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0055A8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  backToTopArrow: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: -2,
  },
  toast: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', pointerEvents: 'none' },
  toastText: { backgroundColor: '#333', color: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, fontSize: 14, fontWeight: '600', overflow: 'hidden' },

  // 考试卡片
  examCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    marginHorizontal: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E65100',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  examCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  examBadge: {
    backgroundColor: '#E65100',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  examBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  examCourseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  examInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  examInfoText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
  },

});