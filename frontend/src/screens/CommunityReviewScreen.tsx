import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Markdown from 'react-native-markdown-display';
import { searchCourses, getAllCourseReviews, Review } from '../api/courseCommunity';
import { calculateCredibility, ratingToStars, CredibilityResult } from '../utils/credibility';
import { getCommunityFavorites, addCommunityFavorite, removeCommunityFavorite, CommunityFavorite } from '../utils/storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCROLL_THRESHOLD = SCREEN_HEIGHT * 2;

type SearchStatus = 'idle' | 'loading' | 'success' | 'error' | 'authing';

interface TeacherData {
  id: number;
  name: string;
  teacher: string;
  code: string;
  categories: string[];
  department: string;
}

interface CourseGroup {
  code: string;
  name: string;
  teachers: TeacherData[];
  teacherReviews: Map<number, Review[]>;
  teacherCred: Map<number, CredibilityResult>;
  teacherPage: Map<number, { page: number; hasMore: boolean }>;
}

const C = {
  primary: '#0055A8', primaryLight: '#E8F0FE',
  bg: '#F5F5F5', card: '#FFFFFF',
  text: '#333', textSec: '#888', textTertiary: '#BBB',
  border: '#EEE', star: '#FFB800',
  credH: '#4CAF50', credM: '#FF9800', credL: '#9E9E9E',
};

const CAT_COLORS: Record<string, string> = {
  '工程科学与技术': '#1565C0', '体育': '#F4511E', '社会科学': '#2E7D32',
  '研究生': '#6A1B9A', '自然科学': '#00838F', '通选': '#0D47A1',
  '新生研讨': '#E65100', '艺术修养': '#C62828', '人文学科': '#4E342E',
};

const getCatColor = (cat: string) => {
  for (const [k, v] of Object.entries(CAT_COLORS)) { if (cat.includes(k)) return v; }
  return '#757575';
};

// ===== 子组件 =====
const CredBadge = ({ cred }: { cred: CredibilityResult }) => {
  const color = cred.level === '高' ? C.credH : cred.level === '中' ? C.credM : C.credL;
  return (
    <View style={{ borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: color + '20', marginLeft: 6 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color }}>可信:{cred.level}</Text>
    </View>
  );
};

const RatingRow = ({ cred }: { cred: CredibilityResult }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
    <Text style={{ fontSize: 13, color: C.star }}>{ratingToStars(cred.avgRating)}</Text>
    <Text style={{ fontSize: 12, color: C.textSec, marginLeft: 4 }}>{cred.avgRating.toFixed(2)}</Text>
    <Text style={{ fontSize: 11, color: C.textTertiary, marginLeft: 4 }}>{cred.count}条</Text>
    <CredBadge cred={cred} />
  </View>
);

const ReviewCard = ({ review }: { review: Review }) => {
  const [showFull, setShowFull] = useState(false);
  const text = review.comment.replace(/\\n/g, '\n');
  const isLong = text.length > 80;

  return (
    <View style={sRev.card}>
      <View style={sRev.header}>
        <Text style={sRev.semester}>{review.semester.replace(/-/g, ' ')}</Text>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <MaterialIcons key={i} name={i <= review.rating ? 'star' : 'star-outline'} size={11} color={C.star} />
          ))}
        </View>
      </View>
      <TouchableOpacity onPress={() => setShowFull(!showFull)} activeOpacity={isLong ? 0.7 : 1}>
        {showFull ? (
          <Markdown style={mdStyle}>{text}</Markdown>
        ) : (
          <Text style={sRev.previewText} numberOfLines={3} ellipsizeMode="tail">{text}</Text>
        )}
      </TouchableOpacity>
      {(review.reactions?.approves ?? 0) > 0 || (review.reactions?.disapproves ?? 0) > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {review.reactions!.approves > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="thumb-up" size={13} color={C.textSec} />
              <Text style={[sRev.reaction, { marginLeft: 2 }]}>{review.reactions!.approves}</Text>
            </View>
          )}
          {review.reactions!.disapproves > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="thumb-down" size={13} color={C.textSec} />
              <Text style={[sRev.reaction, { marginLeft: 2 }]}>{review.reactions!.disapproves}</Text>
            </View>
          )}
          {review.score && <Text style={{ fontSize: 11, color: C.primary, marginLeft: 'auto' }}>得分: {review.score}</Text>}
        </View>
      ) : null}
    </View>
  );
};

