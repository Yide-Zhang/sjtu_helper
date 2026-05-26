import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { sectionStyles as s } from './sectionStyles';

interface Props {
  navigation: any;
  hasJAccountCreds: boolean | null;
  jaccountSessionAlive: boolean | null;
  scheduleInfo: string;
  scheduleDetail: string;
  scheduleBadge: string;
  scheduleCourse: string;
  nextCourseName: string;
  nextCourseDetail: string;
}

export const ScheduleSection: React.FC<Props> = ({
  navigation, hasJAccountCreds, jaccountSessionAlive,
  scheduleInfo, scheduleDetail, scheduleBadge,
  scheduleCourse, nextCourseName, nextCourseDetail,
}) => (
  <TouchableOpacity style={s.section} onPress={hasJAccountCreds ? () => navigation.navigate('Schedule') : () => navigation.navigate('Settings')} activeOpacity={0.7}>
    <View style={s.sectionHeader}>
      <MaterialIcons name="calendar-today" size={16} color="#4CAF50" />
      <Text style={s.sectionTitle}>课表</Text>
    </View>
    {scheduleInfo === '今天的课都上完了~' || scheduleInfo === '今天没课~' ? (
      <>
        <Text style={[s.cmain, { paddingHorizontal: 2 }]}>{scheduleInfo}</Text>
        {scheduleDetail === '这是今天最后一节课啦~' ? <Text style={[s.csub, { paddingHorizontal: 2 }]}>{scheduleDetail}</Text> : null}
      </>
    ) : scheduleBadge === '现在' && nextCourseName ? (
      <>
        <View style={s.sectionCard}>
          <View style={s.scheduleRow}>
            <View style={[s.scheduleBadge, s.scheduleBadgeNow]}>
              <Text style={s.scheduleBadgeText}>现在</Text>
            </View>
            <Text style={[s.cmain, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">{scheduleCourse}</Text>
          </View>
        </View>
        <View style={[s.sectionCard, { marginTop: 6 }]}>
          <View style={s.scheduleRow}>
            <View style={[s.scheduleBadge, s.scheduleBadgeNext]}>
              <Text style={s.scheduleBadgeText}>下节</Text>
            </View>
            <Text style={[s.cmain, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">{nextCourseName}</Text>
          </View>
          {nextCourseDetail ? <Text style={[s.csub, { marginTop: 4 }]} numberOfLines={1} ellipsizeMode="tail">{nextCourseDetail}</Text> : null}
        </View>
      </>
    ) : scheduleBadge === '现在' && scheduleDetail === '这是今天最后一节课啦~' ? (
      <>
        <View style={s.sectionCard}>
          <View style={s.scheduleRow}>
            <View style={[s.scheduleBadge, s.scheduleBadgeNow]}>
              <Text style={s.scheduleBadgeText}>现在</Text>
            </View>
            <Text style={[s.cmain, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">{scheduleCourse}</Text>
          </View>
        </View>
        <Text style={[s.csub, { paddingHorizontal: 2, marginTop: 6 }]}>{scheduleDetail}</Text>
      </>
    ) : (
      <View style={s.sectionCard}>
        {hasJAccountCreds === false ? (
          <View style={s.guideRow}>
            <MaterialIcons name="info-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
            <Text style={s.guideText}>未设置 jAccount，前去填写</Text>
          </View>
        ) : jaccountSessionAlive === false ? (
          <TouchableOpacity style={s.guideRow} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
            <MaterialIcons name="sync-problem" size={14} color="#E53935" style={{ marginRight: 4 }} />
            <Text style={[s.guideText, { color: '#E53935' }]}>登录失效，点击检查凭据</Text>
          </TouchableOpacity>
        ) : scheduleBadge ? (
          <View style={s.scheduleRow}>
            <View style={[s.scheduleBadge, scheduleBadge === '现在' ? s.scheduleBadgeNow : s.scheduleBadgeNext]}>
              <Text style={s.scheduleBadgeText}>{scheduleBadge}</Text>
            </View>
            <Text style={[s.cmain, { flexShrink: 1 }]} numberOfLines={2} ellipsizeMode="tail">{scheduleCourse}</Text>
          </View>
        ) : (
          <Text style={s.cmain} numberOfLines={1} ellipsizeMode="tail">{scheduleInfo}</Text>
        )}
        {scheduleDetail && scheduleDetail !== '这是今天最后一节课啦~' ? <Text style={s.csub} numberOfLines={1} ellipsizeMode="tail">{scheduleDetail}</Text> : null}
      </View>
    )}
  </TouchableOpacity>
);
