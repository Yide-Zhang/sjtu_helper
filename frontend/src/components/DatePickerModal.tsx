import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { DatePicker } from './DatePicker';

interface Props {
  visible: boolean;
  date: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  onClear: () => void;
}

export const DatePickerModal: React.FC<Props> = ({ visible, date, onChange, onClose, onClear }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>选择日期</Text>

          <DatePicker date={date} onChange={onChange} />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearBtn} onPress={() => { onClear(); onClose(); }} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>清除日期</Text>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  clearBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  clearBtnText: {
    color: '#D10000',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0055A8',
  },
  confirmBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
