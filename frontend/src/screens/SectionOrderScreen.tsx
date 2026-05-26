import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getSectionPriorities, setSectionPriorities, DEFAULT_SECTION_PRIORITIES } from '../utils/storage';

const SECTION_LABELS: Record<string, string> = {
  schedule: '课表',
  assignments: '作业',
  announce: '公告',
  exams: '考试',
  notif: '教务通知',
  mail: '邮箱',
  community: '选课社区',
};

interface SectionItem {
  id: string;
  label: string;
  priority: number;
}

export const SectionOrderScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SectionItem[]>([]);

  useEffect(() => {
    (async () => {
      const p = await getSectionPriorities();
      const list = Object.keys(DEFAULT_SECTION_PRIORITIES).map(id => ({
        id,
        label: SECTION_LABELS[id] || id,
        priority: p[id] ?? DEFAULT_SECTION_PRIORITIES[id],
      }));
      list.sort((a, b) => a.priority - b.priority);
      setItems(list);
    })();
  }, []);

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    const list = [...items];
    [list[idx].priority, list[target].priority] = [list[target].priority, list[idx].priority];
    list.sort((a, b) => a.priority - b.priority);
    setItems(list);
  };

  const handleSave = async () => {
    const pri: Record<string, number> = {};
    for (const item of items) pri[item.id] = item.priority;
    await setSectionPriorities(pri);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>主页板块排序</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>点击 ↑↓ 调整各板块的排列顺序</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {items.map((item, idx) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{idx + 1}</Text>
            </View>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.arrows}>
              <TouchableOpacity
                onPress={() => moveItem(idx, -1)}
                style={[styles.arrowBtn, idx === 0 && styles.arrowBtnDisabled]}
                activeOpacity={0.7}
                disabled={idx === 0}
              >
                <MaterialIcons name="keyboard-arrow-up" size={22} color={idx === 0 ? '#CCC' : '#0055A8'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => moveItem(idx, 1)}
                style={[styles.arrowBtn, idx === items.length - 1 && styles.arrowBtnDisabled]}
                activeOpacity={0.7}
                disabled={idx === items.length - 1}
              >
                <MaterialIcons name="keyboard-arrow-down" size={22} color={idx === items.length - 1 ? '#CCC' : '#0055A8'} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0055A8', borderRadius: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  hint: { fontSize: 13, color: '#999', padding: 16, paddingBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 10,
    padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  indexBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#0055A8',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  indexText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  label: { flex: 1, fontSize: 16, color: '#333' },
  arrows: { flexDirection: 'row', gap: 4 },
  arrowBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F0FE', justifyContent: 'center', alignItems: 'center' },
  arrowBtnDisabled: { backgroundColor: '#F0F0F0' },
});
