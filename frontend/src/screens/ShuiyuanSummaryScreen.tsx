import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export const ShuiyuanSummaryScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>水源帖子摘要</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.placeholder}>
        <MaterialIcons name="construction" size={48} color="#CCC" />
        <Text style={styles.placeholderText}>功能开发中</Text>
        <Text style={styles.placeholderHint}>此功能将在后续版本中实现</Text>
      </View>
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
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  placeholderText: { fontSize: 16, color: '#999', marginTop: 12 },
  placeholderHint: { fontSize: 13, color: '#BBB', marginTop: 6 },
});
