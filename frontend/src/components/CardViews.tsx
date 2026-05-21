import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

// ── 课表卡片 ──

/** 单卡片：一个 badge + 课程名 + 下方详情 */
export const ScheduleSingleCard = ({
  badge,
  badgeColor,
  course,
  detail,
}: {
  badge: string;
  badgeColor: string;
  course: string;
  detail?: string;
}) => (
  <View style={cardStyles.sectionCard}>
    <View style={cardStyles.scheduleRow}>
      <View style={[cardStyles.scheduleBadge, { backgroundColor: badgeColor }]}>
        <Text style={cardStyles.scheduleBadgeText}>{badge}</Text>
      </View>
      <Text style={[cardStyles.cmain, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">{course}</Text>
    </View>
    {detail ? <Text style={cardStyles.csub} numberOfLines={1} ellipsizeMode="tail">{detail}</Text> : null}
  </View>
);

// ── 考试卡片 ──

// 简单的基于课程名的颜色生成
const courseColor = (name: string) => {
  const colors = ['#E3F2FD', '#E8F5E9', '#F3E5F5', '#FFF3E0', '#FFEBEE', '#FCE4EC', '#E0F7FA', '#F1F8E9', '#FFF8E1', '#FBE9E7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const ExamCard = ({
  course,
  date,
  timeRange,
  location,
}: {
  course: string;
  date: string;
  timeRange: string;
  location?: string;
}) => (
  <View style={cardStyles.sectionCard}>
    <View style={[cardStyles.courseBadgeSmall, { backgroundColor: courseColor(course), alignSelf: 'flex-start' }]}>
      <Text style={[cardStyles.courseBadgeText, { color: '#333' }]} numberOfLines={1}>{course}</Text>
    </View>
    <View style={[cardStyles.examMetaRow, { marginTop: 6 }]}>
      <Text style={cardStyles.csub}>{date}</Text>
      {timeRange ? <Text style={cardStyles.csub}>{timeRange}</Text> : null}
    </View>
    {location ? <Text style={cardStyles.clocation}>{location}</Text> : null}
  </View>
);

// ── 通知卡片 ──

/** 普通通知（暗色半透明） */
export const MinorNoticeCard = ({
  title,
  date,
}: {
  title: string;
  date: string;
}) => (
  <View style={cardStyles.notifMinorCard}>
    <View style={cardStyles.notifItemRow}>
      <Text style={cardStyles.citem} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
    </View>
    <Text style={cardStyles.csub}>{date}</Text>
  </View>
);

/** 带边框和左侧装饰的醒目通知（选课/评教） */
export const HighlightNoticeCard = ({
  iconName,
  iconColor,
  borderColor,
  label,
  children,
}: {
  iconName: string;
  iconColor: string;
  borderColor: string;
  label: string;
  children: React.ReactNode;
}) => (
  <View style={[cardStyles.sectionCard, { borderLeftWidth: 3, borderLeftColor: borderColor, marginBottom: 6 }]}>
    <View style={cardStyles.notifItemRow}>
      <MaterialIcons name={iconName as any} size={14} color={iconColor} style={{ marginRight: 4 }} />
      <Text style={[cardStyles.citem, { fontWeight: '700', color: iconColor }]}>{label}</Text>
    </View>
    {children}
  </View>
);

/** 带小 badge 的通知卡片 */
export const BadgeNoticeCard = ({
  title,
  badge,
  badgeColor,
  date,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  date: string;
}) => (
  <View style={cardStyles.sectionCard}>
    <View style={cardStyles.notifItemRow}>
      <Text style={cardStyles.citem} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
      <View style={[cardStyles.notifBadge, { backgroundColor: badgeColor + '18' }]}>
        <Text style={[cardStyles.notifBadgeText, { color: badgeColor }]}>{badge}</Text>
      </View>
    </View>
    <Text style={cardStyles.csub}>{date}</Text>
  </View>
);

// ── 作业卡片（摘要版） ──

const URGENCY_BASE_COLORS: Record<string, string> = {
  none: 'transparent',
  yellow: '#f5d741',
  orange: '#e69334',
  red: '#CD2026',
};

export const AssignmentSummaryCard = ({
  course,
  name,
  dateDiff,
  courseColor,
  urgency = 'none',
}: {
  course: string;
  name: string;
  dateDiff: string;
  courseColor: string;
  urgency?: 'none' | 'yellow' | 'orange' | 'red';
}) => (
  <View style={cardStyles.examGlowWrapper}>
    {urgency !== 'none' && (
      <View style={[cardStyles.examPureColorBase, { backgroundColor: URGENCY_BASE_COLORS[urgency] }]} />
    )}
    <View style={cardStyles.sectionCard}>
      <View style={[cardStyles.courseBadgeSmall, { backgroundColor: courseColor }]}>
        <Text style={cardStyles.courseBadgeText} numberOfLines={1}>{course}</Text>
      </View>
      <Text style={cardStyles.citem} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
      <Text style={cardStyles.csub}>{dateDiff}</Text>
    </View>
  </View>
);

// ── 公告卡片（摘要版） ──

export const AnnouncementSummaryCard = ({
  title,
  course,
}: {
  title: string;
  course?: string;
}) => (
  <View style={cardStyles.sectionCard}>
    <Text style={cardStyles.citem} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
    {course ? <Text style={cardStyles.csub}>{course}</Text> : null}
  </View>
);

// ── 邮箱卡片 ──

export const MailErrorCard = ({
  message,
}: {
  message: string;
}) => (
  <View style={cardStyles.sectionCard}>
    <View style={cardStyles.guideRow}>
      <MaterialIcons name="sync-problem" size={14} color="#E53935" style={{ marginRight: 4 }} />
      <Text style={cardStyles.guideText}>{message}</Text>
    </View>
  </View>
);

// ── 共享样式（与 MainScreen 保持一致） ──

export const cardStyles = StyleSheet.create({
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
  citem: { fontSize: 12, color: '#555', marginTop: 2, lineHeight: 18 },
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
  scheduleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  scheduleBadgeNow: { backgroundColor: '#4CAF50' },
  scheduleBadgeNext: { backgroundColor: '#FF9800' },
  scheduleBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
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
  notifBadgeText: { fontSize: 10, fontWeight: '700' },
  notifItemRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  guideRow: { flexDirection: 'row', alignItems: 'center' },
  guideText: { fontSize: 12, color: '#888' },
  courseBadgeSmall: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  courseBadgeText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
});
