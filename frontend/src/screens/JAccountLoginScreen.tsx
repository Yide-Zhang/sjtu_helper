import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getJAccountUsername, getJAccountPassword } from '../utils/storage';
import { loadCaptchaModel, recognizeCaptcha, getCaptchaExtractJS, getCaptchaFillJS } from '../utils/captcha';
import { ensureMailAuth } from '../api/mail';

const MAX_RETRIES = 5;
const log = (msg: string, ...args: any[]) => console.log(`[JAccountLogin] ${msg}`, ...args);
const warn = (msg: string, ...args: any[]) => console.warn(`[JAccountLogin] ${msg}`, ...args);

export const JAccountLoginScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();

  const [silentMode, setSilentMode] = useState(true);               
  const [statusMessage, setStatusMessage] = useState('正在准备登录...');
  const [webViewReady, setWebViewReady] = useState(false);           
  const [recognizingUI, setRecognizingUI] = useState(false);         

  const webviewRef = useRef<WebView>(null);
  const [injectJS, setInjectJS] = useState('');
  const [pageUrl, setPageUrl] = useState('about:blank');
  const [webViewLoading, setWebViewLoading] = useState(false);

  const retryCountRef = useRef(0);
  const recognizingRef = useRef(false);
  const loginHandledRef = useRef(false);

  const mode = route?.params?.mode || 'auto';     

  useEffect(() => {
    loadCaptchaModel().catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'logout') {
      setSilentMode(false);
      setStatusMessage('正在登出...');
      
      try {
        (WebView as any).clearCookies();
      } catch (_) {}

      setPageUrl('https://jaccount.sjtu.edu.cn/jaccount/logout');
      setWebViewLoading(true);
      setWebViewReady(true);
      return;
    }

    loginHandledRef.current = false;
    retryCountRef.current = 0;
    recognizingRef.current = false;
    setRecognizingUI(false);
    setWebViewReady(false);

    if (mode === 'manual') {
      setSilentMode(false);
      setStatusMessage('请手动登录');
      startWebViewLogin();
    } else {
      setSilentMode(true);
      setStatusMessage('正在清除旧冲突状态...');
      
      setTimeout(() => {
        startWebViewLogin();
      }, 200);

      // 安全回退：如果 silentMode 下 15 秒内没有任何登录处理完成，自动切回 manual
      const timeoutId = setTimeout(() => {
        if (!loginHandledRef.current) {
          console.log('[JAccountLoginScreen] ⏱️ silentMode login fallback timeout, switching to manual.');
          switchToManual();
        }
      }, 15000);

      return () => clearTimeout(timeoutId);
    }
  }, [mode]);

  const startWebViewLogin = () => {
    const buildInjectJS = async () => {
      const user = await getJAccountUsername();
      const pass = await getJAccountPassword();

      let fillJs = '';
      if (user && pass && mode !== 'manual') {
        fillJs = `
          setTimeout(function() {
            var u = document.getElementById('input-login-user');
            var p = document.getElementById('input-login-pass');
            if (u && p) {
              var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              setter.call(u, '${user}');
              u.dispatchEvent(new Event('input', { bubbles: true }));
              setter.call(p, '${pass}');
              p.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 500);
        `;
      }

      const xhrInterceptor = `
        (function() {
          var origOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function() {
            this.addEventListener('load', function() {
              if (this.responseURL && this.responseURL.indexOf('ulogin') >= 0) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'loginResult', data: this.responseText
                }));
              }
            });
            origOpen.apply(this, arguments);
          };
        })();
      `;

      const js = fillJs + '\n' + xhrInterceptor + '\n' + getCaptchaExtractJS();
      setInjectJS(js);
      setPageUrl('https://i.sjtu.edu.cn/jaccountlogin');
      setWebViewLoading(true);
      setWebViewReady(true);
    };

    buildInjectJS();
  };

  // 统一的退出/取消处理函数
  const handleUserCancel = useCallback(() => {
    console.log('[JAccountLoginScreen] 用户主动取消，返回主页');
    navigation.goBack();
  }, [navigation]);

  const switchToManual = useCallback(() => {
    setSilentMode(false);
    setStatusMessage('请手动登录');
    loginHandledRef.current = false;
    retryCountRef.current = 0;
    recognizingRef.current = false;
    setRecognizingUI(false);

    const xhrInterceptor = `
      (function() {
        var origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function() {
          this.addEventListener('load', function() {
            if (this.responseURL && this.responseURL.indexOf('ulogin') >= 0) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'loginResult', data: this.responseText
              }));
            }
          });
          origOpen.apply(this, arguments);
        };
      })();
    `;
    setInjectJS(xhrInterceptor + '\n' + getCaptchaExtractJS());
    setPageUrl('https://i.sjtu.edu.cn/jaccountlogin');
    setWebViewLoading(true);
  }, []);

  const handleMessage = useCallback(async (event: any) => {
    try {
      const raw = event.nativeEvent.data;
      const msg = JSON.parse(raw);

      if (msg.type === 'captcha' && msg.data) {
        if (recognizingRef.current || loginHandledRef.current) return;
        recognizingRef.current = true;
        setRecognizingUI(true);
        setStatusMessage('正在识别验证码...');

        try {
          const captchaText = await recognizeCaptcha(msg.data);
          if (!captchaText || captchaText.length === 0) {
            recognizingRef.current = false;
            setRecognizingUI(false);
            retryLogin();
            return;
          }
          webviewRef.current?.injectJavaScript(getCaptchaFillJS(captchaText));
          setStatusMessage('正在提交登录...');
        } catch (e: any) {
          recognizingRef.current = false;
          setRecognizingUI(false);
          retryLogin();
          return;
        }
        recognizingRef.current = false;
        setRecognizingUI(false);
        return;
      }

      if (msg.type === 'loginResult' && msg.data && !loginHandledRef.current) {
        loginHandledRef.current = true;
        try {
          const result = JSON.parse(msg.data);
          if (result.errno === 0) {
            setStatusMessage('登录成功！');
            setTimeout(() => {
              navigation.goBack();
            }, 600);
            return;
          }

          if (result.code === 'WRONG_USER_OR_PASSWORD') {
            if (silentMode) {
              Alert.alert('登录失败', 'jAccount 用户名或密码错误。', [
                { text: '取消', onPress: handleUserCancel },
                { text: '去修改', onPress: () => navigation.replace('SettingsEdit', { type: 'jaccount' }) },
              ]);
            } else {
              Alert.alert('登录失败', '用户名或密码错误，请重试');
              loginHandledRef.current = false;
            }
            return;
          }

          if (result.code === 'WRONG_CAPTCHA') {
            const attempt = retryCountRef.current + 1;
            if (attempt >= MAX_RETRIES) {
              loginHandledRef.current = false;
              Alert.alert('验证码识别超限', '自动验证码识别多次失败，请切换到浏览器手动登录。', [
                { text: '好的', onPress: () => switchToManual() }
              ]);
              return;
            }
            loginHandledRef.current = false;
            setStatusMessage(`验证码识别错误，重试第 ${attempt} 次...`);
            retryLogin();
            return;
          }

          loginHandledRef.current = false;
          if (silentMode) {
            switchToManual();
          } else {
            retryLogin();
          }
        } catch (e) {
          loginHandledRef.current = false;
        }
      }
    } catch (e) {}
  }, [silentMode, switchToManual, handleUserCancel, navigation]);

  const retryLogin = useCallback(() => {
    retryCountRef.current += 1;
    recognizingRef.current = false;
    setRecognizingUI(false);
    webviewRef.current?.injectJavaScript(`window.location.reload(true);`);
  }, []);

  const handleNavigationStateChange = useCallback((navState: any) => {
    const { url } = navState;

    if (mode === 'logout') {
      if (url.includes('jaccount.sjtu.edu.cn/oauth2') || url.includes('jaccount.sjtu.edu.cn/logout')) return;
      if (url.includes('jaccount.sjtu.edu.cn') || url.includes('login') || url.includes('i.sjtu.edu.cn')) {
        Alert.alert('已登出', 'jAccount 会话已清除');
        navigation.goBack();
        return;
      }
    }

    if (!loginHandledRef.current &&
        (url.includes('i.sjtu.edu.cn/xtgl/index_cxDbsy.html') || url.includes('i.sjtu.edu.cn/xtgl/index_initMenu.html'))) {
      loginHandledRef.current = true;
      // 后台自动获取邮箱凭证
      ensureMailAuth().then(ok => {
        console.log('[JAccountLogin] 邮箱认证' + (ok ? '成功' : '失败（可稍后重试）'));
      });
      setTimeout(() => {
        navigation.goBack();
      }, 400);
    }
    setWebViewLoading(false);
  }, [mode, navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {silentMode && (
        <View style={styles.silentOverlay}>
          <View style={styles.silentCard}>
            <ActivityIndicator size="large" color="#0055A8" />
            <Text style={styles.silentTitle}>正在自动同步</Text>
            <Text style={styles.silentSubtitle}>{statusMessage}</Text>
            <Text style={styles.silentHint}>请勿关闭此页面</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleUserCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!silentMode && (
        <View style={styles.header}>
          <TouchableOpacity onPress={handleUserCancel} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>关闭</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{statusMessage}</Text>
        </View>
      )}

      {webViewReady && (
        <View style={silentMode ? styles.webviewHidden : styles.webviewVisible}>
          <WebView
            ref={webviewRef}
            source={{ uri: pageUrl }}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleMessage}
            injectedJavaScript={injectJS}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            mixedContentMode="compatibility"
            onLoadStart={() => { setWebViewLoading(true); }}
            onLoadEnd={() => { setWebViewLoading(false); }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  silentOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(244, 246, 249, 0.97)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  silentCard: { backgroundColor: '#FFF', borderRadius: 20, paddingVertical: 40, paddingHorizontal: 36, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8, width: '80%', maxWidth: 320 },
  silentTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 24 },
  silentSubtitle: { fontSize: 14, color: '#666', marginTop: 10, textAlign: 'center' },
  silentHint: { fontSize: 12, color: '#AAA', marginTop: 20 },
  cancelBtn: { marginTop: 28, paddingVertical: 10, paddingHorizontal: 32, borderRadius: 10, borderWidth: 1, borderColor: '#DDD' },
  cancelBtnText: { fontSize: 15, color: '#999', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF' },
  backBtn: { marginRight: 16 },
  backBtnText: { fontSize: 16, color: '#0055A8' },
  title: { fontSize: 18, fontWeight: '600', color: '#333' },
  webviewHidden: { position: 'absolute', top: -9999, left: -9999, width: 375, height: 667 },
  webviewVisible: { flex: 1 },
});