import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Platform, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import { useFonts } from 'expo-font';
import piexifjs from 'piexifjs';
import { SvgXml } from 'react-native-svg';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import { SHUIYUAN_LOGO_SVG } from '../utils/shuiyuanLogo';
import { getShuiyuanTopic, ShuiyuanTopic, buildAvatarUrl } from '../api/shuiyuan';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  bg: '#F5F5F5', card: '#FFF', text: '#333', textSec: '#888',
  primary: '#0055A8', border: '#EEE', link: '#1565C0',
};

/** 简单剥离 HTML 标签，保留换行 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 从 URL 中提取 topic ID 和可选的帖子编号 */
function parseShuiyuanUrl(url: string): { topicId: number | null; postNumber?: number } {
  const m = url.match(/shuiyuan\.sjtu\.edu\.cn\/t\/topic\/(\d+)(?:\/(\d+))?/);
  if (!m) return { topicId: null };
  return {
    topicId: parseInt(m[1], 10),
    postNumber: m[2] ? parseInt(m[2], 10) : undefined,
  };
}

/** 经纬度转 EXIF GPS DMS 格式（度/分/秒 有理数对数组） */
function dms(dec: number): [number, number][] {
  const d = Math.floor(dec);
  const m = Math.floor((dec - d) * 60);
  const s = Math.round(((dec - d) * 60 - m) * 100);
  return [[d, 1], [m, 1], [s, 100]];
}

