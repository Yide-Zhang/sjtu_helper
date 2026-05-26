import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { sectionStyles as s } from './sectionStyles';

interface Props {
  navigation: any;
  hasCanvasToken: boolean | null;
  recentAnnouncement: { name?: string; course_name?: string } | null;
}

export const AnnouncementSection: React.FC<Props> = ({ navigation, hasCanvasToken, recentAnnouncement }) => (
  <TouchableOpacity style={s.section} onPress={hasCanvasToken ? () => navigation.navigate('Announcements') : () => navigation.navigate('Settings')} activeOpacity={0.7}>
    <View style={s.sectionHeader}>
      <MaterialIcons name="campaign" size={16} color="#E65100" />
      <Text style={s.sectionTitle}>公告</Text>
    </View>
    <View style={s.sectionCard}>
      {hasCanvasToken === false ? (
        <View style={s.guideRow}>
          <MaterialIcons name="info-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
          <Text style={s.guideText}>未设置 Canvas Token，前去填写</Text>
        </View>
      ) : recentAnnouncement ? (
        <>
          <Text style={s.citem}>{recentAnnouncement.name?.substring(0, 30)}</Text>
          {recentAnnouncement.course_name ? <Text style={s.csub}>{recentAnnouncement.course_name}</Text> : null}
        </>
      ) : (
        <Text style={s.cmain}>浏览课程公告与通知</Text>
      )}
    </View>
  </TouchableOpacity>
);
