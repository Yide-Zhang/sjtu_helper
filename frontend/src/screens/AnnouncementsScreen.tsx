import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAllUpcomingAssignments, CanvasAssignment } from '../api/canvas';
import { AssignmentCard } from '../components/AssignmentCard';
import { getCache, setCache } from '../utils/cache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { AlertModal, useAlertModal } from '../components/AlertModal';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const AnnouncementsScreen = ({ navigation }: any) => {
  const { showAlert, alertProps } = useAlertModal();
  const insets = useSafeAreaInsets();
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const listRef = useRef<FlatList<any>>(null);
  const [hiddenAnnouncements, setHiddenAnnouncements] = useState<number[]>([]);
  const [todoAnnouncements, setTodoAnnouncements] = useState<number[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [showTodos, setShowTodos] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // 15 分钟自动刷新
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
    const cached = getCache<CanvasAssignment[]>('assignments');
    if (cached) {
      setAssignments(cached);
      setLoading(false);
    } else {
      loadData();
    }
  }, []);

  const loadData = async () => {
    if (!refreshing) setLoading(true);
    try {
      const hiddenStr = await AsyncStorage.getItem('HIDDEN_ANNOUNCEMENTS');
      if (hiddenStr) setHiddenAnnouncements(JSON.parse(hiddenStr));

      const todoStr = await AsyncStorage.getItem('TODO_ANNOUNCEMENTS');
      if (todoStr) setTodoAnnouncements(JSON.parse(todoStr));

      const data = await fetchAllUpcomingAssignments();
      setAssignments(data);
      setCache('assignments', data);
    } catch (e) {
      console.error('Fetch announcements error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 筛选出所有公告类型（无须提交的作业）
  const allAnnouncements = assignments.filter(a =>
    a.submission_types && (a.submission_types.includes('none') || a.submission_types.includes('not_graded'))
  );

  // 按排序顺序排列所有可见公告（含过去公告，使用 forceShowActions 完整展示）
  const visibleAnnouncements = allAnnouncements
    .filter(a => !hiddenAnnouncements.includes(a.id))
    .sort((a, b) => {
      const dateA = a.display_date ? new Date(a.display_date).getTime() : 0;
      const dateB = b.display_date ? new Date(b.display_date).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  const hiddenItems = allAnnouncements.filter(a => hiddenAnnouncements.includes(a.id));
  const todoItems = assignments.filter(a => todoAnnouncements.includes(a.id));

  const handleAnnounceAction = async (assignment: CanvasAssignment, action: 'hide' | 'todo') => {
    if (action === 'hide') {
      const newHidden = [...hiddenAnnouncements, assignment.id];
      setHiddenAnnouncements(newHidden);
      await AsyncStorage.setItem('HIDDEN_ANNOUNCEMENTS', JSON.stringify(newHidden));
    } else {
      // 去重：已存在的待办不再重复添加
      if (todoAnnouncements.includes(assignment.id)) {
        // 检查是否所有可见公告都已创建待办
        const allDone = visibleAnnouncements.every(a => todoAnnouncements.includes(a.id));
        if (allDone) {
          showAlert({ title: '提示', message: '所有的待办都已创建', icon: 'check-circle', iconColor: '#43A047', simple: true });
        }
        return;
      }
      const newTodos = [...todoAnnouncements, assignment.id];
      setTodoAnnouncements(newTodos);
      await AsyncStorage.setItem('TODO_ANNOUNCEMENTS', JSON.stringify(newTodos));
    }
  };

  const handleUnhide = async (assignmentId: number) => {
    const newHidden = hiddenAnnouncements.filter(id => id !== assignmentId);
    setHiddenAnnouncements(newHidden);
    await AsyncStorage.setItem('HIDDEN_ANNOUNCEMENTS', JSON.stringify(newHidden));
  };

  const handleRemoveTodo = async (assignmentId: number) => {
    const newTodos = todoAnnouncements.filter(id => id !== assignmentId);
    setTodoAnnouncements(newTodos);
    await AsyncStorage.setItem('TODO_ANNOUNCEMENTS', JSON.stringify(newTodos));
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0055A8" />
          <Text style={{ marginTop: 10, color: '#666' }}>正在加载公告...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>公告</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          ref={listRef}
          onScroll={(e: any) => setScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={100}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={doRefresh} colors={['#0055A8']} />
          }
          data={visibleAnnouncements}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <AssignmentCard
              assignment={item}
              forceShowActions
              onAnnounceAction={(action) => handleAnnounceAction(item, action)}
              navigation={navigation}
            />
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* 待办事项 */}
              {todoItems.length > 0 && (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.sectionToggleBtn}
                    onPress={() => setShowTodos(!showTodos)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionToggleBtnTodo}>
                      {showTodos ? '▲' : '▼'} 待办事项 ({todoItems.length})
                    </Text>
                  </TouchableOpacity>
                  {showTodos && todoItems.map(item => (
                    <View key={item.id.toString()} style={styles.todoItem}>
                      <View style={styles.todoCardWrapper}>
                        <AssignmentCard assignment={item} compact />
                      </View>
                      <TouchableOpacity
                        style={styles.removeTodoBtn}
                        onPress={() => handleRemoveTodo(item.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeTodoText}>移除</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* 已隐藏的公告 */}
              {hiddenItems.length > 0 && (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.sectionToggleBtn}
                    onPress={() => setShowHidden(!showHidden)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionToggleText}>
                      {showHidden ? '▲' : '▼'} 已隐藏的公告 ({hiddenItems.length})
                    </Text>
                  </TouchableOpacity>
                  {showHidden && hiddenItems.map(item => (
                    <AssignmentCard
                      key={item.id.toString()}
                      assignment={item}
                      compact
                      onUnhide={() => handleUnhide(item.id)}
                    />
                  ))}
                </View>
              )}

              {/* 排序切换 */}
              {visibleAnnouncements.length > 0 && (
                <View style={styles.sortHeaderRow}>
                  <Text style={styles.sectionTitle}>全部公告</Text>
                  <TouchableOpacity
                    style={styles.sortToggleBtn}
                    onPress={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sortToggleText}>
                      {sortOrder === 'desc' ? '从新到旧 ↓' : '从旧到新 ↑'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无公告</Text>
            </View>
          }
        />

        {scrollY > SCREEN_HEIGHT * 2 && (
          <TouchableOpacity
            style={styles.backToTopBtn}
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
            activeOpacity={0.8}
          >
            <Text style={styles.backToTopArrow}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0055A8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 22,
    color: '#0055A8',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  sectionToggleBtn: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  sectionToggleText: {
    color: '#E65100',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionToggleBtnTodo: {
    color: '#0055A8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#888',
    marginBottom: 12,
    marginTop: 4,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  todoCardWrapper: {
    flex: 1,
  },
  removeTodoBtn: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  removeTodoText: {
    color: '#D10000',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderColor: '#CCC',
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  sortHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sortToggleBtn: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#CCC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
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
  sortToggleText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
});
