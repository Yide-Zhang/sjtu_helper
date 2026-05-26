import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { AssignmentSummaryCard } from '../components/CardViews';
import { getCourseColor } from '../utils/colors';
import { sectionStyles as s } from './sectionStyles';
import type { CanvasAssignment } from '../api/canvas';

type ExamUrgency = 'none' | 'yellow' | 'orange' | 'red';

const formatDateDiff = (dateStr: string): string => {
  const now = new Date(), target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return '已截止';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} 天后`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours} 小时后`;
  return `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')} 截止`;
};

interface Props {
  navigation: any;
  hasCanvasToken: boolean | null;
  upcomingAssigns: CanvasAssignment[];
}

export const AssignmentSection: React.FC<Props> = ({ navigation, hasCanvasToken, upcomingAssigns }) => (
  <TouchableOpacity style={s.section} onPress={() => navigation.navigate('Assignments')} activeOpacity={0.7}>
    <View style={s.sectionHeader}>
      <MaterialIcons name="list-alt" size={16} color="#0055A8" />
      <Text style={s.sectionTitle}>作业</Text>
    </View>
    {hasCanvasToken === false ? (
      <View style={s.sectionCard}>
        <View style={s.guideRow}>
          <MaterialIcons name="info-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
          <Text style={s.guideText}>未设置 Canvas Token，前去填写</Text>
        </View>
      </View>
    ) : upcomingAssigns.length === 0 ? (
      <View style={s.sectionCard}><Text style={s.cmain}>暂无待办作业</Text></View>
    ) : upcomingAssigns.map((a, i) => {
        const dueTime = a.display_date ? new Date(a.display_date).getTime() : Infinity;
        const diff = dueTime - Date.now();
        let assignUrgency: ExamUrgency = 'none';
        if (dueTime !== Infinity && diff > 0) {
          const hours = diff / (1000 * 60 * 60);
          if (hours <= 1) assignUrgency = 'red';
          else if (hours <= 24) assignUrgency = 'orange';
          else if (hours <= 72) assignUrgency = 'yellow';
        }
        return (
          <View key={i} style={i < upcomingAssigns.length - 1 ? { marginBottom: 6 } : undefined}>
            <AssignmentSummaryCard
              course={a.course_name || '未知课程'}
              name={a.name || '未命名作业'}
              dateDiff={formatDateDiff(a.display_date!)}
              courseColor={getCourseColor(a.course_name)}
              urgency={assignUrgency}
            />
          </View>
        );
      })}
  </TouchableOpacity>
);
