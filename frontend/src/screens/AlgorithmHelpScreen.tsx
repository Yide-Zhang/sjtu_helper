import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export const AlgorithmHelpScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>可信度算法说明</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 总览 */}
        <Text style={styles.overviewText}>
          可信度综合三个维度加权计算，总分 0–100，分为三档：
        </Text>
        <View style={styles.levelRow}>
          <View style={[styles.levelBadge, { backgroundColor: '#4CAF50' }]}><Text style={styles.levelBadgeText}>高</Text></View>
          <Text style={styles.levelDesc}>≥ 70 分</Text>
          <View style={[styles.levelBadge, { backgroundColor: '#FF9800' }]}><Text style={styles.levelBadgeText}>中</Text></View>
          <Text style={styles.levelDesc}>≥ 40 分</Text>
          <View style={[styles.levelBadge, { backgroundColor: '#9E9E9E' }]}><Text style={styles.levelBadgeText}>低</Text></View>
          <Text style={styles.levelDesc}>{'<'} 40 分</Text>
        </View>

        {/* 权重条 */}
        <View style={styles.weightBar}>
          <View style={[styles.weightSeg, { flex: 30, backgroundColor: '#4CAF50' }]}><Text style={styles.weightText}>30%</Text></View>
          <View style={[styles.weightSeg, { flex: 35, backgroundColor: '#FF9800' }]}><Text style={styles.weightText}>35%</Text></View>
          <View style={[styles.weightSeg, { flex: 35, backgroundColor: '#2196F3' }]}><Text style={styles.weightText}>35%</Text></View>
        </View>

        {/* 因子1 */}
        <Text style={styles.sectionTitle}>① 时效性 — 30%</Text>
        <Text style={styles.desc}>
          评价的发布时间越新，可信度越高。
        </Text>
        <View style={styles.formulaCard}>
          <Text style={styles.formulaText}>
            {''}最近 6 个月内 → 100 分{'\n'}
            之后每 6 个月 × 0.8 衰减{'\n'}
            取所有评价的平均值
          </Text>
        </View>

        {/* 因子2 */}
        <Text style={styles.sectionTitle}>② 评价数量 — 35%</Text>
        <Text style={styles.desc}>
          评价数量越多，统计意义越强。
        </Text>
        <View style={styles.formulaCard}>
          <Text style={styles.formulaText}>
            score = min(100, 评价数 / 10 × 100){'\n'}
            10 条评价即可达到满分
          </Text>
        </View>

        {/* 因子3 */}
        <Text style={styles.sectionTitle}>③ 一致性 — 35%</Text>
        <Text style={styles.desc}>
          评分的标准差越低，说明同学们的意见越一致，结果越可靠。
        </Text>
        <View style={styles.formulaCard}>
          <Text style={styles.formulaText}>
            score = max(0, 100 − 标准差 × 30){'\n'}
            标准差 = √(各评分与平均值的方差)
          </Text>
        </View>

        {/* 教师综合 */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>教师综合可信度</Text>
        <Text style={styles.desc}>
          • 同一教师名下可能有多门课程（如不同课号）{'\n'}
          • 系统汇总该教师所有课程的全部评价进行计算{'\n'}
          • 综合评分 = 各课程评价数的加权平均分
        </Text>

        {/* 展示说明 */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>界面说明</Text>
        <View style={styles.tipRow}>
          <MaterialIcons name="star" size={16} color="#FFB800" />
          <Text style={styles.tipText}>星级评分来自选课社区原始平均分</Text>
        </View>
        <View style={styles.tipRow}>
          <MaterialIcons name="verified" size={16} color="#4CAF50" />
          <Text style={styles.tipText}>高可信度绿色 · 中可信度橙色 · 低可信度灰色</Text>
        </View>
        <View style={styles.tipRow}>
          <MaterialIcons name="expand-more" size={16} color="#888" />
          <Text style={styles.tipText}>展开教师卡片后加载全部评论，可信度重新计算</Text>
        </View>
        <View style={styles.tipRow}>
          <MaterialIcons name="favorite" size={16} color="#888" />
          <Text style={styles.tipText}>收藏时保存当前评分/条数/可信度等级</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  content: { padding: 16 },
  overviewText: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  levelBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  levelBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  levelDesc: { fontSize: 13, color: '#555' },
  weightBar: { flexDirection: 'row', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 20 },
  weightSeg: { justifyContent: 'center', alignItems: 'center' },
  weightText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6, marginTop: 6 },
  desc: { fontSize: 14, color: '#666', lineHeight: 22, marginBottom: 10 },
  formulaCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#0055A8' },
  formulaText: { fontSize: 14, color: '#444', lineHeight: 22, fontFamily: 'monospace' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  tipText: { fontSize: 14, color: '#666', flex: 1 },
});
