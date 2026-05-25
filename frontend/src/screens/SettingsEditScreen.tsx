import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking, Keyboard, Modal } from 'react-native';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 规范：移出函数体，在顶部静态安全导入，杜绝 HMRClient 崩溃错误
import { storeToken, setJAccountUsername, setJAccountPassword, getToken, getJAccountUsername, getJAccountPassword, getCommunityPassword, setCommunityPassword } from '../utils/storage';

const USER_NAME_KEY = 'USER_NAME';

const TYPE_CONFIG: Record<string, { title: string; placeholder: string; icon: string; secure?: boolean }> = {
  nickname: { title: '修改昵称', placeholder: '怎么称呼您？', icon: 'person' },
  canvasToken: { title: '修改 Canvas Token', placeholder: '输入新的 Canvas Token', icon: 'key', secure: true },
  jaccount: { title: 'jAccount 凭据', placeholder: '', icon: 'lock' },
  communityPwd: { title: '选课社区密码', placeholder: '输入选课社区的独立密码', icon: 'forum', secure: true },
};

export const SettingsEditScreen = ({ navigation, route }: any) => {
  const { showAlert, alertProps } = useAlertModal();
  const insets = useSafeAreaInsets();
  const { type } = route.params;
  const config = TYPE_CONFIG[type] || { title: '编辑', placeholder: '', icon: 'edit' };
  const [value, setValue] = useState('');
  const [juser, setJuser] = useState('');
  const [jpass, setJpass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showCommunityPwd, setShowCommunityPwd] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedModalType, setSavedModalType] = useState<'simple' | 'jaccount'>('simple');

  useEffect(() => {
    loadValue();
  }, []);

  const loadValue = async () => {
    if (type === 'nickname') {
      const v = await AsyncStorage.getItem(USER_NAME_KEY);
      setValue(v || '');
    } else if (type === 'canvasToken') {
      const v = await getToken();
      setValue(v || '');
    } else if (type === 'jaccount') {
      setJuser((await getJAccountUsername()) || '');
      setJpass((await getJAccountPassword()) || '');
    } else if (type === 'communityPwd') {
      const v = await getCommunityPassword();
      setValue(v || '');
    }
  };

  const handleSave = async () => {
    if (type === 'nickname') {
      await AsyncStorage.setItem(USER_NAME_KEY, value.trim());
    } else if (type === 'canvasToken') {
      await storeToken(value.trim());
    } else if (type === 'jaccount') {
      await setJAccountUsername(juser.trim());
      await setJAccountPassword(jpass);
    } else if (type === 'communityPwd') {
      await setCommunityPassword(value);
    }

    if (type === 'jaccount') {
      setSavedModalType('jaccount');
    } else {
      setSavedModalType('simple');
    }
    setShowSavedModal(true);
  };

  // 登出 jAccount — 清除所有活跃会话（保留本地凭据以支持重新自动登录）
  const handleLogout = async () => {
    showAlert({
      title: '登出 jAccount',
      message: '确定要退出登录吗？（将同时退出邮箱和 i.sjtu 会话，本地保存的凭据供下次自动登录使用）',
      icon: 'logout',
      iconColor: '#E53935',
      buttons: [
        { text: '取消', style: 'cancel' },
        { text: '登出', style: 'destructive', onPress: async () => {
          try { await (WebView as any).clearCookies(); } catch (e) {}
          try {
            await fetch('https://i.sjtu.edu.cn/logout?t=' + Date.now() + '&login_type=',
              { headers: { 'User-Agent': 'Mozilla/5.0' } });
          } catch (e) {}
          try {
            await fetch('https://jaccount.sjtu.edu.cn/oauth2/logout?post_logout_redirect_uri=https%3A%2F%2Fi.sjtu.edu.cn%2Fxtgl%2Flogin_slogin.html&client_id=MVJGw8u0bzoMJVbfb4Fk',
              { headers: { 'User-Agent': 'Mozilla/5.0' } });
          } catch (e) {}
          try {
            const { removeMailAuthToken, removeMailCsrfToken, removeMailSessionId } = await import('../utils/mailStorage');
            await removeMailAuthToken();
            await removeMailCsrfToken();
            await removeMailSessionId();
          } catch (e) {}
          showAlert({ title: '已登出', message: 'jAccount 会话已退出，本地凭据已保留', icon: 'info', simple: true });
        }},
      ],
    });
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{config.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {type === 'jaccount' ? (
          <View>
            <View style={styles.card}>
              <View style={styles.row}>
                <MaterialIcons name="person" size={22} color="#5C6BC0" />
                <TextInput style={styles.input} placeholder="jAccount 用户名" placeholderTextColor="#BBB" value={juser} onChangeText={setJuser} autoFocus />
              </View>
              <View style={[styles.row, { marginTop: 16 }]}>
                <MaterialIcons name="lock" size={22} color="#78909C" />
                <View style={styles.passRow}>
                  <TextInput style={styles.input} placeholder="jAccount 密码" placeholderTextColor="#BBB" value={jpass} onChangeText={setJpass} secureTextEntry={!showPass} />
                  <TouchableOpacity onPress={() => { setShowPass(!showPass); Keyboard.dismiss(); }} style={styles.toggleBtn} activeOpacity={0.6}>
                    <Ionicons name={showPass ? 'eye' : 'eye-off'} size={24} color={showPass ? '#0055A8' : '#999'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {/* 登出按钮 — 小字，只有保存凭据后才显示 */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.6}>
              <MaterialIcons name="logout" size={14} color="#E65100" />
              <Text style={styles.logoutBtnText}>登出 jAccount</Text>
            </TouchableOpacity>
          </View>
        ) : type === 'communityPwd' ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <MaterialIcons name="forum" size={22} color="#7B1FA2" />
              <View style={styles.passRow}>
                <TextInput style={styles.input} placeholder={config.placeholder} placeholderTextColor="#BBB" value={value} onChangeText={setValue} secureTextEntry={!showCommunityPwd} autoFocus />
                <TouchableOpacity onPress={() => { setShowCommunityPwd(!showCommunityPwd); Keyboard.dismiss(); }} style={styles.toggleBtn} activeOpacity={0.6}>
                  <Ionicons name={showCommunityPwd ? 'eye' : 'eye-off'} size={24} color={showCommunityPwd ? '#0055A8' : '#999'} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : type === 'canvasToken' ? (
          <View>
            <View style={styles.card}>
              <View style={[styles.row, { alignItems: 'flex-start' }]}>
                <MaterialIcons name="vpn-key" size={22} color="#FFA000" />
                <TextInput style={[styles.inputLarge, { flex: 1 }]} placeholder={config.placeholder} placeholderTextColor="#BBB" value={value} onChangeText={setValue} multiline textAlignVertical="top" />
              </View>
            </View>
            <Text style={styles.tokenHint}>
              您可以<Text style={styles.tokenLink} onPress={() => Linking.openURL('https://oc.sjtu.edu.cn/profile/settings')}>点击这里</Text>
              后在{'\u201C'}允许融入使用的外部软件：{'\u201D'}下点击{'\u201C'}创建新访问许可证{'\u201D'}获取Canvas Token。获取后，请立刻保存在重要位置，遗失无法找回，只能重新创建。
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <MaterialIcons name={config.icon} size={22} color="#5C6BC0" />
              <TextInput style={styles.input} placeholder={config.placeholder} placeholderTextColor="#BBB" value={value} onChangeText={setValue} secureTextEntry={config.secure} autoFocus />
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Text style={styles.saveBtnText}>保存</Text>
        </TouchableOpacity>
      </View>

      {/* 已保存弹窗 */}
      <Modal visible={showSavedModal} transparent animationType="fade" onRequestClose={() => setShowSavedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.savedModal}>
            <Text style={styles.savedModalTitle}>已保存</Text>
            {savedModalType === 'jaccount' && (
              <Text style={styles.savedModalBody}>凭据已保存，是否自动登录以验证？</Text>
            )}
            <View style={styles.savedModalActions}>
              {savedModalType === 'jaccount' ? (
                <>
                  <TouchableOpacity style={styles.savedBtnSecondary} onPress={() => { setShowSavedModal(false); navigation.goBack(); }} activeOpacity={0.7}>
                    <Text style={styles.savedBtnSecondaryText}>稍后</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.savedBtnPrimary} onPress={() => { setShowSavedModal(false); navigation.replace('JAccountLogin', { mode: 'login' }); }} activeOpacity={0.7}>
                    <Text style={styles.savedBtnPrimaryText}>自动登录</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.savedBtnPrimary} onPress={() => { setShowSavedModal(false); navigation.goBack(); }} activeOpacity={0.7}>
                  <Text style={styles.savedBtnPrimaryText}>好</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      <AlertModal {...alertProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { fontSize: 22, color: '#0055A8', fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerSpacer: { width: 30 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 20, marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#333', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 8 },
  inputLarge: { flex: 1, fontSize: 15, color: '#333', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingVertical: 10, minHeight: 80, lineHeight: 22 },
  passRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  toggleBtn: { padding: 8, marginLeft: 4 },
  saveBtn: { backgroundColor: '#0055A8', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginBottom: 8, gap: 4 },
  logoutBtnText: { color: '#E65100', fontSize: 13, fontWeight: '600' },
  tokenHint: { color: '#999', fontSize: 12, lineHeight: 18, paddingHorizontal: 4, marginBottom: 16 },
  tokenLink: { color: '#0055A8', fontWeight: '600', textDecorationLine: 'underline' },

  // 已保存弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  savedModal: {
    width: '78%', backgroundColor: '#FFF', borderRadius: 16, padding: 24,
    alignItems: 'center', elevation: 8,
  },
  savedModalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  savedModalBody: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  savedModalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  savedBtnPrimary: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#0055A8', minWidth: 80, alignItems: 'center',
  },
  savedBtnPrimaryText: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  savedBtnSecondary: {
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#F0F0F0', minWidth: 80, alignItems: 'center',
  },
  savedBtnSecondaryText: { fontSize: 15, color: '#666', fontWeight: '600' },
});