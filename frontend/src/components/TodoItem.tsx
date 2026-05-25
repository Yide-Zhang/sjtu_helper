import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import { CustomTodo } from '../utils/todoStorage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatTodoDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const hasTime = dateStr.includes('T') || dateStr.includes(':');
  const showTime = hasTime && !(hours === 0 && minutes === 0);
  const timeStr = showTime ? ` ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : '';
  return `${month}月${day}日${timeStr}`;
};

const getHoursUntilDue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const now = new Date().getTime();
  const due = new Date(dueDate).getTime();
  const diff = due - now;
  if (diff <= 0) return null;
  return diff / (1000 * 60 * 60);
};

type UrgencyLevel = 'none' | 'yellow' | 'orange' | 'red';

const getUrgency = (todo: CustomTodo): UrgencyLevel => {
  if (todo.completed) return 'none';
  const hours = getHoursUntilDue(todo.dueDate);
  if (hours === null) return 'none';
  if (hours <= 1) return 'red';        // 1h内
  if (hours <= 24) return 'orange';    // 1天内
  if (hours <= 72) return 'yellow';    // 3天内
  return 'none';
};

const isFutureDue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() > new Date().getTime();
};

interface Props {
  todo: CustomTodo;
  onToggle: (id: string) => void;
  onEdit?: (todo: CustomTodo) => void;
  onDelete?: (id: string) => void;
}

// 【全新色彩设计】：完美同步 AssignmentCard 的色彩搭配
const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  none: '#F0F0F0',
  yellow: '#f5d741', // 蜜糖琥珀金（3天内）
  orange: '#e69334', // 柿红琉璃橙（1天内）
  red: '#CD2026',    // 勃艮第绯红（1h内）
};

export const TodoItem: React.FC<Props> = ({ todo, onToggle, onEdit, onDelete }) => {
  const { showAlert, alertProps } = useAlertModal();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // 核心修复：正确提取并监听响应 urgency 和对应的颜色
  const urgency = useMemo(() => getUrgency(todo), [todo.completed, todo.dueDate]);
  const glowColor = useMemo(() => URGENCY_COLORS[urgency], [urgency]);
  
  const isCompleted = todo.completed;
  const isFuture = todo.dueDate ? isFutureDue(todo.dueDate) : false;

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onToggle(todo.id);
    });
  };

  const handleDeletePress = () => {
    showAlert({
      title: '确认删除',
      message: `确定要删除「${todo.title}」吗？`,
      icon: 'delete',
      iconColor: '#E53935',
      buttons: [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            const direction = Math.random() > 0.5 ? 1 : -1;
            Animated.timing(slideAnim, {
              toValue: direction * 500,
              duration: 300,
              useNativeDriver: true,
            }).start(() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onDelete?.(todo.id);
            });
          },
        },
      ],
    });
  };

  // 1. 已完成且属于未来的卡片样式 (保持紧凑设计，不带垫底，仅对齐间距)
  if (isCompleted && isFuture) {
    return (
      <Animated.View style={[styles.cardWrapper, { transform: [{ translateX: slideAnim }, { scale: scaleAnim }] }]}>
        <View style={styles.cardOuterWrapper}>
          <View style={styles.containerCollapsed}>
            <TouchableOpacity style={styles.checkbox} onPress={handleToggle} activeOpacity={0.6}>
              <Text style={[styles.checkIcon, styles.checkIconDone]}>✓</Text>
            </TouchableOpacity>
            <View style={styles.contentCollapsed}>
              <Text style={styles.courseNameCollapsed}>{todo.courseName || '个人待办'}</Text>
              <Text style={styles.titleCollapsed} numberOfLines={1}>{todo.title}</Text>
            </View>
            {todo.dueDate && (
              <Text style={styles.dateTextCollapsed}>{formatTodoDate(todo.dueDate)}</Text>
            )}
            <View style={styles.actionCol}>
              <TouchableOpacity onPress={handleDeletePress} style={styles.actionBtn} activeOpacity={0.6}>
                <MaterialIcons name="delete" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  // 2. 未完成或已过期的卡片 (完美融合你的半透明硬垫底设计)
  return (
    <>
    <AlertModal {...alertProps} />
    <Animated.View style={[styles.cardWrapper, { transform: [{ translateX: slideAnim }, { scale: scaleAnim }] }]}>
      <View style={styles.glowWrapper}>
        
        {/* 【半透明莫兰迪硬垫底】
            1. 参数完全复制你调好的效果：top: 2, bottom: 2, left: 6, right: 6
            2. 圆角统一为 15，不透明度给到 0.65。
            3. 现在已经正确绑定了带有黄橙红梯度逻辑的 backgroundColor！
        */}
        {urgency !== 'none' && (
          <View style={[styles.pureColorBase, { backgroundColor: glowColor }]} />
        )}

        {/* 主白卡片容器 */}
        <View style={styles.container}>
          <TouchableOpacity style={styles.checkbox} onPress={handleToggle} activeOpacity={0.6}>
            <Text style={[styles.checkIcon, isCompleted && styles.checkIconDone]}>
              {isCompleted ? '✓' : '○'}
            </Text>
          </TouchableOpacity>
          
          <View style={[styles.content, isCompleted && styles.contentDone]}>
            <Text style={styles.courseName}>{todo.courseName || '个人待办'}</Text>
            <Text style={[styles.titleText, isCompleted && styles.titleDone]} numberOfLines={2}>
              {todo.title}
            </Text>
            {todo.dueDate && (
              <Text style={styles.dateText}>{formatTodoDate(todo.dueDate)}</Text>
            )}
          </View>

          <View style={styles.actionCol}>
            <TouchableOpacity onPress={() => onEdit?.(todo)} style={styles.actionBtn} activeOpacity={0.6}>
              <MaterialIcons name="edit" size={18} color="#42A5F5" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeletePress} style={styles.actionBtn} activeOpacity={0.6}>
              <MaterialIcons name="delete" size={18} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    overflow: 'visible',
  },
  cardOuterWrapper: {
    paddingHorizontal: 10,
  },
  glowWrapper: {
    position: 'relative',
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'visible',
  },
  // 完美复刻你的纯色利落硬底座参数
  pureColorBase: {
    position: 'absolute',
    top: 2,               // 锁定上下
    bottom: 2,            
    left: 7,              // 锁定左右
    right: 7,            
    borderRadius: 13,     // 统一大圆角
    opacity: 0.65,        // 完美的高对比半透明度
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA', 
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
  },
  checkbox: {
    padding: 4,
    marginRight: 10,
  },
  checkIcon: {
    fontSize: 20,
    color: '#CCC',
  },
  checkIconDone: {
    color: '#34A853',
  },
  content: {
    flex: 1,
  },
  contentDone: {
    opacity: 0.55,
  },
  courseName: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginBottom: 2,
  },
  titleText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    lineHeight: 20,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  containerCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FCF8',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  contentCollapsed: {
    flex: 1,
  },
  courseNameCollapsed: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  titleCollapsed: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  dateTextCollapsed: {
    fontSize: 11,
    color: '#888',
    marginLeft: 8,
    fontWeight: '600',
  },
  actionCol: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
  editIcon: {
    fontSize: 14,
  },
  deleteIcon: {
    fontSize: 14,
  },
});