export const ShuiyuanSummaryScreen = ({ navigation }: any) => {
  const { showAlert, alertProps } = useAlertModal();
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState<ShuiyuanTopic | null>(null);
  const [postNumber, setPostNumber] = useState<number | undefined>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fontsLoaded] = useFonts({
    'SourceHanSans': require('../../assets/fonts/SourceHanSansSC-Regular.otf'),
    'SourceHanSans-Bold': require('../../assets/fonts/SourceHanSansSC-Bold.otf'),
    'SourceHanSans-Medium': require('../../assets/fonts/SourceHanSansSC-Medium.otf'),
  });
  const viewShotRef = useRef<ViewShot>(null);

  const fontFamily = fontsLoaded ? 'SourceHanSans' : undefined;
  const fontFamilyBold = fontsLoaded ? 'SourceHanSans-Bold' : undefined;

  const handleFetch = async () => {
    const parsed = parseShuiyuanUrl(url.trim());
    if (!parsed.topicId) {
      setError('请输入有效的水源帖子链接');
      return;
    }
    setError('');
    setTopic(null);
    setPostNumber(parsed.postNumber);
    setLoading(true);
    const result = await getShuiyuanTopic(parsed.topicId);
    setLoading(false);
    if (result) {
      // 根据 URL 中的帖子编号过滤
      if (parsed.postNumber) {
        // /t/topic/xxx/n → 只显示指定帖
        result.posts = result.posts.filter(p => p.postNumber === parsed.postNumber);
      } else {
        // /t/topic/xxx → 只显示楼主
        result.posts = result.posts.filter(p => p.postNumber === 1);
      }
      setTopic(result);
    } else {
      setError('获取失败，请检查链接或网络连接');
    }
  };

  const handleSave = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      showAlert({ title: '权限不足', message: '请在系统设置中允许访问相册', icon: 'lock', iconColor: '#E53935', simple: true });
      return;
    }
    setSaving(true);
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('截图失败');

      // === 注入虚假 EXIF（拍摄地点、设备、时间） ===
      const srcFile = new File(uri);
      const jpegB64 = await srcFile.base64();

      // 生成随机 GPS 坐标（上海市内）
      const lat = 31.2 + Math.random() * 0.3;
      const lng = 121.4 + Math.random() * 0.2;
      const fakeModels = ['iPhone 14 Pro', 'iPhone 15 Pro Max', 'SM-S918B', 'Pixel 8 Pro', 'Xiaomi 14 Ultra', 'OPPO Find X7'];
      const model = fakeModels[Math.floor(Math.random() * fakeModels.length)];
      const fakeTime = new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000);
      const timeStr = fakeTime.toISOString().replace(/[TZ]/g, ' ').substring(0, 19);

      const exifObj: any = {
        '0th': {
          [piexifjs.ImageIFD.Make]: 'Apple Inc.',
          [piexifjs.ImageIFD.Model]: model,
          [piexifjs.ImageIFD.Software]: 'Adobe Lightroom 7.5',
        },
        Exif: {
          [piexifjs.ExifIFD.DateTimeOriginal]: timeStr,
          [piexifjs.ExifIFD.LensModel]: 'iPhone camera 6.86mm f/1.78',
          [piexifjs.ExifIFD.FNumber]: [14, 10],
          [piexifjs.ExifIFD.ExposureTime]: [1, Math.floor(Math.random() * 500 + 50)],
          [piexifjs.ExifIFD.ISOSpeedRatings]: Math.floor(Math.random() * 400 + 50),
        },
        GPS: {
          [piexifjs.GPSIFD.GPSLatitudeRef]: 'N',
          [piexifjs.GPSIFD.GPSLatitude]: dms(lat),
          [piexifjs.GPSIFD.GPSLongitudeRef]: 'E',
          [piexifjs.GPSIFD.GPSLongitude]: dms(lng),
        },
      };

      // base64 → binary string → insert EXIF → write as base64
      const binStr = atob(jpegB64);
      const withExifBin = piexifjs.insert(piexifjs.dump(exifObj), binStr);
      const withExifB64 = btoa(withExifBin);

      // 写入临时文件并保存到相册
      const randName = `IMG_${Date.now()}.jpg`;
      const tmp = new File(Paths.cache, randName);
      tmp.write(withExifB64, { encoding: 'base64' });
      await MediaLibrary.createAssetAsync(tmp.uri);
      showAlert({ title: '保存成功', message: '图片已保存到系统相册', icon: 'check-circle', iconColor: '#43A047', simple: true });
    } catch (e: any) {
      showAlert({ title: '保存失败', message: e?.message || '请检查相册权限设置', icon: 'error-outline', iconColor: '#E53935', simple: true });
    } finally {
      setSaving(false);
    }
  };

  const renderPost = (post: any, index: number) => {
    const avatarUrl = post.avatarTemplate ? buildAvatarUrl(post.avatarTemplate, 80) : '';
    const time = post.createdAt
      ? new Date(post.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      : '';
    const floor = post.postNumber === 1 ? '楼主' : `#${post.postNumber}`;

    return (
      <View key={post.id} style={[styles.postCard, index > 0 && { marginTop: 4 }]}>
        {/* 用户信息行 */}
        <View style={styles.userRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <MaterialIcons name="person" size={24} color="#FFF" />
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.username, { fontFamily: fontFamilyBold }]}>{post.name || post.username}</Text>
            <Text style={[styles.meta, { fontFamily }]}>
              {floor} · {time}
            </Text>
          </View>
        </View>

        {/* 帖子内容 */}
        <View style={styles.contentWrap}>
          <Text style={[styles.postContent, { fontFamily }]}>{htmlToText(post.cooked)}</Text>
        </View>

        {/* 互动信息 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <MaterialIcons name="visibility" size={14} color={C.textSec} />
            <Text style={[styles.statText, { fontFamily }]}>{post.reads}</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialIcons name="chat-bubble-outline" size={14} color={C.textSec} />
            <Text style={[styles.statText, { fontFamily }]}>{post.replyCount}</Text>
          </View>
          {post.retorts?.length > 0 && (
            <View style={styles.statItem}>
              <MaterialIcons name="emoji-emotions" size={14} color={C.textSec} />
              <Text style={[styles.statText, { fontFamily }]}>{post.retorts.length}</Text>
            </View>
          )}
        </View>

        {index < (topic?.posts.length ?? 0) - 1 && <View style={styles.postDivider} />}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>水源帖子摘要</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 输入区 */}
      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <MaterialIcons name="link" size={18} color={C.textSec} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            placeholder="粘贴水源帖子链接"
            placeholderTextColor={C.textSec}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleFetch}
          />
          {url.length > 0 && (
            <TouchableOpacity onPress={() => setUrl('')} activeOpacity={0.7}>
              <MaterialIcons name="close" size={18} color={C.textSec} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.fetchBtn} onPress={handleFetch} disabled={loading} activeOpacity={0.7}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.fetchBtnText}>生成摘要</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 错误提示 */}
      {error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={18} color="#E53935" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* 内容区 */}
      {topic ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          {/* 可截图区域 */}
          <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.95 }} style={styles.shotContainer}>
            {/* 品牌标头 */}
            <View style={styles.brandHeader}>
              <View style={styles.brandRow}>
                <SvgXml xml={SHUIYUAN_LOGO_SVG} width={160} height={38} />
              </View>
            </View>

            {/* 话题标题 */}
            <Text style={{ fontSize: 18, color: C.text, marginBottom: -18, fontFamily: 'SourceHanSans-Bold' }}>{topic.title}</Text>

            {/* 话题元信息 */}
            <View style={styles.topicMeta}>
              <View style={styles.metaItem}>
                <MaterialIcons name="article" size={14} color={C.textSec} />
                <Text style={[styles.metaText, { fontFamily }]}>{topic.postsCount} 条回复</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="visibility" size={14} color={C.textSec} />
                <Text style={[styles.metaText, { fontFamily }]}>{topic.views} 次查看</Text>
              </View>
            </View>

            {/* 帖子列表 */}
            <View style={styles.postsList}>
              {topic.posts.map((post, i) => renderPost(post, i))}
            </View>
          </ViewShot>

          {/* 保存按钮 */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="save-alt" size={20} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>导出图片到相册</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : !loading && !error ? (
        <View style={styles.placeholder}>
          <MaterialIcons name="forum" size={48} color="#DDD" />
          <Text style={styles.placeholderText}>粘贴水源帖子链接</Text>
          <Text style={styles.placeholderHint}>支持 shuiyuan.sjtu.edu.cn/t/topic/xxxxx 和 /t/topic/xxxxx/n 格式</Text>
        </View>
      ) : null}
      <AlertModal {...alertProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.text },

  inputArea: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, height: 40 },
  input: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 0 },
  fetchBtn: { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  fetchBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  errorBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  errorText: { fontSize: 13, color: '#E53935', flex: 1 },

  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  placeholderText: { fontSize: 15, color: C.textSec, marginTop: 12 },
  placeholderHint: { fontSize: 13, color: '#BBB', marginTop: 6 },

  shotContainer: { backgroundColor: C.card, marginHorizontal: 16, marginTop: 12, borderRadius: 12, overflow: 'hidden', padding: 16 },
  brandHeader: { marginBottom: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  topicTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: -18 },
  topicMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: C.textSec },

  postsList: {},
  postCard: { paddingVertical: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  username: { fontSize: 14, fontWeight: '600', color: C.text },
  meta: { fontSize: 11, color: C.textSec, marginTop: -18 },

  contentWrap: { marginBottom: 8 },
  postContent: { fontSize: 14, color: C.text, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 11, color: C.textSec },

  footer: { marginTop: 12 },

  saveBtn: {
    flexDirection: 'row', backgroundColor: '#43A047', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
