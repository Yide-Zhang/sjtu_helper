import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  ScheduleSingleCard,
  ExamCard,
  MinorNoticeCard,
  HighlightNoticeCard,
  BadgeNoticeCard,
  AssignmentSummaryCard,
  AnnouncementSummaryCard,
  MailErrorCard,
  cardStyles,
} from '../components/CardViews';

const LONG_COURSE = '习近平新时代中国特色社会主义思想概论（2025-2026学年第二学期）A';
const LONG_COURSE2 = '大数据技术与人工智能应用实践（含实验）';
const LONG_EXAM = '高等数学（工科）I-A 类期末统一考试';
const LONG_NOTICE = '上海交通大学关于2025-2026学年第二学期本科教学安排调整及课程退改选相关事宜的通知';
const LONG_NOTICE2 = '上海交通大学2026年暑期小学期本科生选课及课程安排通知';

// ── 考试紧急度计算（与 MainScreen 保持一致） ──
const safeTime = (s: string | undefined | null): number => {
  if (!s) return Infinity;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})\((\d{2}:\d{2})/);
  if (m) { const d = new Date(m[1] + 'T' + m[2]); if (!isNaN(d.getTime())) return d.getTime(); }
  const d = new Date(s.substring(0, 10));
  return isNaN(d.getTime()) ? Infinity : d.getTime();
};

type ExamUrgency = 'none' | 'yellow' | 'orange' | 'red';

const getExamUrgency = (kssj: string | undefined | null): ExamUrgency => {
  const t = safeTime(kssj);
  if (t === Infinity) return 'none';
  const diff = t - Date.now();
  if (diff <= 0) return 'none';
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 24) return 'red';
  if (hours <= 72) return 'orange';
  if (hours <= 168) return 'yellow';
  return 'none';
};

const EXAM_URGENCY_COLORS: Record<ExamUrgency, string> = {
  none: '#F0F0F0',
  yellow: '#f5d741',
  orange: '#e69334',
  red: '#CD2026',
};

