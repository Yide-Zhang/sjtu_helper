import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getJAccountUsername, getCommunityPassword } from '../utils/storage';

const COMMUNITY_URL = 'https://course.sjtu.plus';

export const CourseCommunityScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [autoLoginDone, setAutoLoginDone] = useState(false);
  const [pageTitle, setPageTitle] = useState('选课社区');

  const injectAutoLogin = async () => {
    const user = await getJAccountUsername();
    let pass = await getCommunityPassword();
    if (!pass) {
      // 没有独立密码则用 jAccount 密码
      const { getJAccountPassword } = await import('../utils/storage');
      pass = await getJAccountPassword();
    }
    if (!user || !pass) return;

    // 等待页面加载完成后注入
    const js = `
      (function() {
        // 检查是否在登录页（有"使用密码登录"按钮）
        var btn = document.querySelector('button');
        if (!btn || btn.textContent.indexOf('使用密码登录') === -1) return;

        // 填充用户名
        var usernameInput = document.querySelector('input[placeholder*="jAccount"]');
        if (usernameInput) {
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(usernameInput, '${user}');
          usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
          usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 填充密码
        var passwordInput = document.querySelector('input[type="password"]');
        if (passwordInput) {
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(passwordInput, '${pass}');
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 点击登录按钮
        setTimeout(function() {
          var loginBtn = document.querySelector('button');
          if (loginBtn && loginBtn.textContent.indexOf('使用密码登录') !== -1) {
            loginBtn.click();
          }
        }, 300);
      })();
    `;
    webviewRef.current?.injectJavaScript(js);
    setAutoLoginDone(true);
  };

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url;
    // 检测是否已登录成功（不在登录页了）
    if (autoLoginDone && url && !url.includes('/login')) {
      setLoading(false);
    }
    if (url && url.includes('/login')) {
      // 在登录页，尝试自动填充
      setTimeout(() => injectAutoLogin(), 500);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
        <TouchableOpacity onPress={() => webviewRef.current?.reload()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="refresh" size={22} color="#666" />
        </TouchableOpacity>
      </View>
      <WebView
        ref={webviewRef}
        source={{ uri: COMMUNITY_URL }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        onLoadEnd={() => {
          setLoading(false);
          injectAutoLogin();
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          if (event.nativeEvent.data?.startsWith('__title__')) {
            setPageTitle(event.nativeEvent.data.replace('__title__', ''));
          }
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0055A8" />
            <Text style={styles.loadingText}>加载选课社区...</Text>
          </View>
        )}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0055A8" />
          <Text style={styles.loadingText}>加载选课社区...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    backgroundColor: '#FFF',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#333', textAlign: 'center' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  loadingText: { fontSize: 13, color: '#999', marginTop: 8 },
});
