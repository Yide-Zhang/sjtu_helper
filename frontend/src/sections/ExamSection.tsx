import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getCourseColor } from '../utils/colors';
import { sectionStyles as s } from './sectionStyles';

type ExamUrgency = 'none' | 'yellow' | 'orange' | 'red';

const safeTime = (s: string | undefined | null): number => {
  if (!s) return Infinity;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})\((\d{2}:\d{2})/);
  if (m) { const d = new Date(m[1] + 'T' + m[2]); if (!isNaN(d.getTime())) return d.getTime(); }
  const d = new Date(s.substring(0, 10));
  return isNaN(d.getTime()) ? Infinity : d.getTime();
};

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

interface ExamItem {
  kssj?: string;
  kcmc?: string;
  cdmc?: string;
}

interface Props {
  navigation: any;
  hasJAccountCreds: boolean | null;
  upcomingExams: ExamItem[];
}

export const ExamSection: React.FC<Props> = ({ navigation, hasJAccountCreds, upcomingExams }) => (
  <TouchableOpacity style={s.section} onPress={() => navigation.navigate('Exams')} activeOpacity={0.7}>
    <View style={s.sectionHeader}>
      <MaterialIcons name="edit-note" size={16} color="#E65100" />
      <Text style={s.sectionTitle}>考试</Text>
    </View>
    {hasJAccountCreds === false ? (
      <View style={s.sectionCard}>
        <View style={s.guideRow}>
          <MaterialIcons name="info-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
          <Text style={s.guideText}>未设置 jAccount，前去填写</Text>
        </View>
      </View>
    ) : upcomingExams.length === 0 ? (
      <View style={s.sectionCard}><Text style={s.cmain}>本学期暂无考试</Text></View>
    ) : upcomingExams.map((e, i) => {
        const t = safeTime(e.kssj), d = t !== Infinity ? new Date(t) : null;
        const timeRange = e.kssj?.match(/\((\d{2}:\d{2}-\d{2}:\d{2})\)/)?.[1] || '';
        const examUrgency = getExamUrgency(e.kssj);
        const examGlowColor = EXAM_URGENCY_COLORS[examUrgency];
        return (
          <View key={i} style={[s.examGlowWrapper, i < upcomingExams.length - 1 && { marginBottom: 6 }]}>
            {examUrgency !== 'none' && (
              <View style={[s.examPureColorBase, { backgroundColor: examGlowColor }]} />
            )}
            <View style={s.sectionCard}>
              <View style={[s.courseBadgeSmall, { backgroundColor: getCourseColor(e.kcmc) }]}>
                <Text style={s.courseBadgeText} numberOfLines={1}>{e.kcmc}</Text>
              </View>
              <View style={s.examMetaRow}>
                <Text style={s.csub}>{d ? `${d.getMonth() + 1}/${d.getDate()}` : ''}</Text>
                {timeRange ? <Text style={s.csub}>{timeRange}</Text> : null}
              </View>
              {e.cdmc ? <Text style={s.clocation}>{e.cdmc}</Text> : null}
            </View>
          </View>
        );
      })}
  </TouchableOpacity>
);
