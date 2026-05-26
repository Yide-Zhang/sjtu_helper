import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getRecentReviews, ReviewWithCourse } from '../api/courseCommunity';
import { sectionStyles as s } from './sectionStyles';

interface Props {
  navigation: any;
}

const CATEGORY_COLORS: Record<string, string> = {
  '工程科学与技术': '#1565C0',
  '体育': '#F4511E',
  '社会科学': '#2E7D32',
  '研究生': '#6A1B9A',
  '自然科学': '#00838F',
  '通选': '#0D47A1',
  '新生研讨': '#E65100',
  '艺术修养': '#C62828',
  '人文学科': '#4E342E',
};

const getCategoryColor = (cat: string): string => {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (cat.includes(key)) return color;
  }
  return '#757575';
};

const renderStars = (r: number) => {
  const full = Math.floor(r);
  const half = r - full >= 0.5;
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) stars.push(<MaterialIcons key={i} name="star" size={12} color="#FFB800" />);
    else if (i === full && half) stars.push(<MaterialIcons key={i} name="star-half" size={12} color="#FFB800" />);
    else stars.push(<MaterialIcons key={i} name="star-outline" size={12} color="#FFB800" />);
  }
  return stars;
};

export const CommunitySection: React.FC<Props> = ({ navigation }) => {
  const [reviews, setReviews] = useState<ReviewWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getRecentReviews(2);
        if (!cancelled) setReviews(data);
      } catch (e) {
        console.warn('[CommunitySection] 加载失败:', e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []));

  return (
    <TouchableOpacity style={s.section} onPress={() => navigation.navigate('CommunityReview')} activeOpacity={0.7}>
      <View style={s.sectionHeader}>
        <MaterialIcons name="forum" size={16} color="#0055A8" />
        <Text style={s.sectionTitle}>选课社区</Text>
        <MaterialIcons name="chevron-right" size={18} color="#999" style={{ marginLeft: 'auto' }} />
      </View>
      {loading ? (
        <View style={[s.sectionCard, { alignItems: 'center', paddingVertical: 16 }]}>
          <ActivityIndicator size="small" color="#0055A8" />
        </View>
      ) : reviews.length === 0 ? (
        <View style={s.sectionCard}>
          <Text style={s.cmain}>暂无最新评价</Text>
        </View>
      ) : reviews.map((rv, i) => {
        const cats = rv.course.categories || [];
        const primaryCat = cats[0] || '';
        const catColor = getCategoryColor(primaryCat);
        return (
          <View key={rv.id} style={[s.sectionCard, i < reviews.length - 1 && { marginBottom: 6 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={[s.courseBadgeSmall, { backgroundColor: '#0055A8' }]}>
                <Text style={s.courseBadgeText} numberOfLines={1}>{rv.course.code}</Text>
              </View>
              {primaryCat ? (
                <View style={{ backgroundColor: catColor, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>{primaryCat}</Text>
                </View>
              ) : null}
              <Text style={[s.csub, { marginLeft: 6, flex: 1 }]} numberOfLines={1}>{rv.course.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              {renderStars(rv.rating)}
              <Text style={[s.csub, { marginLeft: 6 }]}>{rv.course.teacher}</Text>
            </View>
            {rv.comment ? (
              <Text style={[s.citem, { fontSize: 12 }]} numberOfLines={2}>{rv.comment}</Text>
            ) : null}
          </View>
        );
      })}
    </TouchableOpacity>
  );
};