const sRev = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 6, padding: 8, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  semester: { fontSize: 11, color: C.textSec },
  reaction: { fontSize: 11, color: C.textSec },
  previewText: { fontSize: 13, color: C.text, lineHeight: 18 },
});

const mdStyle = { body: { fontSize: 13, color: C.text, lineHeight: 18 }, p: { marginVertical: 0 } } as any;

// ===== 主屏幕 =====
export const CommunityReviewScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState(route?.params?.initialSearch || '');
  const [status, setStatus] = useState<SearchStatus>(route?.params?.initialSearch ? 'loading' : 'idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedT, setExpandedT] = useState<Set<string>>(new Set());
  const [favIds, setFavIds] = useState<Set<number>>(new Set());
  const [showTop, setShowTop] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // 当搜索词匹配到同一位教师的所有课程时，聚合显示综合可信度
  const [teacherSummary, setTeacherSummary] = useState<{
    teacherName: string;
    totalReviews: number;
    avgRating: number;
    cred: CredibilityResult;
    teacherIds: number[];
  } | null>(null);
  const debRef = useRef<any>(null);
  const flatRef = useRef<FlatList>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setShowTop(value > SCROLL_THRESHOLD));
    return () => scrollY.removeListener(id);
  }, []);

  // 如果从收藏页带 initialSearch 参数进来，自动搜索
  useEffect(() => {
    if (route?.params?.initialSearch) {
      const q = route.params.initialSearch;
      setSearchText(q);
      // 延迟一帧确保状态已更新
      setTimeout(() => handleSearch(q), 100);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    (async () => { const f = await getCommunityFavorites(); setFavIds(new Set(f.map(x => x.courseId))); })();
  }, []));

  // 首次展开时加载该老师的全部评论，算一次可信度（之后不变）
  const loadAllReviews = async (g: CourseGroup, t: TeacherData) => {
    if (g.teacherReviews.has(t.id)) return;
    try {
      const all = await getAllCourseReviews(t.id);
      g.teacherReviews.set(t.id, all);
      if (all.length > 0) {
        g.teacherCred.set(t.id, calculateCredibility(all));
      } else {
        g.teacherReviews.set(t.id, []);
      }
      g.teacherPage.set(t.id, { page: 1, hasMore: all.length > 10 });
      setRefreshKey(k => k + 1);
    } catch {}
  };

  // 搜索
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setStatus('idle'); setGroups([]); return; }
    setStatus('loading'); setGroups([]);
    try {
      const result = await searchCourses(trimmed);
      if (!result) { setStatus('error'); setErrorMsg('登录选课社区失败，请在设置中检查 jAccount 凭据'); return; }
      const items = result.results || [];
      if (!result.count || items.length === 0) { setStatus('error'); setErrorMsg('没有找到相关课程'); return; }
      console.log('[search] 搜索结果:', result.count, '门课, 首条:', items[0]?.code, items[0]?.name);
      const codeMap = new Map<string, TeacherData[]>();
      for (const item of items) {
        const cats = item.categories || [];
        const dept = item.department || '';
        if (!codeMap.has(item.code)) codeMap.set(item.code, []);
        codeMap.get(item.code)!.push({ id: item.id, name: item.name, teacher: item.teacher, code: item.code, categories: cats, department: dept });
      }
      const list: CourseGroup[] = [];
      for (const [code, teachers] of codeMap) {
        const g: CourseGroup = { code, name: teachers[0].name, teachers, teacherReviews: new Map(), teacherCred: new Map(), teacherPage: new Map() };
        // 直接用搜索结果中的 rating 计算初始可信度
        for (const t of teachers) {
          const item = items.find(i => i.id === t.id);
          if (item?.rating) {
            const score = Math.min(100, (item.rating.count / 10) * 100);
            const level = score >= 70 ? '高' : score >= 40 ? '中' : '低';
            g.teacherCred.set(t.id, { level, score, avgRating: item.rating.avg ?? 0, count: item.rating.count ?? 0 });
          }
        }
        list.push(g);
      }
      list.sort((a, b) => a.code.localeCompare(b.code));
      const totalTeachers = list.reduce((s, g) => s + g.teachers.length, 0);
      // 检测搜索结果是否全部指向同一位教师
      const allTeachers = items.map(i => i.teacher).filter(Boolean);
      const isSingleTeacher = allTeachers.length > 1 && allTeachers.every(t => t === allTeachers[0]);
      if (isSingleTeacher) {
        const teacherName = allTeachers[0]!;
        let totalCount = 0;
        let weightedSum = 0;
        const ids: number[] = [];
        for (const item of items) {
          if (item.rating) {
            totalCount += item.rating.count ?? 0;
            weightedSum += (item.rating.avg ?? 0) * (item.rating.count ?? 0);
          }
          ids.push(item.id);
        }
        const avg = totalCount > 0 ? weightedSum / totalCount : 0;
        const score = Math.min(100, (totalCount / 10) * 100);
        const level = score >= 70 ? '高' : score >= 40 ? '中' : '低';
        setTeacherSummary({
          teacherName,
          totalReviews: totalCount,
          avgRating: avg,
          cred: { level, score, avgRating: avg, count: totalCount },
          teacherIds: ids,
        });
      } else {
        setTeacherSummary(null);
      }
      setGroups(list);
      setVisibleCount(Math.min(10, totalTeachers));
      setStatus('success');
    } catch { setStatus('error'); setErrorMsg('搜索失败'); }
  }, []);

  const loadMore = (gCode: string, tId: number) => {
    setGroups(prevGroups => {
      const g = prevGroups.find(x => x.code === gCode);
      if (!g) return prevGroups;
      const p = g.teacherPage.get(tId);
      if (!p || !p.hasMore) return prevGroups;
      g.teacherPage.set(tId, { ...p, page: p.page + 1, hasMore: (p.page + 1) * 10 < (g.teacherReviews.get(tId)?.length ?? 0) });
      setRefreshKey(k => k + 1);
      return prevGroups;
    });
  };

  const toggleFav = async (t: TeacherData, cred?: CredibilityResult) => {
    const id = t.id;
    if (favIds.has(id)) { await removeCommunityFavorite(id); favIds.delete(id); setFavIds(new Set(favIds)); }
    else {
      await addCommunityFavorite({
        courseId: id, courseCode: t.code, courseName: t.name, teacherName: t.teacher,
        addedAt: Date.now(),
        avgRating: cred?.avgRating, reviewCount: cred?.count, credibilityLevel: cred?.level,
      });
      favIds.add(id); setFavIds(new Set(favIds));
    }
  };

  const renderGroup = ({ item }: { item: CourseGroup }) => {
    const groupOpen = expandedGroups.has(item.code);
    return (
    <View style={s.group}>
      <TouchableOpacity style={s.gHeader} onPress={() => {
        setExpandedGroups(prev => { const s2 = new Set(prev); if (s2.has(item.code)) s2.delete(item.code); else s2.add(item.code); return s2; });
      }} activeOpacity={0.7}>
        <MaterialIcons name={groupOpen ? 'expand-less' : 'expand-more'} size={20} color={C.textSec} />
        <Text style={s.code}>{item.code}</Text>
        {item.teachers[0]?.categories?.length > 0 && (
          <View style={{ backgroundColor: getCatColor(item.teachers[0].categories[0]), borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginRight: 6 }}>
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>{item.teachers[0].categories[0]}</Text>
          </View>
        )}
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>
        <Text style={s.tCount}>{item.teachers.length}位老师</Text>
      </TouchableOpacity>
      {groupOpen && (
        <View style={s.teacherList}>
          {item.teachers.map(t => {
        const revs = item.teacherReviews.get(t.id);
        const cred = item.teacherCred.get(t.id);
        const pInfo = item.teacherPage.get(t.id);
        const tKey = `${item.code}_${t.id}`;
        const open = expandedT.has(tKey);
        return (
          <View key={t.id} style={s.tCard}>
            <TouchableOpacity style={s.tHeader} onPress={() => {
              if (!item.teacherReviews.has(t.id)) {
                loadAllReviews(item, t);
              }
              setExpandedT(prev => { const s2 = new Set(prev); if (s2.has(tKey)) s2.delete(tKey); else s2.add(tKey); return s2; });
            }} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={s.tName}>{t.teacher}</Text>
                  {cred ? <CredBadge cred={cred} /> : !cred && revs === undefined ? <Text style={[s.csub, { marginLeft: 6 }]}>加载中</Text> : null}
                  {revs !== undefined && revs.length === 0 && !cred && <Text style={[s.csub, { marginLeft: 6 }]}>暂无点评</Text>}
                </View>
                {cred ? <RatingRow cred={cred} /> : revs === undefined ? <Text style={s.csub}>正在获取评价...</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={20} color={C.textSec} />
                <TouchableOpacity onPress={() => toggleFav(t, cred)} style={{ paddingLeft: 6 }}>
                  <MaterialIcons name={favIds.has(t.id) ? 'favorite' : 'favorite-border'} size={20} color={favIds.has(t.id) ? '#E53935' : '#CCC'} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            {open && revs && (
              <View style={s.revList}>
                {revs.slice(0, (pInfo?.page ?? 1) * 10).map(r => <ReviewCard key={r.id} review={r} />)}
                {pInfo?.hasMore && (
                    <TouchableOpacity style={s.loadMoreBtn} onPress={() => loadMore(item.code, t.id)} activeOpacity={0.7}>
                    <Text style={s.loadMoreText}>展开更多评论</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}
        </View>
      )}
    </View>
  );
  };

  // 教师综合信息卡片（搜索词匹配到同一位教师时显示）
  const TeacherSummaryCard = () => {
    if (!teacherSummary) return null;
    const { teacherName, totalReviews, avgRating, cred } = teacherSummary;
    return (
      <View style={s.summaryCard}>
        <View style={s.summaryHeader}>
          <MaterialIcons name="person" size={20} color={C.primary} />
          <Text style={s.summaryTeacherName}>{teacherName}</Text>
          <CredBadge cred={cred} />
        </View>
        <View style={s.summaryBody}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{ratingToStars(avgRating)}</Text>
            <Text style={s.summaryLabel}>综合评分</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{avgRating.toFixed(1)}</Text>
            <Text style={s.summaryLabel}>平均分</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{totalReviews}</Text>
            <Text style={s.summaryLabel}>评价数</Text>
          </View>
        </View>
        <Text style={s.summaryHint}>以下为该教师讲授的所有课程</Text>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>选课社区</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => navigation.navigate('AlgorithmHelp')} style={s.iconBtn} activeOpacity={0.7}>
            <MaterialIcons name="info-outline" size={22} color={C.textSec} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Favorites')} style={s.iconBtn} activeOpacity={0.7}>
            <MaterialIcons name="favorite" size={22} color={C.textSec} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.searchBar}>
        <MaterialIcons name="search" size={20} color={C.textSec} style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} placeholder="搜索课程名称/课号/教师姓名" placeholderTextColor={C.textSec}
          value={searchText} onChangeText={t => { setSearchText(t); if (debRef.current) clearTimeout(debRef.current); debRef.current = setTimeout(() => handleSearch(t), 300); }}
          returnKeyType="search" autoCorrect={false} />
        {searchText.length > 0 && <TouchableOpacity onPress={() => { setSearchText(''); setStatus('idle'); setGroups([]); }}><MaterialIcons name="close" size={18} color={C.textSec} /></TouchableOpacity>}
      </View>
      {status === 'idle' && <View style={s.center}><MaterialIcons name="forum" size={48} color="#DDD" /><Text style={s.emptyText}>搜索课程查看不同老师的评分对比</Text><Text style={s.emptyHint}>支持模糊搜索</Text></View>}
      {status === 'loading' && <View style={s.center}><ActivityIndicator size="large" color={C.primary} /><Text style={[s.emptyText, { marginTop: 12 }]}>正在搜索...</Text></View>}
      {status === 'authing' && <View style={s.center}><ActivityIndicator size="large" color={C.primary} /><Text style={[s.emptyText, { marginTop: 12 }]}>登录选课社区...</Text></View>}
      {status === 'error' && <View style={s.center}><MaterialIcons name="search-off" size={48} color="#DDD" /><Text style={s.emptyText}>{errorMsg}</Text></View>}
      {status === 'success' && (
        <>
          <FlatList ref={flatRef} data={(() => {
            let remain = visibleCount;
            return groups.filter(g => {
              if (remain <= 0) return false;
              const take = Math.min(remain, g.teachers.length);
              remain -= take;
              return take > 0;
            });
          })()} extraData={refreshKey} keyExtractor={g => g.code} renderItem={renderGroup}
            contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
            scrollEventThrottle={16}
            ListHeaderComponent={
              <View>
                <TeacherSummaryCard />
                <Text style={s.resultCount}>
                  找到 {groups.reduce((s, g) => s + g.teachers.length, 0)} 位教师 · {groups.length} 门课
                  {expandedGroups.size > 0 && visibleCount < groups.reduce((s, g) => s + g.teachers.length, 0) && `（显示前 ${visibleCount} 位）`}
                </Text>
              </View>
            }
            ListFooterComponent={
              (() => {
                const totalTeachers = groups.reduce((s, g) => s + g.teachers.length, 0);
                if (visibleCount >= totalTeachers || expandedGroups.size === 0) return null;
                return (
                  <TouchableOpacity style={s.showMoreBtn} onPress={() => {
                    const newCount = Math.min(totalTeachers, visibleCount + 10);
                    let loaded = 0;
                    for (const g of groups) {
                      for (const t of g.teachers) {
                        if (loaded >= newCount) break;
                        loaded++;
                        if (loaded > visibleCount && !g.teacherReviews.has(t.id)) {
                          loadAllReviews(g, t);
                        }
                      }
                      if (loaded >= newCount) break;
                    }
                    setVisibleCount(newCount);
                  }} activeOpacity={0.7}>
                    <Text style={s.showMoreText}>显示更多教师（{Math.min(10, totalTeachers - visibleCount)} 位）</Text>
                  </TouchableOpacity>
                );
              })()
            }
          />
          {showTop && <TouchableOpacity style={[s.scrollTop, { bottom: insets.bottom + 16 }]} onPress={() => flatRef.current?.scrollToOffset({ offset: 0, animated: true })} activeOpacity={0.8}><MaterialIcons name="keyboard-arrow-up" size={28} color="#FFF" /></TouchableOpacity>}
        </>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyText: { fontSize: 15, color: C.textSec, marginTop: 12 },
  emptyHint: { fontSize: 13, color: C.textTertiary, marginTop: 6 },
  resultCount: { fontSize: 13, color: C.textSec, paddingHorizontal: 12, paddingVertical: 8 },
  summaryCard: { backgroundColor: C.card, marginHorizontal: 12, marginTop: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.primary + '30' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  summaryTeacherName: { fontSize: 16, fontWeight: '700', color: C.text, flex: 1, marginLeft: 8 },
  summaryBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#FAFAFA', borderRadius: 8, paddingVertical: 10 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: C.text },
  summaryLabel: { fontSize: 11, color: C.textSec, marginTop: 2 },
  summaryDivider: { width: 1, height: 28, backgroundColor: C.border },
  summaryHint: { fontSize: 12, color: C.textSec, textAlign: 'center', marginTop: 8 },
  group: { marginBottom: 0 },
  gHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  code: { fontSize: 13, fontWeight: '700', color: C.primary, marginRight: 6 },
  name: { fontSize: 13, color: C.text, flex: 1 },
  tCount: { fontSize: 12, color: C.textSec, marginLeft: 6 },
  teacherList: { backgroundColor: C.card, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  tCard: { backgroundColor: '#FAFAFA', borderRadius: 8, marginHorizontal: 12, marginBottom: 6, overflow: 'hidden' },
  tHeader: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  tName: { fontSize: 14, fontWeight: '600', color: C.text },
  csub: { fontSize: 12, color: C.textSec },
  revList: { borderTopWidth: 1, borderTopColor: C.border, padding: 8 },
  loadMoreBtn: { backgroundColor: C.primaryLight, borderRadius: 6, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  loadMoreText: { fontSize: 13, fontWeight: '600', color: C.primary },
  showMoreBtn: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginHorizontal: 12, marginTop: 8 },
  showMoreText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  scrollTop: { position: 'absolute', bottom: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', elevation: 4 },
});
