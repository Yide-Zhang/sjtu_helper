import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { getCourseColor } from '../utils/colors';

interface Props {
  courses: string[];
  selected: string;
  onSelect: (course: string) => void;
}

export const CourseSelector: React.FC<Props> = ({ courses, selected, onSelect }) => {
  const [visible, setVisible] = useState(false);
  const allOptions = [...new Set(['', ...courses.filter(c => c && c !== '')])];
  const color = selected ? getCourseColor(selected) : '#999';

  return (
    <View style={styles.container}>
      {/* 选中项 — 点按弹出选择窗口 */}
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: selected ? color : '#E8E8E8' }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.pillText, { color: selected ? '#FFF' : '#888' }]}>
          {selected || '无课程'}
        </Text>
      </TouchableOpacity>

      {/* 弹窗选择 */}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>选择课程</Text>
            <View style={styles.grid}>
              {allOptions.map((name) => {
                const isSel = name === selected;
                const c = name ? getCourseColor(name) : '#999';
                return (
                  <TouchableOpacity
                    key={name || '__none__'}
                    style={[
                      styles.item,
                      { backgroundColor: c },
                      isSel && styles.itemSel,
                      !name && { backgroundColor: '#E0E0E0' },
                    ]}
                    onPress={() => { onSelect(name); setVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.itemText}>{name || '无课程'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  itemSel: {
    borderWidth: 2,
    borderColor: '#333',
  },
  itemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
});
