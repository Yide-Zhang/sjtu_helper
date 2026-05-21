import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchGradeList, fetchGradeDetail } from '../api/jaccount';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const XQM_MAP: Record<string, string> = { '3': '秋季', '12': '春季', '16': '夏季' };
const XQM_ORDER = ['3', '12', '16'];
const getCurrentSem = () => {
  const m = new Date().getMonth() + 1;
  if (m >= 2 && m <= 6) return { xnm: String(new Date().getFullYear() - 1), xqm: '12' };
  if (m >= 7 && m <= 8) return { xnm: String(new Date().getFullYear() - 1), xqm: '16' };
  if (m >= 9 && m <= 12) return { xnm: String(new Date().getFullYear()), xqm: '3' };
  return { xnm: String(new Date().getFullYear() - 1), xqm: '3' };
};

const genYears = () => {
  const opts: string[] = [];
  for (let y = new Date().getFullYear() + 1; y >= new Date().getFullYear() - 4; y--) opts.push(String(y));
  return opts;
};

export const GradesScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const cur = getCurrentSem();
  const [xnm, setXnm] = useState(cur.xnm);
  const [xqm, setXqm] = useState(cur.xqm);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const raw = await fetchGradeList(xnm, xqm);
      const data = JSON.parse(raw);
      setCourses(data.items || []);
    } catch { setCourses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [xnm, xqm]);

  const semLabel = `${xnm}-${Number(xnm) + 1} ${XQM_MAP[xqm] || ''}`;
  const years = genYears();

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>成绩</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.semRow}>
          <TouchableOpacity onPress={() => {
            const i = years.indexOf(xnm);
            if (i < years.length - 1) setXnm(years[i + 1]);
          }} activeOpacity={0.6}>
            <MaterialIcons name="chevron-left" size={24} color="#0055A8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            const i = XQM_ORDER.indexOf(xqm);
            setXqm(XQM_ORDER[(i + 1) % 3]);
          }} style={styles.semBtn} activeOpacity={0.7}>
            <Text style={styles.semText}>{semLabel}</Text>
            <MaterialIcons name="swap-horiz" size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            const i = years.indexOf(xnm);
            if (i > 0) setXnm(years[i - 1]);
          }} activeOpacity={0.6}>
            <MaterialIcons name="chevron-right" size={24} color="#0055A8" />
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color="#0055A8" style={{ marginTop: 40 }} />}

        {!loading && courses.length === 0 && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#999', fontSize: 15 }}>该学期暂无成绩记录</Text>
          </View>
        )}

        {!loading && courses.length > 0 && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {courses.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => {
                  // 先加载明细，再跳转
                  (async () => {
                    try {
                      const detailRaw = await fetchGradeDetail(c.jxb_id, xnm, xqm);
                      const detailData = JSON.parse(detailRaw);
                      const items = detailData.items || [];
                      navigation.navigate('ScoreDetail', {
                        course: {
                          kcmc: c.kcmc,
                          kch: c.kch,
                          xf: c.xf,
                          zpcj: c.zpcj,
                          items,
                        },
                      });
                    } catch {
                      // 明细获取失败，仍然跳转但带空明细
                      navigation.navigate('ScoreDetail', {
                        course: {
                          kcmc: c.kcmc,
                          kch: c.kch,
                          xf: c.xf,
                          zpcj: c.zpcj,
                          items: [],
                        },
                      });
                    }
                  })();
                }}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.courseName} numberOfLines={1}>{c.kcmc}</Text>
                  <Text style={[styles.score, c.zpcj === 'W' ? styles.scoreW : styles.scoreNum]}>{c.zpcj}</Text>
                </View>
                <View style={styles.cardBot}>
                  <Text style={styles.meta}>{c.kch}</Text>
                  <Text style={styles.meta}>{c.xf} 学分</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F9' },
  container: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 14 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#333' },
  semRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  semBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginHorizontal: 8, elevation: 1 },
  semText: { fontSize: 15, fontWeight: '600', color: '#333', marginRight: 4 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseName: { fontSize: 16, fontWeight: '700', color: '#333', flex: 1, marginRight: 12 },
  score: { fontSize: 22, fontWeight: '800' },
  scoreNum: { color: '#0055A8' },
  scoreW: { color: '#F44336' },
  cardBot: { flexDirection: 'row', marginTop: 6 },
  meta: { fontSize: 12, color: '#999', marginRight: 16 },
});
