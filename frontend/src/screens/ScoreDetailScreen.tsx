import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ScorePieChart from '../components/ScorePieChart';
import { numericToGrade } from '../utils/gradeMapping';

interface ScoreItem { xmblmc: string; xmcj: string; }

interface CourseInfo {
  kcmc: string; kch: string; xf: string; zpcj: string; items: ScoreItem[];
}

const parseItem = (raw: string): { name: string; pct: number } => {
  const m = raw.match(/^(.+?)\((\d+(?:\.\d+)?)%\)$/);
  if (m) return { name: m[1], pct: parseFloat(m[2]) };
  return { name: raw, pct: 0 };
};

const isGrade = (v: string) => /^[A-Z][+-]?$/.test(v.trim());

export const ScoreDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { course } = route.params as { course: CourseInfo };
  const fade = useRef(new Animated.Value(0)).current;

  const comps = course.items.filter(i => i.xmblmc !== '总评');
  const isW = course.zpcj === 'W';
  const isGradeOnly = !isW && isGrade(course.zpcj);
  const total = isW ? 'W' : isGradeOnly ? course.zpcj.trim() : parseFloat(course.zpcj).toFixed(1);
  const parsed = comps.map(c => ({
    name: parseItem(c.xmblmc).name,
    pct: parseItem(c.xmblmc).pct,
    score: c.xmcj === 'W' ? 0 : parseFloat(c.xmcj) || 0,
  }));
  const hasMeaningfulBreakdown = parsed.length > 0 && !(parsed.length === 1 && parsed[0].pct >= 99);
  const gradeLetter = !isW && !isGradeOnly ? numericToGrade(parseFloat(course.zpcj)) : null;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const sliceHitRef = useRef(false);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{course.kcmc}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onTouchEnd={() => { if (!sliceHitRef.current) setSelectedIndex(null); sliceHitRef.current = false; }}
      >
        {isW && (
          <Animated.View style={[styles.block, { opacity: fade }]}>
            <Text style={styles.wText}>W</Text>
            <Text style={styles.wSub}>(中期退课)</Text>
          </Animated.View>
        )}
        {isGradeOnly && !isW && (
          <Animated.View style={[styles.block, { opacity: fade }]}>
            <Text style={styles.gradeText}>{course.zpcj.trim()}</Text>
          </Animated.View>
        )}
        {!isW && !isGradeOnly && !hasMeaningfulBreakdown && (
          <Animated.View style={[styles.block, { opacity: fade }]}>
            <Text style={styles.gradeText}>
              {total}<Text style={styles.gradeUnit}>分</Text>
              {gradeLetter ? <Text style={styles.gradeLetterLabel}> / {gradeLetter}</Text> : null}
            </Text>
          </Animated.View>
        )}
        {!isW && !isGradeOnly && hasMeaningfulBreakdown && (
          <Animated.View style={{ opacity: fade, marginVertical: 8 }}>
            <ScorePieChart components={parsed} totalScore={total} gradeLetter={gradeLetter || undefined} width={280} selectedIndex={selectedIndex} onSelectIndex={setSelectedIndex} sliceHitRef={sliceHitRef} />
          </Animated.View>
        )}
        {!isW && !isGradeOnly && hasMeaningfulBreakdown && (
          <View style={styles.totalRow}>
            <Text style={styles.totalNum}>{total}</Text>
            <Text style={styles.totalUnit}>分</Text>
          </View>
        )}
        {!isW && !isGradeOnly && hasMeaningfulBreakdown && parsed.length > 0 && (
          <View style={styles.legend}>
            {parsed.map((c, i) => (
              <View key={i} style={styles.legRow}>
                <View style={[styles.dot, { backgroundColor: ['#0055A8','#E65100','#4CAF50','#9C27B0','#FF9800','#00BCD4','#F44336','#607D8B'][i % 8] }]} />
                <Text style={styles.legLabel}>{c.name}</Text>
                <Text style={styles.legPct}>{c.pct}%</Text>
                <Text style={styles.legScore}>{c.score}分</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.infoRow}><Text style={styles.infoL}>课程编号</Text><Text style={styles.infoV}>{course.kch}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoL}>学分</Text><Text style={styles.infoV}>{course.xf}</Text></View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 10,
  },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#333', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  body: { paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
  block: { alignItems: 'center', marginVertical: 60 },
  wText: { fontSize: 72, fontWeight: '800', color: '#F44336', letterSpacing: 4 },
  wSub: { fontSize: 16, color: '#999', marginTop: 8 },
  gradeText: { fontSize: 80, fontWeight: '800', color: '#0055A8', letterSpacing: 6, textAlign: 'center' },
  gradeUnit: { fontSize: 30, fontWeight: '600', color: '#0055A8' },
  gradeLetterLabel: { fontSize: 30, fontWeight: '700', color: '#0055A8', opacity: 0.6 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20, marginTop: -4 },
  totalNum: { fontSize: 42, fontWeight: '800', color: '#0055A8' },
  totalUnit: { fontSize: 16, color: '#666', marginLeft: 4 },
  legend: { width: '100%', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 12 },
  legRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legLabel: { fontSize: 14, color: '#333', flex: 1 },
  legPct: { fontSize: 13, color: '#999', marginRight: 12 },
  legScore: { fontSize: 14, color: '#0055A8', fontWeight: '700' },
  info: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, width: '100%' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  infoL: { fontSize: 14, color: '#999' },
  infoV: { fontSize: 14, color: '#333', fontWeight: '600' },
});
