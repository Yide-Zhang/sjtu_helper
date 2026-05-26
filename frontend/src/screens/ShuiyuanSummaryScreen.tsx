import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import { useFonts } from 'expo-font';
import { SvgXml } from 'react-native-svg';
import UPNG from 'upng-js';
import {
  generateWatermarkLetters,
  generateWatermarkMask,
  embedLSB,
  perturbPngMetadata,
} from '../utils/watermark';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import { SHUIYUAN_LOGO_SVG } from '../utils/shuiyuanLogo';
import { getShuiyuanTopic, ShuiyuanTopic, buildAvatarUrl } from '../api/shuiyuan';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  bg: '#F5F5F5', card: '#FFF', text: '#333', textSec: '#888',
  primary: '#0055A8', border: '#EEE', link: '#1565C0',
};

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

function parseShuiyuanUrl(url: string): { topicId: number | null; postNumber?: number } {
  const m = url.match(/shuiyuan\.sjtu\.edu\.cn\/t\/topic\/(\d+)(?:\/(\d+))?/);
  if (!m) return { topicId: null };
  return {
    topicId: parseInt(m[1], 10),
    postNumber: m[2] ? parseInt(m[2], 10) : undefined,
  };
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
      if (parsed.postNumber) {
        result.posts = result.posts.filter(p => p.postNumber === parsed.postNumber);
      } else {
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
      // 1. 拦截主内容视图长图
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('截图失败');

      // 2. 将长图转为二进制 RGBA 数据
      const pngFile = new File(uri);
      const pngB64 = await pngFile.base64();

      const pngBinaryStr = atob(pngB64);
      const pngLen = pngBinaryStr.length;
      const pngBuf = new Uint8Array(pngLen);
      for (let i = 0; i < pngLen; i++) pngBuf[i] = pngBinaryStr.charCodeAt(i);

      const decoded = UPNG.decode(pngBuf.buffer);
      const w = decoded.width;
      const h = decoded.height;
      const rgbaBufs = UPNG.toRGBA8(decoded);
      const rgba = new Uint8Array(rgbaBufs[0]);

      // 3. 内存级直接计算出水印掩码 (100% 稳定，不再有 UI 渲染时差)
      const letters = generateWatermarkLetters();
      const mask = generateWatermarkMask(w, h, letters);
      
      // 4. 高速嵌入 LSB
      embedLSB(rgba, mask);

      // 5. 重新拼装 PNG，注入伪造 EXIF 拍摄元数据
      const outBuf = UPNG.encode([rgba.buffer], w, h);
      let outBytes: Uint8Array = new Uint8Array(outBuf);
      outBytes = perturbPngMetadata(outBytes as Uint8Array);

      // 6. 还原为 base64
      let outB64 = '';
      const CHUNK = 8192;
      for (let i = 0; i < outBytes.length; i += CHUNK) {
        const end = Math.min(i + CHUNK, outBytes.length);
        const slice = outBytes.subarray(i, end);
        let chunkStr = '';
        for (let j = 0; j < slice.length; j++) {
          chunkStr += String.fromCharCode(slice[j]);
        }
        outB64 += chunkStr;
      }
      outB64 = btoa(outB64);

      // 7. 保存落盘并写入相册
      const randName = `Shuiyuan_${Date.now()}.png`;
      const tmp = new File(Paths.cache, randName);
      tmp.write(outB64, { encoding: 'base64' });
      await MediaLibrary.createAssetAsync(tmp.uri);

      showAlert({ title: '保存成功', message: `图片已保存（隐写暗号: ${letters}）`, icon: 'check-circle', iconColor: '#43A047', simple: true });
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

        <View style={styles.contentWrap}>
          <Text style={[styles.postContent, { fontFamily }]}>{htmlToText(post.cooked)}</Text>
        </View>

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>水源帖子摘要</Text>
        <View style={{ width: 40 }} />
      </View>

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

      {error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={18} color="#E53935" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {topic ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
          <ViewShot ref={viewShotRef} options={{ format: 'png' }} style={styles.shotContainer}>
            <View style={styles.brandHeader}>
              <View style={styles.brandRow}>
                <SvgXml xml={SHUIYUAN_LOGO_SVG} width={160} height={38} />
              </View>
            </View>

            <Text style={{ fontSize: 18, color: C.text, marginBottom: -18, fontFamily: 'SourceHanSans-Bold' }}>{topic.title}</Text>

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

            <View style={styles.postsList}>
              {topic.posts.map((post, i) => renderPost(post, i))}
            </View>
          </ViewShot>

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
  postDivider: { height: 1, backgroundColor: '#EEE', marginTop: 8 },
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

  saveBtn: {
    flexDirection: 'row', backgroundColor: '#43A047', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});