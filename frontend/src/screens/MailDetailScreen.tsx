import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { AlertModal, useAlertModal } from '../components/AlertModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchMessageDetail, markAsRead, deleteMessage, ZimbraMessage } from '../api/mail';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';

const formatFullDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const MailDetailScreen = ({ navigation, route }: any) => {
  const { showAlert, alertProps } = useAlertModal();
  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();
  const { msgId } = route.params;
  const [msg, setMsg] = useState<ZimbraMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const isDraft = route.params?.folder === 'in:drafts';

  useEffect(() => {
    (async () => {
      const detail = await fetchMessageDetail(msgId);
      setMsg(detail);
      setLoading(false);
      if (detail && detail.flags?.includes('u')) {
        await markAsRead(msgId);
      }
    })();
  }, [msgId]);

  const handleReply = () => {
    if (!msg) return;
    const replyTo = msg.from.address;
    const replySubject = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
    const replyBody = `\n\n\n-------- 原始邮件 --------\n发件人: ${msg.from.name || msg.from.address}\n收件人: ${msg.to.map(t => t.address).join(', ')}\n时间: ${formatFullDate(msg.date)}\n主题: ${msg.subject}\n\n${msg.content || ''}`;
    navigation.navigate('ComposeMail', { to: replyTo, subject: replySubject, body: replyBody });
  };

  const handleDelete = () => {
    showAlert({
      title: '删除邮件',
      message: '确定将该邮件移入垃圾箱？',
      icon: 'delete',
      iconColor: '#E53935',
      buttons: [
        { text: '取消', style: 'cancel' },
        {
          text: '删除', style: 'destructive', onPress: async () => {
            await deleteMessage(msgId);
            navigation.goBack();
          },
        },
      ],
    });
  };

  const handleEdit = () => {
    if (!msg) return;
    navigation.navigate('ComposeMail', {
      to: msg.to.map(t => t.address).join(', '),
      subject: msg.subject,
      body: msg.content || '',
    });
  };

  const isHtml = msg?.contentType === 'text/html' && !!msg?.content;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{route.params?.subject || '邮件详情'}</Text>
        <View style={styles.headerActions}>
          {isDraft ? (
            <>
              <TouchableOpacity onPress={handleEdit} style={styles.headerBtn} activeOpacity={0.7}>
                <MaterialIcons name="edit" size={20} color="#0055A8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerBtn} activeOpacity={0.7}>
                <MaterialIcons name="delete-outline" size={20} color="#E53935" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleReply} style={styles.headerBtn} activeOpacity={0.7}>
                <MaterialIcons name="reply" size={20} color="#0055A8" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerBtn} activeOpacity={0.7}>
                <MaterialIcons name="delete-outline" size={20} color="#E53935" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerWrap}><ActivityIndicator size="large" color="#0055A8" /></View>
      ) : !msg ? (
        <View style={styles.centerWrap}><Text style={styles.errorText}>无法加载邮件</Text></View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.headerSection}>
            <View style={styles.fromRow}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{(msg.from.name || msg.from.address || '?')[0]}</Text>
              </View>
              <View style={styles.fromInfo}>
                <Text style={styles.fromName}>{msg.from.name || msg.from.address || '未知发件人'}</Text>
                <Text style={styles.fromAddr}>{msg.from.address}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>收件人:</Text>
              <Text style={styles.metaValue} numberOfLines={2}>{msg.to.map(t => t.address).join(', ')}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>时间:</Text>
              <Text style={styles.metaValue}>{formatFullDate(msg.date)}</Text>
            </View>
            {msg.attachments && msg.attachments.length > 0 && (
              <View style={styles.metaRow}>
                <MaterialIcons name="attachment" size={16} color="#666" />
                <Text style={styles.metaValue}> {msg.attachments.length} 个附件</Text>
              </View>
            )}
            <Text style={styles.subjectText}>{msg.subject}</Text>
          </View>

          {isHtml ? (
            <WebView
              style={{ flex: 1, backgroundColor: '#FFF' }}
              originWhitelist={['*']}
              source={{ html: wrapHtml(msg.content!, winWidth) }}
              scalesPageToFit={true}
              showsVerticalScrollIndicator={true}
            />
          ) : (
            <ScrollView style={styles.textBody} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              <Text style={styles.contentText}>{msg.content || '(无内容)'}</Text>
            </ScrollView>
          )}
        </View>
      )}
      <AlertModal {...alertProps} />
    </View>
  );
};

function wrapHtml(body: string, viewWidth: number): string {
  const css = `
    * { max-width: 100% !important; word-wrap: break-word; }
    body { font-family: -apple-system, sans-serif; font-size: 15px; line-height: 1.6; color: #333; padding: 12px; margin: 0; }
    img { max-width: 100% !important; height: auto; }
    table { max-width: 100% !important; }
    pre { white-space: pre-wrap; background: #F5F5F5; padding: 8px; border-radius: 6px; }
    blockquote { border-left: 3px solid #DDD; margin-left: 0; padding-left: 12px; color: #666; }
    a { color: #0055A8; }
  `;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=${Math.max(viewWidth - 32, 320)}, initial-scale=1.0"><style>${css}</style></head><body>${body}</body></html>`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center', marginHorizontal: 8 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: '#999' },
  headerSection: { padding: 16, paddingBottom: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  fromRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarLarge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  avatarLargeText: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  fromInfo: { marginLeft: 12, flex: 1 },
  fromName: { fontSize: 16, fontWeight: '700', color: '#333' },
  fromAddr: { fontSize: 13, color: '#999', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  metaLabel: { fontSize: 13, color: '#888', width: 56 },
  metaValue: { fontSize: 13, color: '#666', flex: 1 },
  subjectText: { fontSize: 18, fontWeight: '700', color: '#222', marginTop: 12, marginBottom: 4 },
  textBody: { flex: 1, backgroundColor: '#FFF' },
  contentText: { fontSize: 15, color: '#444', lineHeight: 24 },
});
