import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCourseHTML, fetchWeeklyScheduleJSON, checkJAccountSession } from '../api/jaccount';
import { getJAccountUsername, getJAccountPassword, getScheduleUpdateInterval, setScheduleUpdateInterval, getExamUpdateInterval, setExamUpdateInterval, getDevModeEnabled, persistDevModeEnabled, getCrazyThursdayEnabled, setCrazyThursdayEnabled, isCrazyThursdayDismissedThisWeek, getBackgroundInterval, setBackgroundInterval } from '../utils/storage';
import { diagnoseMailAuth, fetchFolder, ensureMailAuth } from '../api/mail';
import { getMailAuthToken, getMailCsrfToken } from '../utils/mailStorage';
import { fetchIsjtuNotices, IsjtuNotice, parseTiaoKe } from '../api/isjtu';
import { getBatteryOptimizationGuide, getDeviceInfoString } from '../utils/batteryOptimization';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const DEV_PASSWORD = 'devPAss';
const INTERVAL_OPTIONS = [1, 3, 7];
const BG_INTERVAL_OPTIONS = [0, 15, 30, 60];

const SETTING_ICON_COLORS: Record<string, string> = {
  nickname: '#5C6BC0',
  canvasToken: '#FFA000',
  jaccount: '#26A69A',
  communityPwd: '#7B1FA2',
  jaccountLogin: '#42A5F5',
  scheduleInterval: '#66BB6A',
  examInterval: '#EF5350',
  crazyThursday: '#FF6F00',
  backgroundInterval: '#42A5F5',
  devMode: '#8D6E63',
  semesterDebug: '#E65100',
  version: '#90A4AE',
};

const SETTINGS_SECTIONS = [
  {
    title: '个人信息',
    items: [
      { key: 'nickname', icon: 'person', label: '昵称', desc: '设置你的显示名称' },
      { key: 'canvasToken', icon: 'vpn-key', label: 'Canvas Token', desc: '设置你的Canvas Token' },
      { key: 'jaccount', icon: 'lock', label: 'jAccount 凭据', desc: '设置你的jAccount用户名和密码' },
      { key: 'communityPwd', icon: 'forum', label: '选课社区密码（相关功能敬请期待）', desc: '设置选课社区的独立密码' },
      { key: 'jaccountLogin', icon: 'language', label: '登录 jAccount', desc: '单击以登录jAccount' },
    ],
  },
  {
    title: '自定义',
    items: [
      { key: 'scheduleInterval', icon: 'calendar-today', label: '课表更新间隔', desc: '课表缓存有效期' },
      { key: 'examInterval', icon: 'edit-note', label: '考试更新间隔', desc: '考试信息缓存有效期' },
      { key: 'crazyThursday', icon: 'celebration', label: 'Crazy Thursday', desc: '每周四显示彩蛋图片' },
      { key: 'backgroundInterval', icon: 'sync', label: '后台刷新间隔', desc: '关闭（仅前台刷新）' },
    ],
  },
  {
    title: '关于',
    items: [
      { key: 'devMode', icon: 'build', label: '开发者模式', desc: '输入密码解锁调试功能' },
      { key: 'version', icon: 'info', label: '版本', desc: `SJTU Helper v${Constants.expoConfig?.version || '1.0'}` },
    ],
  },
];