export const RenderTestScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>渲染测试</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.sections}>
        <View style={{ flexDirection: 'row', marginLeft: -5, marginRight: -5 }}>
          {/* 左列 */}
          <View style={{ flex: 1, paddingHorizontal: 5, gap: 12 }}>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="calendar-today" size={16} color="#4CAF50" />
                <Text style={styles.sectionTitle}>课表</Text>
              </View>
              {/* 场景1：有现在 + 有下节 → 现在卡片无detail，下节卡片有时间地点 */}
              <ScheduleSingleCard
                badge="现在"
                badgeColor="#4CAF50"
                course={LONG_COURSE}
              />
              <View style={{ marginTop: 6 }}>
                <ScheduleSingleCard
                  badge="下节"
                  badgeColor="#FF9800"
                  course={LONG_COURSE2}
                  detail="10:00  东中院4-201"
                />
              </View>
              {/* 场景2：只有下节 */}
              <View style={{ marginTop: 6 }}>
                <ScheduleSingleCard
                  badge="下节"
                  badgeColor="#FF9800"
                  course={LONG_COURSE}
                  detail="10:00  东上院101"
                />
              </View>
              {/* 场景3：现在是最后一节 → 卡片 + 底部衬块文字 */}
              <View style={{ marginTop: 6 }}>
                <ScheduleSingleCard
                  badge="现在"
                  badgeColor="#4CAF50"
                  course={LONG_COURSE2}
                />
              </View>
              <Text style={[{ fontSize: 12, color: '#888', marginTop: 6, paddingHorizontal: 2 }]}>这是今天最后一节课啦~</Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="edit-note" size={16} color="#E65100" />
                <Text style={styles.sectionTitle}>考试</Text>
              </View>
              {(() => {
                const nowTime = Date.now();
                const pad2 = (n: number) => n.toString().padStart(2, '0');
                const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
                const makeKssj = (offsetHours: number) => {
                  const start = new Date(nowTime + offsetHours * 3600000);
                  const end = new Date(start.getTime() + 2 * 3600000);
                  return `${fmtDate(start)}(${fmtTime(start)}-${fmtTime(end)})`;
                };
                const items = [
                  { label: '12h后（红色＜24h）', kssj: makeKssj(12), cdmc: '东上院101' },
                  { label: '60h后（橙色＜72h）', kssj: makeKssj(60), cdmc: '东中院4-201' },
                  { label: '156h后（黄色＜168h）', kssj: makeKssj(156), cdmc: '东下院301' },
                  { label: LONG_COURSE, kssj: '2026-06-30(08:00-10:00)', cdmc: '东上院101' },
                  { label: LONG_EXAM, kssj: '2026-07-02(13:00-15:00)', cdmc: '东中院4-201' },
                  { label: '大学英语（三）', kssj: '2026-07-05(09:00-11:00)', cdmc: '东下院301' },
                ];
                return items.map((e, i) => {
                  const timeRange = e.kssj.match(/\((\d{2}:\d{2}-\d{2}:\d{2})\)/)?.[1] || '';
                  const d = new Date(e.kssj.substring(0, 10));
                  const urgency = getExamUrgency(e.kssj);
                  const glowColor = EXAM_URGENCY_COLORS[urgency];
                  return (
                    <View key={i} style={[styles.examGlowWrapper, { marginBottom: 6 }]}>
                      {urgency !== 'none' && (
                        <View style={[styles.examPureColorBase, { backgroundColor: glowColor }]} />
                      )}
                      <ExamCard
                        course={e.label}
                        date={d ? `${d.getMonth() + 1}/${d.getDate()}` : ''}
                        timeRange={timeRange}
                        location={e.cdmc}
                      />
                    </View>
                  );
                });
              })()}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="email" size={16} color="#1A73E8" />
                <Text style={styles.sectionTitle}>邮箱</Text>
              </View>
              <MailErrorCard message="邮箱登录失败，请检查凭据" />
            </View>
          </View>

          {/* 右列 */}
          <View style={{ flex: 1, paddingHorizontal: 5, gap: 12 }}>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="campaign" size={16} color="#E65100" />
                <Text style={styles.sectionTitle}>公告</Text>
              </View>
              <AnnouncementSummaryCard
                title={`关于${LONG_COURSE}课程期末考试时间调整的通知`}
                course={LONG_COURSE2}
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="list-alt" size={16} color="#0055A8" />
                <Text style={styles.sectionTitle}>作业</Text>
              </View>
              {(() => {
                const nowTime = Date.now();
                const pad2 = (n: number) => n.toString().padStart(2, '0');
                const computeUrgency = (ts: number): 'none' | 'yellow' | 'orange' | 'red' => {
                  const diff = ts - Date.now();
                  if (diff <= 0) return 'none';
                  const hours = diff / (1000 * 60 * 60);
                  if (hours <= 1) return 'red';
                  if (hours <= 24) return 'orange';
                  if (hours <= 72) return 'yellow';
                  return 'none';
                };
                const fmtDateDiff = (ts: number): string => {
                  const diff = ts - Date.now();
                  if (diff <= 0) return '已截止';
                  const days = Math.floor(diff / 86400000);
                  if (days > 0) return `${days} 天后`;
                  const hours = Math.floor(diff / 3600000);
                  if (hours > 0) return `${hours} 小时后`;
                  return `${pad2(new Date(ts).getHours())}:${pad2(new Date(ts).getMinutes())} 截止`;
                };
                const items = [
                  // 按截止时间升序（最近的最优先）
                  { course: '30min后（红色＜1h）', name: 'SJTU Helper - 第1次作业', dueTs: nowTime + 0.5 * 3600000, courseColor: '#FFEBEE' },
                  { course: '23.5h后（橙色＜24h）', name: 'SJTU Helper - 第2次作业', dueTs: nowTime + 23.5 * 3600000, courseColor: '#FFF3E0' },
                  { course: LONG_COURSE2, name: `${LONG_COURSE} - 课程论文提交`, dueTs: new Date('2026-05-22T23:59:00').getTime(), courseColor: '#FFF3E0' },
                  { course: '71.5h后（黄色＜72h）', name: 'SJTU Helper - 第3次作业', dueTs: nowTime + 71.5 * 3600000, courseColor: '#FFF8E1' },
                  { course: LONG_COURSE, name: `${LONG_COURSE2} - 第三次实验报告（数据分析与可视化）`, dueTs: new Date('2026-05-24T23:59:00').getTime(), courseColor: '#E3F2FD' },
                ];
                return items.map((item, i) => {
                  const urgency = computeUrgency(item.dueTs);
                  const dateDiff = fmtDateDiff(item.dueTs);
                  return (
                    <View key={i} style={{ marginBottom: 6 }}>
                      <AssignmentSummaryCard
                        course={item.course}
                        name={item.name}
                        dateDiff={dateDiff}
                        courseColor={item.courseColor}
                        urgency={urgency}
                      />
                    </View>
                  );
                });
              })()}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="school" size={16} color="#7B1FA2" />
                <Text style={styles.sectionTitle}>教务通知</Text>
              </View>
              <HighlightNoticeCard
                iconName="bookmark"
                iconColor="#E65100"
                borderColor="#E65100"
                label="选课通知"
              >
                <Text style={[cardStyles.csub, { fontWeight: '600', marginTop: 4 }]}>2025-2026 学年 春季选课</Text>
                <Text style={[cardStyles.csub, { fontSize: 11, color: '#888', marginTop: 2 }]}>
                  第一轮抢选：2026-01-06 09:00 ~ 2026-01-08 16:00
                </Text>
              </HighlightNoticeCard>
              <HighlightNoticeCard
                iconName="rate-review"
                iconColor="#6A1B9A"
                borderColor="#6A1B9A"
                label="评教通知"
              >
                <Text style={[cardStyles.citem, { marginTop: 4 }]} numberOfLines={1} ellipsizeMode="tail">{LONG_NOTICE2}</Text>
                <Text style={[cardStyles.csub, { color: '#C62828', fontWeight: '600', marginTop: 2 }]}>
                  截止：2026-06-20 23:59
                </Text>
              </HighlightNoticeCard>
              <View style={{ marginBottom: 6 }}>
                <MinorNoticeCard title={LONG_NOTICE} date="2026-05-20" />
              </View>
              <BadgeNoticeCard
                title={`调课提醒:李老师于第8周周三第1-2节在东上院101上的${LONG_COURSE}课程调课到由王老师在第9周周三第3-4节东中院4-201上`}
                badge="调课"
                badgeColor="#E65100"
                date="2026-05-18"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#0055A8',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#FFF', textAlign: 'center' },
  scroll: { flex: 1 },
  sections: { padding: 12, paddingBottom: 40 },
  section: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 14,
    padding: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#666', marginLeft: 5 },
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
});
