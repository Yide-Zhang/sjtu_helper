import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRecentReviews, loginCommunity, ReviewWithCourse } from '../api/courseCommunity';
import { getJAccountUsername, getCommunityPassword } from '../utils/storage';
import { sectionStyles as s } from './sectionStyles';

const CACHE_KEY = 'COMMUNITY_SECTION_CACHE';

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
  const [hasCreds, setHasCreds] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    (async () => {
      // 0. 检查凭据
      const jUser = await getJAccountUsername();
      const cPwd = await getCommunityPassword();
      const credsOk = !!(jUser && cPwd);
      if (cancelled) return;
      setHasCreds(credsOk);
      if (!credsOk) {
        setLoading(false);
        return;
      }

      // 1. 先读缓存
      try {
        const cachedJson = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedJson && !cancelled) {
          const parsed = JSON.parse(cachedJson) as ReviewWithCourse[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setReviews(parsed);
            setLoading(false);
          }
        }
      } catch {}

      // 2. 取网络数据
      try {
        let data = await getRecentReviews(2);
        // 如果没取到，尝试重新登陆后再取一次（会话过期场景）
        if (!data || data.length === 0) {
          const relogged = await loginCommunity();
          if (relogged) {
            data = await getRecentReviews(2);
          }
        }
        if (cancelled) return;

        if (data && data.length > 0) {
          setReviews(data);
          const cachedJson = await AsyncStorage.getItem(CACHE_KEY);
          const cached = cachedJson ? JSON.parse(cachedJson) as ReviewWithCourse[] : null;
          const changed = !cached || JSON.stringify(cached) !== JSON.stringify(data);
          if (changed) {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
          }
        }
      } catch (e) {
        console.warn('[CommunitySection] 加载失败:', e);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // 未设置凭据 → 引导
  if (hasCreds === false) {
    return (
      <TouchableOpacity style={s.section} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
        <View style={s.sectionHeader}>
          <MaterialIcons name="forum" size={16} color="#0055A8" />
          <Text style={s.sectionTitle}>选课社区</Text>
          <MaterialIcons name="chevron-right" size={18} color="#999" style={{ marginLeft: 'auto' }} />
        </View>
        <View style={s.sectionCard}>
          <View style={s.guideRow}>
            <MaterialIcons name="info-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
            <Text style={s.guideText}>未设置选课社区凭据，前去填写</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

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
