import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { ClockPicker } from './ClockPicker';

interface Props {
  visible: boolean;
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  onClose: () => void;
  onClear: () => void;
}

export const TimePickerModal: React.FC<Props> = ({ 
  visible, hour, minute, onHourChange, onMinuteChange, onClose, onClear 
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>选择时间</Text>

          {/* 时钟核心组件（加减箭头与AM/PM全量闭环集成） */}
          <ClockPicker
            hour={hour}
            minute={minute}
            onHourChange={onHourChange}
            onMinuteChange={onMinuteChange}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => { onClear(); }} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>清除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.confirmBtnText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 320, backgroundColor: '#FFF', borderRadius: 18, padding: 20, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  clearBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F0F0F0' },
  clearBtnText: { color: '#D10000', fontWeight: '600', fontSize: 14 },
  confirmBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0055A8' },
  confirmBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});