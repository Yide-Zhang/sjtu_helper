import { StyleSheet } from 'react-native';

export const sectionStyles = StyleSheet.create({
  section: {
    backgroundColor: 'rgba(0,0,0,0.10)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#333',
    marginLeft: 6,
  },
  sectionCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 10,
  },
  cmain: {
    fontSize: 14,
    color: '#333',
  },
  csub: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  citem: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600' as const,
  },
  guideRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  guideText: {
    fontSize: 13,
    color: '#FF8C00',
  },
  // 课表
  scheduleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  scheduleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: '#E0E0E0',
  },
  scheduleBadgeNow: {
    backgroundColor: '#4CAF50',
  },
  scheduleBadgeNext: {
    backgroundColor: '#FF9800',
  },
  scheduleBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  // 邮箱
  mailFromRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
  },
  mailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CCC',
    marginRight: 6,
  },
  mailDotUnread: {
    backgroundColor: '#1A73E8',
  },
  unreadBadge: {
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 'auto' as const,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  // 考试
  examGlowWrapper: {
    position: 'relative' as const,
  },
  examPureColorBase: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.15,
  },
  courseBadgeSmall: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  courseBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  examMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 2,
  },
  clocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  // 教务通知
  notifItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  notifBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  notifBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  notifMinorCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 8,
  },
});
