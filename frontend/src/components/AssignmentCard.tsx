import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { CanvasAssignment } from '../api/canvas';
import { getCourseColor } from '../utils/colors';
import { getManuallyCompletedIds, toggleManuallyCompleted } from '../utils/storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface Props {
  assignment: CanvasAssignment;
  onAnnounceAction?: (type: 'hide' | 'todo') => void;
  onUnhide?: () => void;
  compact?: boolean;
  forceShowActions?: boolean;
  footerDateStr?: string;
  navigation?: any;
}

type UrgencyLevel = 'none' | 'yellow' | 'orange' | 'red';

const getUrgency = (displayDate: string | null, isSubmitted: boolean): UrgencyLevel => {
  if (isSubmitted || !displayDate) return 'none';
  const now = new Date().getTime();
  const due = new Date(displayDate).getTime();
  const diff = due - now;
  if (diff <= 0) return 'none';
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 1) return 'red';      // 1h内
  if (hours <= 24) return 'orange';   // 1天内（24h）
  if (hours <= 72) return 'yellow';   // 3天内（72h）
  return 'none';
};

// 【全新色彩设计】：莫兰迪暖重色系，半透明平铺后极具艺术和高级质感
const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  none: '#F0F0F0',
  yellow: '#f5d741', // 蜜糖琥珀金（3天内）
  orange: '#e69334', // 柿红琉璃橙（1天内）
  red: '#CD2026',    // 勃艮第绯红（1h内）
};

const renderDate = (dateString: string | null, label: string, highlightTime: boolean = true) => {
  if (!dateString) {
    return <Text style={styles.dateText}>{label}无明确日期</Text>;
  }
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const isNot2359 = (hours !== 23 || minutes !== 59);

  return (
    <Text style={styles.dateText}>
      {label}{month}月{day}日{' '}
      {isNot2359 && highlightTime ? (
        <Text style={styles.urgentTimeText}>{timeString}</Text>
      ) : (
        timeString
      )}
    </Text>
  );
};

