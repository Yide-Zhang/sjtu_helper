import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { sendMessage, saveDraft, fetchFolder, ensureMailAuth } from '../api/mail';
import * as DocumentPicker from 'expo-document-picker';

interface SelectedFile {
  name: string;
  uri: string;
  mimeType: string;
  size: number;
}

interface Contact {
  name: string;
  address: string;
}

const SEP = /[,;，；]\s*$/;

export const ComposeMailScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [toText, setToText] = useState('');
  const [toChips, setToChips] = useState<string[]>(() => {
    const init = route.params?.to || '';
    return init.trim() ? [init.trim()] : [];
  });
  const [showCc, setShowCc] = useState(false);
  const [ccText, setCcText] = useState('');
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [subject, setSubject] = useState(route.params?.subject || '');
  const [body, setBody] = useState(route.params?.body || '');
  const [attachments, setAttachments] = useState<SelectedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendResult, setSendResult] = useState<'success' | 'fail' | null>(null);
  const [draftResult, setDraftResult] = useState<'success' | 'fail' | null>(null);
  const [draftMsg, setDraftMsg] = useState('');
  const [sendMessageText, setSendMessageText] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [sentContacts, setSentContacts] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const toTextRef = useRef(toText);
  toTextRef.current = toText;

  // 加载已发送邮件的收件人（联想数据源）
  const ensureSentContacts = async () => {
    if (sentContacts.length > 0) return;
    try {
      const authed = await ensureMailAuth();
      if (!authed) { console.warn('[Compose] 邮箱未认证'); return; }
      const result = await fetchFolder('in:sent', 100, 0);
      if (!result) return;
      const seen = new Set<string>();
      const contacts: Contact[] = [];
      for (const msg of result.messages) {
        for (const t of msg.to) {
          if (t.address && !seen.has(t.address)) {
            seen.add(t.address);
            contacts.push({ name: t.name || '', address: t.address });
          }
        }
      }
      setSentContacts(contacts);
      // 联系人加载完成后，若用户已输入 >=5 字符则立即触发联想
      const curText = toTextRef.current;
      if (curText.length >= 5) {
        const lower = curText.toLowerCase();
        const matched = contacts.filter(
          c => c.address.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)
        );
        setSuggestions(matched.slice(0, 8));
        setShowSuggestions(matched.length > 0);
      }
    } catch (e) {
      console.warn('[Compose] 加载已发送联系人失败', e);
    }
  };

  // 输入联想
  const updateSuggestions = (text: string) => {
    if (text.length < 5 || sentContacts.length === 0) { setShowSuggestions(false); return; }
    const lower = text.toLowerCase();
    const matched = sentContacts.filter(
      c => c.address.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower)
    );
    setSuggestions(matched.slice(0, 8));
    setShowSuggestions(matched.length > 0);
  };

  const pickSuggestion = (c: Contact) => {
    setToChips(prev => prev.includes(c.address) ? prev : [...prev, c.address]);
    setToText('');
    setShowSuggestions(false);
  };

  // 处理收件人输入变化
  const handleToChange = (text: string) => {
    if (SEP.test(text)) {
      const addr = text.replace(/[,;，；]\s*$/, '').trim();
      if (addr && !toChips.includes(addr)) {
        setToChips(prev => [...prev, addr]);
        setToText('');
        setShowSuggestions(false);
        return;
      }
    }
    setToText(text);
    if (text.length >= 5) updateSuggestions(text);
    else setShowSuggestions(false);
  };

  // 退格键：光标在最前时把最后一个 chip 退回文字状态
  const handleToKeyPress = ({ nativeEvent }: any) => {
    if (nativeEvent.key === 'Backspace' && toText === '' && toChips.length > 0) {
      const last = toChips[toChips.length - 1];
      setToChips(prev => prev.slice(0, -1));
      setToText(last);
      setShowSuggestions(false);
    }
  };

  // 处理抄送输入变化
  const handleCcChange = (text: string) => {
    if (SEP.test(text)) {
      const addr = text.replace(/[,;，；]\s*$/, '').trim();
      if (addr && !ccChips.includes(addr)) {
        setCcChips(prev => [...prev, addr]);
        setCcText('');
        return;
      }
    }
    setCcText(text);
  };

  // 退格键：抄送 chip 退回文字
  const handleCcKeyPress = ({ nativeEvent }: any) => {
    if (nativeEvent.key === 'Backspace' && ccText === '' && ccChips.length > 0) {
      const last = ccChips[ccChips.length - 1];
      setCcChips(prev => prev.slice(0, -1));
      setCcText(last);
    }
  };

  const getAllTo = () => {
    const arr = [...toChips];
    const cur = toText.trim();
    if (cur && !arr.includes(cur)) arr.push(cur);
    return arr;
  };
  const getAllCc = () => {
    const arr = [...ccChips];
    const cur = ccText.trim();
    if (cur && !arr.includes(cur)) arr.push(cur);
    return arr;
  };

  const handleSend = async () => {
    const toList = getAllTo();
    if (toList.length === 0) { Alert.alert('提示', '请填写收件人'); return; }
    setSending(true);
    try {
      const ccList = getAllCc();
      const ok = await sendMessage(toList, subject, body, ccList.length > 0 ? ccList : undefined, undefined,
        attachments.length > 0 ? attachments.map(a => ({ name: a.name, uri: a.uri, mimeType: a.mimeType })) : undefined);
      if (ok) {
        setSendResult('success');
        setSendMessageText('');
      } else {
        setSendResult('fail');
        setSendMessageText('请检查邮箱认证状态后重试');
      }
    } catch (e: any) {
      setSendResult('fail');
      setSendMessageText(e?.message || '未知错误');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const toList = getAllTo();
      const ccList = getAllCc();
      const draftId = await saveDraft(toList, subject, body, ccList.length > 0 ? ccList : undefined);
      if (draftId) {
        setDraftResult('success');
        setDraftMsg('');
      } else {
        setDraftResult('fail');
        setDraftMsg('请检查邮箱认证状态后重试');
      }
    } catch (e: any) {
      setDraftResult('fail');
      setDraftMsg(e?.message || '未知错误');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const file = result.assets[0];
      setAttachments(prev => [...prev, {
        name: file.name || '未知文件',
        uri: file.uri,
        mimeType: file.mimeType || 'application/octet-stream',
        size: file.size || 0,
      }]);
    } catch (e: any) {
      Alert.alert('选择文件失败', e?.message || '未知错误');
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.safeArea, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} activeOpacity={0.7}>
          <MaterialIcons name="close" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>新邮件</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleSaveDraft} disabled={savingDraft} style={styles.draftBtn} activeOpacity={0.7}>
            {savingDraft ? <ActivityIndicator size="small" color="#0055A8" /> : <Text style={styles.draftBtnText}>存草稿</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSend} disabled={sending} style={[styles.sendBtn, sending && styles.sendBtnDisabled]} activeOpacity={0.7}>
            {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.sendBtnText}>发送</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }} keyboardShouldPersistTaps="handled">
        {/* 收件人 */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>收件人</Text>
          <View style={styles.fieldInputWrap}>
            {toChips.map((addr, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>{addr}</Text>
                <TouchableOpacity onPress={() => setToChips(prev => prev.filter((_, j) => j !== i))} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            <TextInput
              style={styles.chipInput}
              placeholder={toChips.length === 0 ? '输入邮箱地址，逗号/分号分隔' : ''}
              value={toText} onChangeText={handleToChange}
              onKeyPress={handleToKeyPress}
              onFocus={ensureSentContacts}
              autoCapitalize="none" keyboardType="email-address"
            />
          </View>
        </View>
        {showSuggestions && (
          <View style={styles.suggestBox}>
            <Text style={styles.suggestHeader}>您是否是想写给……</Text>
            {suggestions.map((c, i) => (
              <TouchableOpacity key={i} style={styles.suggestRow} onPress={() => pickSuggestion(c)} activeOpacity={0.7}>
                <MaterialIcons name="person-outline" size={16} color="#0055A8" />
                <View style={{ flex: 1 }}>
                  {c.name ? <Text style={styles.suggestName}>{c.name}</Text> : null}
                  <Text style={styles.suggestAddr}>{c.address}</Text>
                </View>
                <MaterialIcons name="add-circle-outline" size={18} color="#0055A8" />
              </TouchableOpacity>
            ))}
            <Text style={styles.suggestDebug}>
              匹配 {suggestions.length}/{sentContacts.length} 个联系人
            </Text>
          </View>
        )}

        {/* 抄送（折叠） */}
        <TouchableOpacity style={styles.ccToggle} onPress={() => setShowCc(!showCc)} activeOpacity={0.7}>
          <Text style={styles.fieldLabel}>抄送</Text>
          <MaterialIcons name={showCc ? 'expand-less' : 'expand-more'} size={18} color="#999" />
        </TouchableOpacity>
        {showCc && (
          <View style={styles.fieldRow}>
            <View style={styles.fieldInputWrap}>
              {ccChips.map((addr, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>{addr}</Text>
                  <TouchableOpacity onPress={() => setCcChips(prev => prev.filter((_, j) => j !== i))} activeOpacity={0.7}>
                    <MaterialIcons name="close" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              <TextInput
                style={styles.chipInput}
                placeholder={ccChips.length === 0 ? '抄送地址，逗号/分号分隔' : ''}
                value={ccText} onChangeText={handleCcChange}
                onKeyPress={handleCcKeyPress}
                autoCapitalize="none" keyboardType="email-address"
              />
            </View>
          </View>
        )}

        {/* 主题 */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>主题</Text>
          <TextInput style={styles.fieldInput} placeholder="请输入主题" value={subject} onChangeText={setSubject} />
        </View>

        {/* 分隔线 */}
        <View style={styles.divider} />

        {/* 正文 */}
        <TextInput style={styles.bodyInput} placeholder="请输入邮件正文..." value={body} onChangeText={setBody} multiline textAlignVertical="top" />

        {/* 附件列表 */}
        {attachments.length > 0 && (
          <View style={styles.attachSection}>
            <Text style={styles.attachTitle}>附件 ({attachments.length})</Text>
            {attachments.map((f, i) => (
              <View key={i} style={styles.attachRow}>
                <MaterialIcons name="attach-file" size={16} color="#666" />
                <Text style={styles.attachName} numberOfLines={1}>{f.name}</Text>
                <TouchableOpacity onPress={() => setAttachments(prev => prev.filter((_, j) => j !== i))} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={16} color="#E53935" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 发送结果弹窗 */}
      <Modal visible={sendResult !== null} transparent animationType="fade" onRequestClose={() => setSendResult(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.resultModal}>
            {sendResult === 'success' ? (
              <MaterialIcons name="check-circle" size={48} color="#43A047" style={{ marginBottom: 12 }} />
            ) : (
              <MaterialIcons name="error" size={48} color="#E53935" style={{ marginBottom: 12 }} />
            )}
            <Text style={styles.resultTitle}>{sendResult === 'success' ? '发送成功' : '发送失败'}</Text>
            {sendMessageText ? <Text style={styles.resultBody}>{sendMessageText}</Text> : null}
            <TouchableOpacity
              style={[styles.resultBtn, sendResult === 'success' ? styles.resultBtnSuccess : styles.resultBtnFail]}
              onPress={() => { setSendResult(null); if (sendResult === 'success') navigation.goBack(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.resultBtnText}>好</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 存草稿结果弹窗 */}
      <Modal visible={draftResult !== null} transparent animationType="fade" onRequestClose={() => setDraftResult(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.resultModal}>
            {draftResult === 'success' ? (
              <>
                <MaterialIcons name="drafts" size={48} color="#FF9800" style={{ marginBottom: 12 }} />
                <Text style={styles.resultTitle}>已存草稿</Text>
                <Text style={styles.resultBody}>邮件已保存到草稿箱</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="error-outline" size={48} color="#E53935" style={{ marginBottom: 12 }} />
                <Text style={styles.resultTitle}>保存失败</Text>
                {draftMsg ? <Text style={styles.resultBody}>{draftMsg}</Text> : null}
              </>
            )}
            <TouchableOpacity
              style={[styles.resultBtn, draftResult === 'success' ? styles.resultBtnWarn : styles.resultBtnFail]}
              onPress={() => { setDraftResult(null); if (draftResult === 'success') navigation.goBack(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.resultBtnText}>好</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 底部工具栏 */}
      <View style={[styles.toolbar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={handlePickFile} activeOpacity={0.7}>
          <MaterialIcons name="attach-file" size={20} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowCc(!showCc)} activeOpacity={0.7}>
          <MaterialIcons name="cc" size={20} color="#555" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Text style={styles.toolbarHint}>
          {toChips.length > 0 ? `发送至 ${toChips[0]}${toChips.length > 1 ? ` 等${toChips.length}人` : ''}` : ''}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  headerBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtn: { backgroundColor: '#0055A8', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  draftBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#0055A8' },
  draftBtnText: { color: '#0055A8', fontSize: 14, fontWeight: '600' },

  form: { flex: 1, paddingHorizontal: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  fieldLabel: { width: 50, fontSize: 14, color: '#888', fontWeight: '500', paddingTop: 6 },
  fieldInputWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0055A8', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3, gap: 4, maxWidth: '80%',
  },
  chipText: { color: '#FFF', fontSize: 12, fontWeight: '500', maxWidth: 180 },
  chipInput: { flex: 1, minWidth: 100, fontSize: 15, color: '#333', paddingVertical: 4, paddingHorizontal: 2 },
  ccToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  fieldInput: { flex: 1, fontSize: 15, color: '#333', paddingVertical: 4 },

  // 联想建议框
  suggestBox: {
    marginHorizontal: 50, marginTop: -1, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8,
    elevation: 4, paddingVertical: 6, marginBottom: 4,
  },
  suggestHeader: { fontSize: 12, color: '#999', paddingHorizontal: 12, paddingBottom: 4 },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, gap: 8,
  },
  suggestName: { fontSize: 14, color: '#333', fontWeight: '500' },
  suggestAddr: { fontSize: 12, color: '#888' },
  suggestDebug: { fontSize: 10, color: '#BBB', textAlign: 'right', paddingHorizontal: 12, paddingTop: 2 },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 4 },
  bodyInput: { flex: 1, fontSize: 15, color: '#333', minHeight: 200, paddingTop: 10, lineHeight: 22 },

  attachSection: { marginTop: 12, padding: 10, backgroundColor: '#F9F9F9', borderRadius: 8 },
  attachTitle: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 6 },
  attachRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  attachName: { flex: 1, fontSize: 13, color: '#555', marginLeft: 6 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#EEE',
  },
  toolbarBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  toolbarHint: { fontSize: 12, color: '#AAA' },

  // 发送结果弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  resultModal: {
    width: '78%', backgroundColor: '#FFF', borderRadius: 16, padding: 28,
    alignItems: 'center', elevation: 8,
  },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 6 },
  resultBody: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18, marginBottom: 4 },
  resultBtn: { paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10, marginTop: 14, minWidth: 80, alignItems: 'center' },
  resultBtnSuccess: { backgroundColor: '#43A047' },
  resultBtnWarn: { backgroundColor: '#FF9800' },
  resultBtnFail: { backgroundColor: '#E53935' },
  resultBtnText: { fontSize: 15, color: '#FFF', fontWeight: '600' },
});