export const SettingsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [showDevPwdModal, setShowDevPwdModal] = useState(false);
  const [devPwdInput, setDevPwdInput] = useState('');
  const [scheduleInterval, setScheduleIntervalState] = useState(1);
  const [examInterval, setExamIntervalState] = useState(1);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [intervalMode, setIntervalMode] = useState<'schedule' | 'exam'>('schedule');
  const [tempInterval, setTempInterval] = useState(1);
  const [crazyThuEnabled, setCrazyThuEnabled] = useState(true);
  // 后台刷新间隔
  const [bgInterval, setBgInterval] = useState(0);
  const [showBgIntervalModal, setShowBgIntervalModal] = useState(false);
  const [tempBgInterval, setTempBgInterval] = useState(0);
  // 邮件联想诊断
  const [showSuggestTest, setShowSuggestTest] = useState(false);
  // 教务通知诊断
  const [showNotifTest, setShowNotifTest] = useState(false);
  const [notifTestItems, setNotifTestItems] = useState<IsjtuNotice[]>([]);
  const [notifTestLoading, setNotifTestLoading] = useState(false);
  const [notifTestStatus, setNotifTestStatus] = useState('');
  // 关闭开发者模式确认弹窗
  const [showCloseDevModal, setShowCloseDevModal] = useState(false);
  // 校历诊断
  const [showSemesterDebug, setShowSemesterDebug] = useState(false);
  const [semDebugInfo, setSemDebugInfo] = useState('');
  const [semDebugLoading, setSemDebugLoading] = useState(false);
  // 置顶缓存测试
  const [showPinnedCacheTest, setShowPinnedCacheTest] = useState(false);

  // 测试通知弹窗
  const [showTestNotifModal, setShowTestNotifModal] = useState(false);
  const [testNotifBgMode, setTestNotifBgMode] = useState(false);

  // 电池优化引导弹窗
  const [showBatteryGuideModal, setShowBatteryGuideModal] = useState(false);
  const [batteryGuideData, setBatteryGuideData] = useState<{ title: string; steps: string[]; deviceInfo: string }>({ title: '', steps: [], deviceInfo: '' });

  // 清除数据弹窗
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearState, setClearState] = useState<'confirm' | 'clearing' | 'success' | 'error'>('confirm');
  const [clearErrorMsg, setClearErrorMsg] = useState('');

  const handleClearData = async () => {
    setClearState('clearing');
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      setClearState('success');
    } catch (e: any) {
      setClearErrorMsg(e?.message || '未知错误');
      setClearState('error');
    }
  };
  const [pinnedCacheInfo, setPinnedCacheInfo] = useState('');
  const [pinnedCacheItems, setPinnedCacheItems] = useState<any[]>([]);
  const [suggestTestContacts, setSuggestTestContacts] = useState<{name:string;address:string}[]>([]);
  const [suggestTestLoading, setSuggestTestLoading] = useState(false);
  const [suggestTestText, setSuggestTestText] = useState('');
  const [suggestTestResult, setSuggestTestResult] = useState<{name:string;address:string}[]>([]);
  const [suggestTestStatus, setSuggestTestStatus] = useState('');

  useEffect(() => {
    getCrazyThursdayEnabled().then(setCrazyThuEnabled);
  }, []);

  // 加载持久化状态
  React.useEffect(() => {
    (async () => {
      const [v, dev, ev, bg] = await Promise.all([
        getScheduleUpdateInterval(),
        getDevModeEnabled(),
        getExamUpdateInterval(),
        getBackgroundInterval(),
      ]);
      setScheduleIntervalState(v);
      setDevModeEnabled(dev);
      setExamIntervalState(ev);
      setBgInterval(bg);
      setTempBgInterval(bg);
    })();
  }, []);

  // 开发者模式密码验证
  const handleDevPwdSubmit = () => {
    if (devPwdInput === DEV_PASSWORD) {
      setDevModeEnabled(true);
      persistDevModeEnabled(true);
      setShowDevPwdModal(false);
      setDevPwdInput('');
      Alert.alert('开发者模式', '已开启');
    } else {
      setShowDevPwdModal(false);
      setDevPwdInput('');
      Alert.alert('错误', '密码错误');
    }
  };

  const handlePress = async (key: string) => {
    if (key === 'version') return;
    if (key === 'jaccountLogin') {
      navigation.navigate('JAccountLogin', { mode: 'auto' });
      return;
    }
    if (key === 'devMode') {
      if (devModeEnabled) {
        setShowCloseDevModal(true);
      } else {
        setDevPwdInput('');
        setShowDevPwdModal(true);
      }
      return;
    }
    if (key === 'scheduleInterval') {
      const current = await getScheduleUpdateInterval();
      setIntervalMode('schedule');
      setTempInterval(current);
      setShowIntervalModal(true);
      return;
    }
    if (key === 'examInterval') {
      const current = await getExamUpdateInterval();
      setIntervalMode('exam');
      setTempInterval(current);
      setShowIntervalModal(true);
      return;
    }
    if (key === 'backgroundInterval') {
      const current = await getBackgroundInterval();
      setTempBgInterval(current);
      setShowBgIntervalModal(true);
      return;
    }

    if (key === 'jaccountStatus') {
      (async () => {
        try {
          const jUser = await getJAccountUsername();
          const jPass = await getJAccountPassword();
          const hasCreds = !!(jUser && jPass);
          const credsInfo = hasCreds
            ? `用户名: ${jUser}\n密码: ${'•'.repeat(Math.min(jPass!.length, 12))}`
            : '未保存 jAccount 凭据';

          let sessionInfo = '未检测';
          if (hasCreds) {
            const isAlive = await checkJAccountSession();
            sessionInfo = isAlive ? '会话有效' : '会话已过期';
          }

          Alert.alert(
            'jAccount 诊断',
            `凭据状态\n${'─'.repeat(20)}\n${credsInfo}\n\n会话状态\n${'─'.repeat(20)}\n${sessionInfo}`
          );
        } catch (e: any) {
          Alert.alert('诊断失败', e?.message || '未知错误');
        }
      })();
      return;
    }
    if (key === 'calendarCacheStatus') {
      (async () => {
        try {
          setLoading(true);

          // ── 生成所有可能的学年学期组合 ──
          const baseYear = new Date().getFullYear();
          const years: string[] = [];
          for (let y = baseYear + 1; y >= baseYear - 4; y--) years.push(String(y));
          const xqms = ['3', '12', '16'];
          const allSemesters: { xnm: string; xqm: string }[] = [];
          for (const y of years) {
            for (const q of xqms) allSemesters.push({ xnm: y, xqm: q });
          }

          const jUser = await getJAccountUsername();
          const cacheUser = jUser || '__no_user__';
          let fetchedCount = 0;
          let errorCount = 0;

          // ── 遍历每个学期，无缓存则拉取 ──
          for (const s of allSemesters) {
            const cacheKey = `SCHEDULE_CACHE_${cacheUser}_${s.xnm}_${s.xqm}`;
            const existing = await AsyncStorage.getItem(cacheKey);
            if (existing) continue; // 已有缓存，跳过

            try {
              // 取第 1 周数据获取学期起始日和校历列表
              const w1DataStr = await fetchWeeklyScheduleJSON(s.xnm, s.xqm, 1);
              const w1Data = JSON.parse(w1DataStr);
              let startDate: Date | null = null;
              let rqazcList: any[] = [];
              if (w1Data.rqazcList && w1Data.rqazcList.length > 0) {
                rqazcList = w1Data.rqazcList;
                const day1 = w1Data.rqazcList.find((d: any) => d.xqj == 1);
                if (day1 && day1.rq) startDate = new Date(day1.rq);
              }
              if (!startDate) continue; // 无数据则跳过

              // 写入课表缓存（不含 kbList，但校历数据已足够）
              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                kbList: [],
                rqazcList,
                semesterStartDate: startDate.toISOString(),
                timestamp: Date.now(),
              }));

              // 如果是当前学期，也更新 CALENDAR_CACHE
              const now = new Date();
              const month = now.getMonth() + 1;
              let curXnm = String(now.getFullYear());
              let curXqm = '3';
              if (month >= 2 && month <= 6) { curXnm = String(now.getFullYear() - 1); curXqm = '12'; }
              else if (month >= 7 && month <= 8) { curXnm = String(now.getFullYear() - 1); curXqm = '16'; }
              else if (month >= 9 && month <= 12) { curXnm = String(now.getFullYear()); curXqm = '3'; }
              else { curXnm = String(now.getFullYear() - 1); curXqm = '3'; }

              if (s.xnm === curXnm && s.xqm === curXqm) {
                await AsyncStorage.setItem('CALENDAR_CACHE', JSON.stringify({
                  xnm: s.xnm,
                  xqm: s.xqm,
                  semesterStartDate: startDate.toISOString(),
                  rqazcList,
                  timestamp: Date.now(),
                }));
              }

              fetchedCount++;
            } catch {
              errorCount++;
            }
          }

          setLoading(false);

          // ── 构建结果文本 ──
          const allKeys = await AsyncStorage.getAllKeys();
          const scheduleKeys = allKeys.filter((k: string) => k.startsWith('SCHEDULE_CACHE_'));
          const semesterMap: Record<string, Set<string>> = {};
          for (const key of scheduleKeys) {
            const suffix = key.substring('SCHEDULE_CACHE_'.length);
            const parts = suffix.split('_');
            if (parts.length < 3) continue;
            const xqm2 = parts.pop()!;
            const xnm2 = parts.pop()!;
            if (!semesterMap[xnm2]) semesterMap[xnm2] = new Set();
            semesterMap[xnm2].add(xqm2);
          }

          let mainInfo = '';
          const currentJson = await AsyncStorage.getItem('CALENDAR_CACHE');
          if (currentJson) {
            const d = JSON.parse(currentJson);
            const label = d.xqm === '3' ? '秋季' : d.xqm === '12' ? '春季' : '夏季';
            const start = d.semesterStartDate ? new Date(d.semesterStartDate).toLocaleDateString('zh-CN') : '无';
            const maxW = d.xqm === '16' ? 4 : 18;
            const diffDays = Math.floor((Date.now() - new Date(d.semesterStartDate).getTime()) / (1000 * 60 * 60 * 24));
            const calcW = Math.floor(diffDays / 7) + 1;
            let wkInfo = '';
            if (calcW >= 1 && calcW <= maxW) wkInfo = `（当前第 ${calcW} 周）`;
            else if (calcW < 1) wkInfo = '（尚未开学）';
            else wkInfo = '（学期已结束）';
            mainInfo = `${d.xnm}-${Number(d.xnm) + 1} ${label}\n起始: ${start}\n${maxW} 周${wkInfo}\n${d.timestamp ? new Date(d.timestamp).toLocaleString('zh-CN') : '未知'}`;
          }

          const entries = Object.entries(semesterMap).sort(([a], [b]) => Number(b) - Number(a));
          let othersText = '';
          if (entries.length > 0) {
            othersText = '\n\n已有校历：\n' + entries.map(([x, xqms]) => {
              const codes = Array.from(xqms)
                .map(v => ({ '3': '1', '12': '2', '16': '3' } as Record<string, string>)[v] || v)
                .sort()
                .join('/');
              return `${x}-${Number(x) + 1}-${codes}`;
            }).join('\n');
          }

          const summary = fetchedCount > 0 || errorCount > 0
            ? `\n\n${fetchedCount > 0 ? `新获取 ${fetchedCount} 个学期` : ''}${errorCount > 0 ? `\n${errorCount} 个学期无数据或失败` : ''}`
            : '';

          Alert.alert('校历缓存', `${mainInfo}${othersText}${summary}`);
        } catch (e: any) {
          setLoading(false);
          Alert.alert('诊断失败', e?.message || '未知错误');
        }
      })();
      return;
    }
    if (key === 'mailDiagnose') {
      (async () => {
        setLoading(true);
        try {
          const result = await diagnoseMailAuth();
          const lines = result.steps.map((s, i) =>
            `${i + 1}. ${s.ok ? '✅' : '❌'} ${s.name}\n   ${s.detail}${s.detail ? '' : ''}`
          ).join('\n\n');
          Alert.alert(
            `邮箱诊断 ${result.success ? '✅ 正常' : '❌ 失败'}`,
            lines
          );
        } catch (e: any) {
          Alert.alert('诊断异常', e?.message || '未知错误');
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    if (key === 'crazyThursdayStatus') {
      (async () => {
        const now = new Date();
        const day = now.getDay();
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const isThu = day === 4;
        const enabled = await getCrazyThursdayEnabled();
        const dismissed = await isCrazyThursdayDismissedThisWeek();

        // 检查图片文件是否存在（通过 require 是否抛异常判断）
        let imgOk = false;
        try {
          require('../../assets/crazyThursday.png');
          imgOk = true;
        } catch {}

        Alert.alert(
          'Crazy Thursday 诊断',
          `系统时间: ${now.toLocaleString('zh-CN')}\n` +
          `星期${dayNames[day]}${isThu ? ' ✅ 是周四' : ' ❌ 不是周四'}\n` +
          `${'─'.repeat(20)}\n` +
          `功能开关: ${enabled ? '✅ 开启' : '❌ 关闭'}\n` +
          `本周已关闭: ${dismissed ? '✅ 是' : '❌ 否'}\n` +
          `图片文件: ${imgOk ? '✅ 存在' : '❌ 缺失'}\n` +
          `${'─'.repeat(20)}\n` +
          `显示条件: ${isThu && enabled && !dismissed && imgOk ? '✅ 满足' : '❌ 不满足'}`
        );
      })();
      return;
    }
    if (key === 'testJAccount') {
      if (loading) return;
      setLoading(true);
      try {
        const text = await fetchCourseHTML();
        Alert.alert(
          '课表 JSON 提取成功！', 
          `数据包大小: ${Math.round(text.length / 1024)} KB\n\n已成功获取了包含所有【课程名、上课地点、老师、上课周数】的纯净 JSON，可以开始画课表了！`
        );
      } catch (err: any) {
        Alert.alert('错误', err?.message || '自动登录或抓取失败。');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (key === 'mailSuggestTest') {
      setSuggestTestContacts([]);
      setSuggestTestText('');
      setSuggestTestResult([]);
      setSuggestTestStatus('');
      setShowSuggestTest(true);
      return;
    }
    if (key === 'notifTest') {
      setNotifTestItems([]);
      setNotifTestStatus('');
      setShowNotifTest(true);
      return;
    }
    if (key === 'semesterDebug') {
      setSemDebugInfo('');
      setShowSemesterDebug(true);
      return;
    }
    if (key === 'pinnedCacheTest') {
      setPinnedCacheItems([]);
      setPinnedCacheInfo('');
      setShowPinnedCacheTest(true);
      return;
    }
    if (key === 'testNotif') {
      setShowTestNotifModal(true);
      return;
    }
    if (key === 'renderTest') {
      navigation.navigate('RenderTest');
      return;
    }
    navigation.navigate('SettingsEdit', { type: key });
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title}>设置</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={{ flex: 1 }}>
        {SETTINGS_SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <View key={item.key}>
                  <TouchableOpacity
                    style={[styles.settingRow, ii < section.items.length - 1 && styles.settingRowBorder]}
                    onPress={() => handlePress(item.key)}
                    activeOpacity={item.key === 'version' ? 1 : 0.7}
                  >
                    <MaterialIcons name={item.icon} size={20} color={SETTING_ICON_COLORS[item.key] || '#78909C'} style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>{item.label}</Text>
                      <Text style={styles.settingDesc}>{item.key === 'scheduleInterval' ? `${scheduleInterval} 天` : item.key === 'examInterval' ? `${examInterval} 天` : item.key === 'backgroundInterval' ? (bgInterval === 0 ? '关闭' : `每 ${bgInterval} 分钟`) : item.desc}</Text>
                    </View>
                    {item.key === 'crazyThursday' ? (
                      <Switch
                        value={crazyThuEnabled}
                        onValueChange={async (v) => {
                          setCrazyThuEnabled(v);
                          await setCrazyThursdayEnabled(v);
                        }}
                        trackColor={{ false: '#DDD', true: '#A5D6A7' }}
                        thumbColor={crazyThuEnabled ? '#43A047' : '#EEE'}
                      />
                    ) : (item.key !== 'version' && <MaterialIcons name="chevron-right" size={20} color="#CCC" />)}
                  </TouchableOpacity>
                </View>
              ))}
              {/* 开发者模式下在"关于"区末尾追加诊断入口 */}
              {devModeEnabled && section.title === '关于' && (
                <View>
                  <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => handlePress('jaccountStatus')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="list-alt" size={20} color="#78909C" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>jAccount 诊断</Text>
                      <Text style={styles.settingDesc}>检测凭据与登录状态</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('calendarCacheStatus')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="calendar-today" size={20} color="#78909C" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>校历缓存诊断</Text>
                      <Text style={styles.settingDesc}>查看本地校历缓存状态</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('crazyThursdayStatus')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="celebration" size={20} color="#FF6F00" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>Crazy Thursday 诊断</Text>
                      <Text style={styles.settingDesc}>调试彩蛋显示条件</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('mailDiagnose')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="email" size={20} color="#1A73E8" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>邮箱诊断</Text>
                      <Text style={styles.settingDesc}>调试邮箱认证流程</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('mailSuggestTest')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="people-outline" size={20} color="#7B1FA2" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>邮件联想诊断</Text>
                      <Text style={styles.settingDesc}>测试收件人自动联想功能</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('notifTest')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="notifications" size={20} color="#1565C0" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>教务通知诊断</Text>
                      <Text style={styles.settingDesc}>调试 i.sjtu 通知拉取与解析</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('testNotif')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="notifications-active" size={20} color="#E53935" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>测试通知</Text>
                      <Text style={styles.settingDesc}>发送本地测试通知（验证通知权限）</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={async () => {
                      const guide = getBatteryOptimizationGuide();
                      const devInfo = getDeviceInfoString();
                      setBatteryGuideData({
                        title: `电池优化检测（${guide.brand}）`,
                        steps: guide.guideSteps,
                        deviceInfo: devInfo,
                      });
                      setShowBatteryGuideModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="battery-saver" size={20} color="#FF6F00" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>电池优化检测</Text>
                      <Text style={styles.settingDesc}>查看本机后台白名单设置步骤</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('semesterDebug')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="calendar-month" size={20} color="#E65100" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>校历匹配诊断</Text>
                      <Text style={styles.settingDesc}>查看学期缓存与日期推算详情</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('pinnedCacheTest')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="bookmark" size={20} color="#E65100" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>置顶缓存测试</Text>
                      <Text style={styles.settingDesc}>测试仅从本地缓存渲染置顶项</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => handlePress('renderTest')}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="format-paint" size={20} color="#FF6F00" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingLabel}>渲染测试</Text>
                      <Text style={styles.settingDesc}>预览各卡片超长名称渲染效果</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.settingRow, styles.settingRowBorder]}
                    onPress={() => {
                      setClearState('confirm');
                      setShowClearModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="delete-sweep" size={20} color="#E53935" style={{ marginRight: 14 }} />
                    <View style={styles.settingContent}>
                      <Text style={[styles.settingLabel, { color: '#E53935' }]}>清除所有本地数据</Text>
                      <Text style={styles.settingDesc}>模拟新用户，此操作不可撤销</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CCC" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}
        </ScrollView>

        {/* 开发者密码弹窗 */}
        <Modal visible={showDevPwdModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>开发者模式</Text>
              <Text style={styles.modalDesc}>请输入密码</Text>
              <TextInput
                key={showDevPwdModal ? 'pwd-input' : 'pwd-input-hidden'}
                style={styles.modalInput}
                placeholder="输入密码"
                placeholderTextColor="#BBB"
                secureTextEntry
                value={devPwdInput}
                onChangeText={setDevPwdInput}
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => { setShowDevPwdModal(false); setDevPwdInput(''); }} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDevPwdSubmit} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>确定</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 更新间隔弹窗 */}
        <Modal visible={showIntervalModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{intervalMode === 'exam' ? '考试更新间隔' : '课表更新间隔'}</Text>
              <Text style={styles.modalDesc}>选择缓存有效期，到期后自动重新获取</Text>
              <View style={styles.intervalList}>
                {INTERVAL_OPTIONS.map(d => (
                  <TouchableOpacity key={d} style={styles.intervalRow} onPress={() => setTempInterval(d)} activeOpacity={0.6}>
                    <MaterialIcons name={tempInterval === d ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={tempInterval === d ? '#0055A8' : '#999'} />
                    <Text style={[styles.intervalText, tempInterval === d && styles.intervalTextActive]}>{d} 天</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setShowIntervalModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  if (intervalMode === 'exam') {
                    setExamUpdateInterval(tempInterval);
                    setExamIntervalState(tempInterval);
                  } else {
                    setScheduleUpdateInterval(tempInterval);
                    setScheduleIntervalState(tempInterval);
                  }
                  setShowIntervalModal(false);
                }} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>确定</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 后台刷新间隔弹窗 */}
        <Modal visible={showBgIntervalModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>后台刷新间隔</Text>
              <Text style={styles.modalDesc}>选择关闭后手机在后台不再自动检查更新{'\n'}（需要 Dev Build 支持）</Text>
              <View style={styles.intervalList}>
                {BG_INTERVAL_OPTIONS.map(d => (
                  <TouchableOpacity key={d} style={styles.intervalRow} onPress={() => setTempBgInterval(d)} activeOpacity={0.6}>
                    <MaterialIcons name={tempBgInterval === d ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={tempBgInterval === d ? '#0055A8' : '#999'} />
                    <Text style={[styles.intervalText, tempBgInterval === d && styles.intervalTextActive]}>{d === 0 ? '关闭' : `每 ${d} 分钟`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {tempBgInterval > 0 && (
                <View style={{ width: '100%', marginTop: 4, marginBottom: 8, backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 12, color: '#E65100', fontWeight: '600' }}>⚠ 后台运行需要关闭系统电池优化</Text>
                  <Text style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    点击确定后再查看引导步骤
                  </Text>
                </View>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setShowBgIntervalModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  await setBackgroundInterval(tempBgInterval);
                  setBgInterval(tempBgInterval);
                  setShowBgIntervalModal(false);
                  // 如果开启了后台刷新，弹出电池优化引导
                  if (tempBgInterval > 0) {
                    const guide = getBatteryOptimizationGuide();
                    const devInfo = getDeviceInfoString();
                    setBatteryGuideData({
                      title: `${guide.guideTitle}（${guide.brand}）`,
                      steps: guide.guideSteps,
                      deviceInfo: devInfo,
                    });
                    setShowBatteryGuideModal(true);
                  }
                  // 动态注册/注销后台任务
                  try {
                    const { registerBgTask } = await import('../utils/backgroundTasks');
                    await registerBgTask(tempBgInterval);
                  } catch (e) {
                    console.warn('[BgTask] 注册失败，可能不在 Dev Build 环境中', e);
                  }
                }} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>确定</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 清除数据弹窗 */}
        <Modal visible={showClearModal} transparent animationType="fade" onRequestClose={() => { if (clearState === 'success') { navigation.goBack(); } setShowClearModal(false); }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {clearState === 'confirm' && (
                <>
                  <MaterialIcons name="delete-sweep" size={44} color="#E53935" style={{ marginBottom: 12 }} />
                  <Text style={styles.modalTitle}>清除所有本地数据</Text>
                  <Text style={styles.modalDesc}>这将清除所有凭据、缓存和设置，应用将回到初始状态。</Text>
                  <Text style={styles.modalDesc}>此操作不可撤销！</Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity onPress={() => setShowClearModal(false)} style={styles.modalCancelBtn}>
                      <Text style={styles.modalCancelText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearData} style={[styles.modalConfirmBtn, { backgroundColor: '#E53935' }]}>
                      <Text style={styles.modalConfirmText}>清除</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {clearState === 'clearing' && (
                <>
                  <ActivityIndicator size="large" color="#0055A8" style={{ marginBottom: 16 }} />
                  <Text style={styles.modalTitle}>正在清除...</Text>
                  <Text style={styles.modalDesc}>请稍候</Text>
                </>
              )}
              {clearState === 'success' && (
                <>
                  <MaterialIcons name="check-circle" size={52} color="#43A047" style={{ marginBottom: 12 }} />
                  <Text style={styles.modalTitle}>已清除</Text>
                  <Text style={styles.modalDesc}>所有本地数据已删除，请重启应用。</Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity onPress={() => { setShowClearModal(false); navigation.goBack(); }} style={styles.modalConfirmBtn}>
                      <Text style={styles.modalConfirmText}>好的</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {clearState === 'error' && (
                <>
                  <MaterialIcons name="error-outline" size={52} color="#E53935" style={{ marginBottom: 12 }} />
                  <Text style={styles.modalTitle}>清除失败</Text>
                  <Text style={styles.modalDesc}>{clearErrorMsg}</Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity onPress={() => setShowClearModal(false)} style={styles.modalCancelBtn}>
                      <Text style={styles.modalCancelText}>关闭</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* 邮件联想诊断弹窗 */}
        <Modal visible={showSuggestTest} transparent animationType="fade" onRequestClose={() => setShowSuggestTest(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 360, maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>邮件联想诊断</Text>

              <TouchableOpacity
                style={[styles.devBtn, suggestTestLoading && { opacity: 0.6 }]}
                onPress={async () => {
                  setSuggestTestLoading(true);
                  setSuggestTestStatus('正在认证邮箱…');
                  try {
                    const authed = await ensureMailAuth();
                    if (!authed) {
                      setSuggestTestStatus('❌ 邮箱认证失败，请先在邮件页面登录');
                      setSuggestTestLoading(false);
                      return;
                    }
                    setSuggestTestStatus('正在加载已发送联系人…');
                    const result = await fetchFolder('in:sent', 100, 0);
                    if (!result) {
                      setSuggestTestStatus('❌ fetchFolder 返回 null');
                      setSuggestTestLoading(false);
                      return;
                    }
                    if (!result.messages.length) {
                      setSuggestTestStatus('❌ 未获取到已发送邮件（返回 0 封）');
                      setSuggestTestLoading(false);
                      return;
                    }
                    // 调试：检查第一封邮件的结构
                    const first = result.messages[0];
                    const debugInfo = `首封: id=${first.id}, from="${first.from.address}", to=[${first.to.map(t=>t.address).join(', ')}]`;
                    console.log('[SuggestTest]', debugInfo);

                    const seen = new Set<string>();
                    const contacts: {name:string;address:string}[] = [];
                    for (const msg of result.messages) {
                      for (const t of msg.to) {
                        if (t.address && !seen.has(t.address)) {
                          seen.add(t.address);
                          contacts.push({ name: t.name || '', address: t.address });
                        }
                      }
                    }
                    setSuggestTestContacts(contacts);
                    setSuggestTestStatus(`✅ 加载完成：共 ${contacts.length} 个联系人（来自 ${result.messages.length} 封已发送邮件）\n${debugInfo}`);
                  } catch (e: any) {
                    setSuggestTestStatus(`❌ 加载失败：${e?.message || '未知错误'}`);
                  } finally {
                    setSuggestTestLoading(false);
                  }
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="cloud-download" size={18} color="#FFF" />
                <Text style={styles.devBtnText}>{suggestTestLoading ? '加载中…' : '加载已发送联系人'}</Text>
              </TouchableOpacity>

              {suggestTestStatus ? <Text style={styles.devStatusText}>{suggestTestStatus}</Text> : null}

              {suggestTestContacts.length > 0 && (
                <>
                  <TextInput
                    style={[styles.modalInput, { marginTop: 12 }]}
                    placeholder="输入关键词测试联想（>=2 字符）"
                    placeholderTextColor="#BBB"
                    value={suggestTestText}
                    onChangeText={(t) => {
                      setSuggestTestText(t);
                      if (t.length < 2) { setSuggestTestResult([]); return; }
                      const lower = t.toLowerCase();
                      const matched = suggestTestContacts.filter(
                        c => c.address.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)
                      );
                      setSuggestTestResult(matched);
                    }}
                    autoCapitalize="none"
                    autoFocus={false}
                  />

                  <ScrollView style={{ maxHeight: 180, width: '100%', marginTop: 8 }}>
                    {suggestTestResult.length > 0 ? (
                      <>
                        <Text style={styles.devMatchCount}>匹配 {suggestTestResult.length} 个联系人：</Text>
                        {suggestTestResult.map((c, i) => (
                          <View key={i} style={styles.devMatchRow}>
                            <MaterialIcons name="person-outline" size={16} color="#0055A8" />
                            <View style={{ flex: 1 }}>
                              {c.name ? <Text style={styles.devMatchName}>{c.name}</Text> : null}
                              <Text style={styles.devMatchAddr}>{c.address}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    ) : suggestTestText.length >= 2 ? (
                      <Text style={styles.devNoMatch}>无匹配结果</Text>
                    ) : null}
                  </ScrollView>
                </>
              )}

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { marginTop: 16 }]}
                onPress={() => setShowSuggestTest(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 教务通知诊断弹窗 */}
        <Modal visible={showNotifTest} transparent animationType="fade" onRequestClose={() => setShowNotifTest(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 360, maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>教务通知诊断</Text>

              <TouchableOpacity
                style={[styles.devBtn, notifTestLoading && { opacity: 0.6 }]}
                onPress={async () => {
                  setNotifTestLoading(true);
                  setNotifTestStatus('正在拉取 i.sjtu 通知…');
                  try {
                    const page1 = await fetchIsjtuNotices(1, 50);
                    const page2 = await fetchIsjtuNotices(2, 50);
                    const combined = [...page1, ...page2];
                    setNotifTestItems(combined);
                    const tiaoKeCount = combined.filter(n => n.isTiaoKe).length;
                    // 同时加载学期缓存用于诊断
                    let semInfo = '';
                    try {
                      const allKeys = await AsyncStorage.getAllKeys();
                      const schedKeys = allKeys.filter(k => k.startsWith('SCHEDULE_CACHE_'));
                      semInfo = `\n${schedKeys.length} 个学期缓存`;
                      for (const key of schedKeys.slice(0, 10)) {
                        const json = await AsyncStorage.getItem(key);
                        if (json) {
                          const d = JSON.parse(json);
                          if (d.semesterStartDate) {
                            const start = new Date(d.semesterStartDate);
                            semInfo += `\n  ${key.slice(-8)}: ${start.toLocaleDateString('zh-CN')} (${d.kbList?.length || 0} 条课表)`;
                          }
                        }
                      }
                    } catch {}
                    setNotifTestStatus(
                      `✅ 拉取完成：${combined.length} 条，其中 ${tiaoKeCount} 条调课提醒${semInfo}`
                    );
                  } catch (e: any) {
                    setNotifTestStatus(`❌ 拉取失败：${e?.message || '未知错误'}`);
                  } finally {
                    setNotifTestLoading(false);
                  }
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="cloud-download" size={18} color="#FFF" />
                <Text style={styles.devBtnText}>{notifTestLoading ? '加载中…' : '加载 i.sjtu 通知'}</Text>
              </TouchableOpacity>

              {notifTestStatus ? <Text style={styles.devStatusText}>{notifTestStatus}</Text> : null}

              {notifTestItems.length > 0 && (
                <ScrollView style={{ maxHeight: 300, width: '100%', marginTop: 8 }}>
                  {notifTestItems.map((n, i) => {
                    const tk = n.tiaoKeInfo;
                    return (
                      <View key={n.id || String(i)} style={[styles.devMatchRow, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                          <Text style={[styles.devMatchName, { flex: 1 }]} numberOfLines={1}>{n.title.substring(0, 40)}</Text>
                          {n.isTiaoKe && <View style={{ backgroundColor: '#FFF3E0', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 10, fontWeight: '700', color: '#E65100' }}>调课</Text></View>}
                        </View>
                        <Text style={[styles.devMatchAddr, { marginTop: 2 }]}>时间: {n.time?.substring(0, 16) || '无'} | 状态: {n.status}</Text>
                        {tk && (
                          <Text style={[styles.devMatchAddr, { marginTop: 1 }]}>
                            {tk.course}: {tk.original.week?.includes('周') ? '' : '第'}{tk.original.week}{tk.original.week?.includes('周') ? '' : '周'}{tk.original.day}→{tk.new.week?.includes('周') ? '' : '第'}{tk.new.week}{tk.new.week?.includes('周') ? '' : '周'}{tk.new.day}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { marginTop: 16 }]}
                onPress={() => setShowNotifTest(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 校历匹配诊断弹窗 */}
        <Modal visible={showSemesterDebug} transparent animationType="fade" onRequestClose={() => setShowSemesterDebug(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 360, maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>校历匹配诊断</Text>

              <TouchableOpacity
                style={[styles.devBtn, semDebugLoading && { opacity: 0.6 }]}
                onPress={async () => {
                  setSemDebugLoading(true);
                  setSemDebugInfo('正在扫描学期缓存…');
                  try {
                    const allKeys = await AsyncStorage.getAllKeys();
                    const schedKeys = allKeys.filter(k => k.startsWith('SCHEDULE_CACHE_'));
                    let info = `共 ${schedKeys.length} 个学期缓存\n`;
                    const semList: { key: string; start: Date; end: Date; kbCount: number }[] = [];
                    for (const key of schedKeys) {
                      const json = await AsyncStorage.getItem(key);
                      if (!json) continue;
                      const d = JSON.parse(json);
                      if (d.semesterStartDate) {
                        const start = new Date(d.semesterStartDate);
                        const parts2 = key.split('_');
                        const xqm = parts2[parts2.length - 1];
                        const maxWeeks = xqm === '16' ? 4 : 18;
                        const end = new Date(start);
                        end.setDate(end.getDate() + maxWeeks * 7);
                        semList.push({ key, start, end, kbCount: d.kbList?.length || 0 });
                      }
                    }
                    semList.sort((a, b) => a.start.getTime() - b.start.getTime());
                    for (const s of semList) {
                      const suffix = s.key.split('_').slice(-2).join('_');
                      info += `\n${suffix}: ${s.start.toLocaleDateString('zh-CN')} ~ ${s.end.toLocaleDateString('zh-CN')} (${s.kbCount}条)`;
                    }
                    // 用 刘满华 那条测试
                    const testDate = '2025-09-10';
                    const testTime = new Date(testDate).getTime();
                    info += `\n\n--- 测试: ${testDate} ---`;
                    let exact = semList.find(s => testTime >= s.start.getTime() && testTime <= s.end.getTime());
                    let future: typeof exact | undefined;
                    if (!exact) {
                      future = semList.find(s => s.start.getTime() > testTime);
                    }
                    const useSem = exact || future || null;
                    if (exact) {
                      info += `\n精确命中: ${exact.key.slice(-8)} (${exact.start.toLocaleDateString('zh-CN')})`;
                    } else if (future) {
                      info += `\n未精确命中，往后取: ${future.key.slice(-8)} (${future.start.toLocaleDateString('zh-CN')})`;
                    } else {
                      info += '\n无匹配学期';
                    }
                    if (useSem) {
                      const w = 2, dayNum = 5; // 星期四=5
                      const d = new Date(useSem.start);
                      d.setDate(d.getDate() + (w - 1) * 7 + (dayNum - 1));
                      info += `\n第2周周四 = ${d.getMonth() + 1}.${d.getDate()}`;
                      const w2 = 4, dayNum2 = 6; // 星期五=6
                      const d2 = new Date(useSem.start);
                      d2.setDate(d2.getDate() + (w2 - 1) * 7 + (dayNum2 - 1));
                      info += `\n第4周周五 = ${d2.getMonth() + 1}.${d2.getDate()}`;
                    }
                    setSemDebugInfo(info);
                  } catch (e: any) {
                    setSemDebugInfo(`❌ 错误: ${e?.message || '未知'}`);
                  } finally {
                    setSemDebugLoading(false);
                  }
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="search" size={18} color="#FFF" />
                <Text style={styles.devBtnText}>{semDebugLoading ? '扫描中…' : '扫描学期缓存并测试'}</Text>
              </TouchableOpacity>

              {semDebugInfo ? <Text style={[styles.devStatusText, { fontSize: 11, lineHeight: 16 }]}>{semDebugInfo}</Text> : null}

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { marginTop: 16 }]}
                onPress={() => setShowSemesterDebug(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 测试通知弹窗 */}
        <Modal visible={showTestNotifModal} transparent animationType="fade" onRequestClose={() => setShowTestNotifModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <MaterialIcons name="notifications-active" size={44} color="#E53935" style={{ marginBottom: 12 }} />
              <Text style={styles.modalTitle}>发送测试通知</Text>
              <Text style={styles.modalDesc}>选择要发送的本地通知类型</Text>

              {/* 前后台模式切换 */}
              <View style={[styles.intervalRow, { justifyContent: 'space-between', width: '100%' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name={testNotifBgMode ? 'airplanemode-active' : 'wifi'} size={18} color={testNotifBgMode ? '#7B1FA2' : '#4CAF50'} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{testNotifBgMode ? '后台测试 (10s后发送)' : '前台测试 (立即发送)'}</Text>
                </View>
                <Switch
                  value={testNotifBgMode}
                  onValueChange={setTestNotifBgMode}
                  trackColor={{ false: '#DDD', true: '#CE93D8' }}
                  thumbColor={testNotifBgMode ? '#7B1FA2' : '#FFF'}
                />
              </View>

              <View style={styles.intervalList}>
                {[
                  { key: 'assignment', icon: 'list-alt', label: '📝 作业提醒', color: '#0055A8', body: '【数据结构】第三次实验报告将在 24 小时后截止' },
                  { key: 'exam', icon: 'edit-note', label: '📚 考试提醒', color: '#E65100', body: '【高等数学】期末考试将于 12 小时后开始' },
                  { key: 'email', icon: 'email', label: '📧 新邮件', color: '#1A73E8', body: '教务处: 关于2025-2026学年第二学期选课的通知' },
                  { key: 'bgNewAssign', icon: 'sync', label: '🔔 后台-新作业', color: '#7B1FA2', body: '【后台检测到新作业】计算机网络: 第三次实验报告' },
                  { key: 'bgNewMail', icon: 'sync', label: '🔔 后台-新邮件', color: '#7B1FA2', body: '【后台检测到新邮件】导师: 关于论文修改意见' },
                ].map(item => (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.intervalRow}
                    onPress={async () => {
                      try {
                        // Android 8+ 需要先建 channel
                        try {
                          await Notifications.setNotificationChannelAsync('default', {
                            name: '交大通知',
                            importance: Notifications.AndroidImportance.MAX,
                            vibrationPattern: [0, 250, 250, 250],
                            lightColor: '#FF231F7C',
                          });
                        } catch {}
                        // 检查权限
                        const { status } = await Notifications.getPermissionsAsync();
                        if (status !== 'granted') {
                          const { status: newStatus } = await Notifications.requestPermissionsAsync();
                          if (newStatus !== 'granted') {
                            console.warn('Test notification: no permission');
                            setShowTestNotifModal(false);
                            return;
                          }
                        }
                        // 发送（前台即时 / 后台10s后）
                        if (testNotifBgMode) {
                          // 后台模式：10秒后发送，用户可以切到其他App看通知
                          await Notifications.scheduleNotificationAsync({
                            content: {
                              title: item.label,
                              body: item.body,
                              sound: true,
                            },
                            trigger: {
                              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                              seconds: 10,
                              channelId: 'default',
                            },
                          });
                          console.log('Test notification scheduled in 10s:', item.key);
                        } else {
                          // 前台模式：使用 channelId trigger 立即发送（trigger=null 不触发 handler）
                          await Notifications.scheduleNotificationAsync({
                            content: {
                              title: item.label,
                              body: item.body,
                              sound: true,
                            },
                            trigger: {
                              channelId: 'default',
                            },
                          });
                          console.log('Test notification sent:', item.key);
                        }
                      } catch (e) {
                        console.warn('Test notification failed:', e);
                      }
                      setShowTestNotifModal(false);
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.intervalText, { flex: 1 }]}>{item.label}</Text>
                    <Text style={{ fontSize: 12, color: '#999' }}>点击发送</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setShowTestNotifModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 电池优化引导弹窗 */}
        <Modal visible={showBatteryGuideModal} transparent animationType="fade" onRequestClose={() => setShowBatteryGuideModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 340, maxHeight: '80%' }]}>
              <MaterialIcons name="battery-saver" size={40} color="#FF6F00" style={{ marginBottom: 10 }} />
              <Text style={styles.modalTitle}>{batteryGuideData.title}</Text>
              <Text style={[styles.modalDesc, { fontSize: 12, color: '#888', marginBottom: 12 }]}>
                设备: {batteryGuideData.deviceInfo}
              </Text>
              <ScrollView style={{ width: '100%', maxHeight: 260 }} showsVerticalScrollIndicator>
                {batteryGuideData.steps.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 8, paddingHorizontal: 4 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#E65100' }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 19 }}>{s.replace(/\*\*/g, '')}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={[styles.modalButtons, { marginTop: 12 }]}>
                <TouchableOpacity onPress={() => setShowBatteryGuideModal(false)} style={styles.modalConfirmBtn}>
                  <Text style={styles.modalConfirmText}>知道了</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 关闭开发者模式确认弹窗 */}
        <Modal visible={showCloseDevModal} transparent animationType="fade" onRequestClose={() => setShowCloseDevModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 300 }]}>
              <MaterialIcons name="build" size={40} color="#8D6E63" style={{ marginBottom: 12 }} />
              <Text style={styles.modalTitle}>关闭开发者模式？</Text>
              <Text style={styles.modalDesc}>关闭后 jAccount 诊断等功能将隐藏。</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setShowCloseDevModal(false)} style={styles.modalCancelBtn} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setDevModeEnabled(false);
                  persistDevModeEnabled(false);
                  setShowCloseDevModal(false);
                }} style={[styles.modalConfirmBtn, { backgroundColor: '#E53935' }]} activeOpacity={0.7}>
                  <Text style={styles.modalConfirmText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 置顶缓存测试弹窗 */}
        <Modal visible={showPinnedCacheTest} transparent animationType="fade" onRequestClose={() => setShowPinnedCacheTest(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: 360, maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>📌 置顶缓存测试</Text>

              <TouchableOpacity
                style={styles.devBtn}
                onPress={async () => {
                  setPinnedCacheInfo('正在读取…');
                  setPinnedCacheItems([]);
                  try {
                    // 读取本地缓存
                    const cacheJson = await AsyncStorage.getItem('JWC_NOTICES_CACHE');
                    const pinJson = await AsyncStorage.getItem('XUANKE_PINNED');
                    if (!cacheJson) {
                      setPinnedCacheInfo('❌ 未找到 JWC_NOTICES_CACHE 缓存，请先进入教务通知页面加载一次');
                      return;
                    }
                    if (!pinJson) {
                      setPinnedCacheInfo('❌ 未找到 XUANKE_PINNED 置顶记录，请先在选课通知卡片上点击置顶');
                      return;
                    }
                    const all: any[] = JSON.parse(cacheJson);
                    const pinnedIds: string[] = JSON.parse(pinJson);
                    const pinnedSet = new Set(pinnedIds);
                    const pinnedItems = all.filter(n => n.isXuanKe && pinnedSet.has(n.id));
                    const unpinnedCount = all.length - pinnedItems.length;

                    let info = `缓存共 ${all.length} 条通知\n`;
                    info += `本地置顶 ${pinnedIds.length} 个 ID\n`;
                    info += `命中 ${pinnedItems.length} 条选课通知 ✅\n`;
                    info += `未置顶 ${unpinnedCount} 条\n\n`;
                    if (pinnedItems.length === 0) {
                      info += '⚠️ 缓存中没有匹配的置顶项。\n可能原因：\n';
                      info += '• 置顶的选课通知不在第一页\n';
                      info += '• 缓存过期，数据已更新\n';
                      info += '• 置顶 ID 对应的通知已被移除';
                    } else {
                      info += `--- 置顶项（${pinnedItems.length} 条）---\n`;
                      for (const item of pinnedItems) {
                        const rounds = item.xuankeInfo?.rounds;
                        const lastEnd = rounds?.length
                          ? new Date(rounds[rounds.length - 1].end).getTime()
                          : 0;
                        const expired = lastEnd < Date.now();
                        info += `\n📌 ${item.title.substring(0, 50)}`;
                        info += `\n   日期: ${item.date}${expired ? ' ⏰ 已过期' : ' 🟢 进行中'}`;
                        if (rounds?.length) {
                          info += `\n   轮次: ${rounds.map((r: any) => r.round).join('、')}`;
                        }
                      }
                    }
                    setPinnedCacheInfo(info);
                    setPinnedCacheItems(pinnedItems);
                  } catch (e: any) {
                    setPinnedCacheInfo(`❌ 读取失败: ${e?.message || '未知错误'}`);
                  }
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons name="refresh" size={18} color="#FFF" />
                <Text style={styles.devBtnText}>读取本地缓存</Text>
              </TouchableOpacity>

              {pinnedCacheInfo ? (
                <ScrollView style={{ maxHeight: 300, width: '100%', marginTop: 8 }}>
                  <Text style={[styles.devStatusText, { fontSize: 11, lineHeight: 16, textAlign: 'left' }]}>{pinnedCacheInfo}</Text>
                  {pinnedCacheItems.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <TouchableOpacity
                        style={[styles.devBtn, { backgroundColor: '#2E7D32' }]}
                        onPress={() => {
                          // 模拟仅从本地渲染：直接展示缓存的置顶项
                          const list = pinnedCacheItems.slice().sort((a: any, b: any) => {
                            const pa = a.isXuanKe ? 0 : 1;
                            const pb = b.isXuanKe ? 0 : 1;
                            return pa - pb;
                          });
                          const content = list.map((item: any, i: number) => {
                            const rounds = item.xuankeInfo?.rounds;
                            return `[${i + 1}] ${item.title.substring(0, 40)}\n    ${item.date} | ${rounds?.length || 0} 轮次`;
                          }).join('\n\n');
                          Alert.alert(
                            '仅本地渲染预览',
                            `共 ${list.length} 条置顶项（仅从缓存读取，无网络请求）：\n\n${content}`
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="visibility" size={18} color="#FFF" />
                        <Text style={styles.devBtnText}>模拟仅本地渲染</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              ) : null}

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { marginTop: 16 }]}
                onPress={() => setShowPinnedCacheTest(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>关闭</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, marginTop: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerSpacer: { width: 30 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  settingRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  settingIcon: { marginRight: 14 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#333' },
  settingDesc: { fontSize: 13, color: '#999', marginTop: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 24, width: '80%', maxWidth: 300,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#666', marginBottom: 16 },
  modalInput: {
    width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#333',
    textAlign: 'center',
  },
  modalButtons: { flexDirection: 'row', marginTop: 20, gap: 12 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: '#DDD' },
  modalCancelText: { fontSize: 15, color: '#999', fontWeight: '600' },
  modalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#0055A8' },
  modalConfirmText: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  intervalList: { width: '100%', marginBottom: 8 },
  intervalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  intervalText: { fontSize: 16, color: '#333', marginLeft: 10 },
  intervalTextActive: { color: '#0055A8', fontWeight: '600' },

  devBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#7B1FA2',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, gap: 6, marginBottom: 8,
  },
  devBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  devStatusText: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 8, lineHeight: 18 },
  devMatchCount: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  devMatchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4, gap: 8 },
  devMatchName: { fontSize: 14, color: '#333', fontWeight: '500' },
  devMatchAddr: { fontSize: 12, color: '#888' },
  devNoMatch: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 12 },
});