export const AssignmentCard: React.FC<Props> = ({ assignment, onAnnounceAction, onUnhide, compact, forceShowActions, footerDateStr, navigation }) => {
  const isAnnouncement = assignment.is_canvas_announcement ||
    (assignment.submission_types && (assignment.submission_types.includes('none') || assignment.submission_types.includes('not_graded')));
  const isOnPaper = assignment.submission_types?.includes('on_paper') || false;
  const isSubmitted = assignment.has_submitted_submissions;
  const courseColor = getCourseColor(assignment.course_name);

  const [manualDone, setManualDone] = useState(false);
  const [manualLoading, setManualLoading] = useState(true);

  useEffect(() => {
    if (isOnPaper) {
      getManuallyCompletedIds().then(ids => {
        setManualDone(ids.includes(assignment.id));
        setManualLoading(false);
      });
    } else {
      setManualLoading(false);
    }
  }, [assignment.id, isOnPaper]);

  const handleManualToggle = async () => {
    const nowDone = await toggleManuallyCompleted(assignment.id);
    setManualDone(nowDone);
  };

  const isActuallySubmitted = isSubmitted || manualDone;
  const urgency = useMemo(() => getUrgency(assignment.display_date || null, isActuallySubmitted), [assignment.display_date, isActuallySubmitted]);
  const glowColor = URGENCY_COLORS[urgency];

  let isPast = false;
  if (assignment.display_date) {
    const displayTime = new Date(assignment.display_date).getTime();
    if (displayTime < Date.now()) {
      isPast = true;
    }
  }

  let dateLabel = assignment.is_canvas_announcement ? '发布日期: ' : '截止日期: ';
  if (!assignment.due_at && (assignment.unlock_at || assignment.lock_at)) {
    dateLabel = '可用日期: ';
  }

  const handleOpenInBrowser = () => {
    const path = assignment.is_canvas_announcement
      ? `discussion_topics/${assignment.id}`
      : `assignments/${assignment.id}`;
    const url = `https://oc.sjtu.edu.cn/courses/${assignment.course_id}/${path}`;
    if (navigation) {
      navigation.navigate('WebView', { url, title: assignment.name || 'Canvas' });
    } else {
      Linking.openURL(url).catch(err => console.error('Failed to open URL:', err));
    }
  };

  // 干净、现代的纯白卡片容器，移除任何彩色发光干扰
  const dynamicCardStyle = useMemo(() => {
    return [
      styles.card,
      {
        borderColor: '#EAEAEA',    
        borderWidth: 1,
      }
    ];
  }, []);

  // ── compact 模式 ──
  if (compact) {
    return (
      <View style={styles.cardOuterWrapper}>
        <TouchableOpacity 
          style={[styles.card, styles.cardSubmitted]} 
          onPress={handleOpenInBrowser}
          activeOpacity={0.7}
        >
          <View style={styles.submittedContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.courseTagSubmitted} numberOfLines={1}>{assignment.course_name}</Text>
              <Text style={styles.titleSubmitted} numberOfLines={1}>{assignment.name}</Text>
            </View>
            {onUnhide && (
              <TouchableOpacity style={styles.btnUnhide} onPress={onUnhide} activeOpacity={0.7}>
                <Text style={styles.btnTextUnhide}>恢复显示</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── 已提交 / 已过期 模式 ──
  if (isActuallySubmitted || (isPast && !forceShowActions)) {
    return (
      <View style={styles.cardOuterWrapper}>
        <TouchableOpacity 
          style={[styles.card, styles.cardSubmitted]} 
          onPress={handleOpenInBrowser}
          activeOpacity={0.7}
        >
          <View>
            <View style={styles.submittedContainer}>
              <Text style={styles.courseTagSubmitted} numberOfLines={1}>{assignment.course_name}</Text>
              <Text style={[styles.titleSubmitted, isPast && !isActuallySubmitted ? styles.titlePast : null]} numberOfLines={1}>{assignment.name}</Text>
              {isActuallySubmitted ? (
                <><MaterialIcons name="check-circle" size={14} color="#43A047" style={{ marginRight: 4 }} /><Text style={styles.statusBadge}>已完成</Text></>
              ) : (
                <><MaterialIcons name="pause-circle" size={14} color="#90A4AE" style={{ marginRight: 4 }} /><Text style={styles.expiredBadge}>已过期</Text></>
              )}
            </View>
            {footerDateStr && (
              <Text style={{ fontSize: 11, color: '#999', textAlign: 'right', marginTop: 2, marginRight: 2 }}>{footerDateStr}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── 活跃（未提交未过期）模式 ──（5个hooks全部在上面声明完毕，这里安全）
  return (
    <View style={styles.glowWrapper}>
      
      {/* 【半透明莫兰迪硬垫底】
          1. 严格对齐固定参数：top: 3, bottom: 3, left: 10, right: 10
          2. 不透明度维持在 0.38。搭配上新设计的重彩颜色，白卡片上下漏出来的彩色区域
             会展现出极其利落、沉稳的视觉标签感，既能一眼看清紧急程度，又有极高的高级审美感。
      */}
      {urgency !== 'none' && (
        <View style={[styles.pureColorBase, { backgroundColor: glowColor }]} />
      )}

      <TouchableOpacity 
        style={dynamicCardStyle}
        onPress={handleOpenInBrowser}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <View style={[styles.courseBadge, { backgroundColor: courseColor }]}>
            <Text style={styles.courseName}>{assignment.course_name || '未知课程'}</Text>
          </View>
          {renderDate(assignment.display_date || null, dateLabel, !isAnnouncement)}
        </View>
        
        <Text style={styles.title}>{assignment.name}</Text>
        
        {isAnnouncement && onAnnounceAction ? (
          <View style={styles.announcementActions}>
            <MaterialIcons name="push-pin" size={14} color="#607D8B" style={{ marginRight: 4, marginBottom: 4 }} /><Text style={styles.announcementText}>这是一个无须提交的公告/任务</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => onAnnounceAction('hide')}>
                <Text style={styles.btnTextSecondary}>取消显示</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => onAnnounceAction('todo')}>
                <Text style={styles.btnTextPrimary}>加入待办</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.footer}>
            {isOnPaper ? (
              <TouchableOpacity style={styles.manualCheckRow} onPress={handleManualToggle} activeOpacity={0.7}>
                <MaterialIcons
                  name={manualDone ? 'check-box' : 'check-box-outline-blank'}
                  size={20}
                  color={manualDone ? '#43A047' : '#90A4AE'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.manualCheckText, manualDone && styles.manualCheckTextDone]}>
                  {manualDone ? '已完成书面提交' : '标记为已书面提交'}
                </Text>
              </TouchableOpacity>
            ) : (
              <><MaterialIcons name="warning" size={14} color="#FF8C00" style={{ marginRight: 4 }} /><Text style={styles.unsubmittedBadge}>待完成，点击前往</Text></>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardOuterWrapper: {
    paddingHorizontal: 10,
  },
  glowWrapper: {
    position: 'relative',
    paddingHorizontal: 10, 
    paddingVertical: 5,    
    overflow: 'visible',
  },
  // 严格固定参数的纯色利落底座
  pureColorBase: {
    position: 'absolute',
    top: 2,               // 锁定上下
    bottom: 2,            
    left: 6,             // 锁定左右
    right: 6,            
    borderRadius: 15,     
    opacity: 0.65,        // 完美的半透明纸张重叠感
  },
  card: {
    backgroundColor: '#FFF',
    padding: 14,           
    borderRadius: 12,
    // 仅保留微弱的物理黑阴影提供下沉立体感，避免卡片死板
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardSubmitted: {
    padding: 12,
    backgroundColor: '#FAFAFA',
    opacity: 0.8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  submittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,       
  },
  courseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  courseName: {
    color: '#FFF',
    fontSize: 11,          
    fontWeight: 'bold',
  },
  courseTagSubmitted: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  urgentTimeText: {
    color: '#D10000',
    fontWeight: '900',
    fontSize: 13,
  },
  title: {
    fontSize: 16,          
    fontWeight: '600',
    color: '#222',
    lineHeight: 22,
  },
  titleSubmitted: {
    fontSize: 14,
    color: '#555',
    textDecorationLine: 'line-through',
    flex: 2,
    paddingHorizontal: 10,
  },
  titlePast: {
    textDecorationLine: 'none',
    color: '#888',
  },
  statusBadge: {
    fontSize: 12,
    color: '#34A853',
    fontWeight: 'bold',
  },
  expiredBadge: {
    fontSize: 12,
    color: '#BDBDBD',
    fontWeight: 'bold',
  },
  unsubmittedBadge: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: 'bold',
  },
  manualCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  manualCheckText: {
    fontSize: 13,
    color: '#546E7A',
  },
  manualCheckTextDone: {
    color: '#43A047',
    textDecorationLine: 'line-through',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  announcementActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#EEE',
  },
  announcementText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#0055A8',
    borderRadius: 6,
    alignItems: 'center',
  },
  btnTextSecondary: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  btnTextPrimary: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  btnUnhide: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  btnTextUnhide: {
    color: '#0055A8',
    fontSize: 12,
    fontWeight: '600',
  },
});