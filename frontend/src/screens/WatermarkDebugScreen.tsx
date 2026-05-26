import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import UPNG from 'upng-js';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import {
  generateWatermarkLetters,
  generateWatermarkMask,
} from '../utils/watermark';

const DEBUG_W = 1000;
const DEBUG_H = 2000;

const C = {
  bg: '#F5F5F5', card: '#FFF', text: '#333', textSec: '#888',
  primary: '#0055A8',
};

export const WatermarkDebugScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { showAlert, alertProps } = useAlertModal();
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState('');

  const handleGenerate = async () => {
    setRunning(true);
    setResultUri(null);
    setInfo('');
    try {
      const letters = generateWatermarkLetters();

      // 生成 1000×2000 白底明文水印
      const rgba = new Uint8Array(DEBUG_W * DEBUG_H * 4);
      for (let i = 0; i < DEBUG_W * DEBUG_H; i++) {
        const pi = i << 2;
        rgba[pi] = 255; rgba[pi + 1] = 255; rgba[pi + 2] = 255; rgba[pi + 3] = 255;
      }

      // 新版 3 参数签名
      const mask = generateWatermarkMask(DEBUG_W, DEBUG_H, letters);

      // 明文叠加：黑色掩码区域变灰
      for (let i = 0; i < DEBUG_W * DEBUG_H; i++) {
        if (mask[i] < 128) {
          const pi = i << 2;
          rgba[pi] = 210; rgba[pi + 1] = 210; rgba[pi + 2] = 210;
        }
      }
      const outBuf = UPNG.encode([rgba.buffer], DEBUG_W, DEBUG_H);
      const bytes = new Uint8Array(outBuf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      setResultUri('data:image/png;base64,' + btoa(bin));
      setInfo(`字母: ${letters}`);
    } catch (e: any) {
      showAlert({ title: '错误', message: e?.message || String(e), icon: 'error-outline', iconColor: '#E53935', simple: true });
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>水印明文调试 1000×2000</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.genBtn} onPress={handleGenerate} disabled={running} activeOpacity={0.7}>
          {running ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.genBtnText}>生成明文水印</Text>}
        </TouchableOpacity>
        {info ? <Text style={styles.info}>{info}</Text> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {resultUri && (
          <View style={styles.card}>
            <Image source={{ uri: resultUri }} style={styles.preview} resizeMode="contain" />
          </View>
        )}
      </ScrollView>

      <AlertModal {...alertProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  actions: { padding: 12, gap: 8 },
  genBtn: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  genBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  info: { fontSize: 13, color: C.textSec, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 8, padding: 8 },
  preview: { width: '100%', aspectRatio: DEBUG_W / DEBUG_H, borderRadius: 4 },
});
