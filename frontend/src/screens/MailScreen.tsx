import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ensureMailAuth, fetchFolder, MailFolderQuery, ZimbraMessage } from '../api/mail';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

interface FolderDef { key: MailFolderQuery; label: string; icon: string; color: string; }

const FOLDERS: FolderDef[] = [
  { key: 'in:inbox',   label: '收件箱', icon: 'inbox',       color: '#0055A8' },
  { key: 'in:sent',    label: '已发送', icon: 'send',        color: '#43A047' },
  { key: 'in:drafts',  label: '草稿箱', icon: 'drafts',      color: '#FF9800' },
  { key: 'in:junk',    label: '垃圾邮件', icon: 'report',    color: '#E53935' },
  { key: 'in:trash',   label: '已删除', icon: 'delete',      color: '#888' },
];

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export const MailScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ZimbraMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [currentFolder, setCurrentFolder] = useState<MailFolderQuery>('in:inbox');
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const loadFolder = useCallback(async (folder: MailFolderQuery, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const authed = await ensureMailAuth();
    setAuthed(authed);
    if (!authed) { setLoading(false); setRefreshing(false); return; }

    const result = await fetchFolder(folder, 50, 0);
    if (result) setMessages(result.messages);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadFolder(currentFolder); }, []);

  const switchFolder = (folder: MailFolderQuery) => {
    setShowFolderPicker(false);
    if (folder === currentFolder) return;
    setCurrentFolder(folder);
    loadFolder(folder);
  };

  // 聚焦时刷新当前文件夹
  useFocusEffect(useCallback(() => {
    loadFolder(currentFolder, true);
  }, [currentFolder]));

  const renderItem = ({ item }: { item: ZimbraMessage }) => {
    const isUnread = item.flags?.includes('u');
    return (
      <TouchableOpacity
        style={[styles.msgCard, isUnread && styles.msgCardUnread]}
        onPress={() => navigation.navigate('MailDetail', { msgId: item.id, subject: item.subject, folder: currentFolder })}
        activeOpacity={0.7}
      >
        <View style={styles.msgLeft}>
          <View style={[styles.avatar, isUnread && styles.avatarActive]}>
            <Text style={styles.avatarText}>{(item.from.name || item.from.address || '?')[0]}</Text>
          </View>
        </View>
        <View style={styles.msgBody}>
          <View style={styles.msgRow}>
            <Text style={[styles.sender, isUnread && styles.senderUnread]} numberOfLines={1}>
              {item.from.name || item.from.address || '未知发件人'}
            </Text>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
          </View>
          <Text style={[styles.subject, isUnread && styles.subjectUnread]} numberOfLines={1}>{item.subject}</Text>
          {item.fragment ? <Text style={styles.fragment} numberOfLines={1}>{item.fragment}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.titleRow} onPress={() => setShowFolderPicker(true)} activeOpacity={0.7}>
          <Text style={styles.title}>{FOLDERS.find(f => f.key === currentFolder)?.label || '邮箱'}</Text>
          <MaterialIcons name="arrow-drop-down" size={22} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerRight} />
      </View>

      {/* 文件夹选择弹窗 */}
      <Modal visible={showFolderPicker} transparent animationType="fade" onRequestClose={() => setShowFolderPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFolderPicker(false)}>
          <View style={styles.folderMenu}>
            {FOLDERS.map(f => {
              const active = f.key === currentFolder;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.folderMenuItem, active && { backgroundColor: f.color + '18' }]}
                  onPress={() => switchFolder(f.key)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name={f.icon as any} size={20} color={active ? f.color : '#666'} />
                  <Text style={[styles.folderMenuText, active && { color: f.color, fontWeight: '700' }]}>{f.label}</Text>
                  {active && <MaterialIcons name="check" size={18} color={f.color} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {authed === false && (
        <View style={styles.centerWrap}>
          <MaterialIcons name="lock" size={40} color="#999" />
          <Text style={styles.centerText}>邮箱认证失败，请检查凭据</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadFolder(currentFolder)} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#0055A8" />
          <Text style={styles.centerText}>加载中...</Text>
        </View>
      )}

      {authed && !loading && messages.length === 0 && (
        <View style={styles.centerWrap}>
          <MaterialIcons name={FOLDERS.find(f => f.key === currentFolder)?.icon as any || 'inbox'} size={40} color="#CCC" />
          <Text style={styles.centerText}>暂无邮件</Text>
        </View>
      )}

      {authed && messages.length > 0 && (
        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFolder(currentFolder, true)} colors={['#0055A8']} tintColor="#0055A8" />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      {/* 浮动写邮件按钮 */}
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={() => navigation.navigate('ComposeMail')} activeOpacity={0.8}>
        <MaterialIcons name="edit" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center' },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#333' },
  headerRight: { width: 36 },

  // 文件夹选择弹窗
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  folderMenu: {
    width: '72%', backgroundColor: '#FFF', borderRadius: 16, padding: 8,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  folderMenuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, gap: 12,
  },
  folderMenuText: { fontSize: 16, color: '#333' },

  list: { paddingHorizontal: 12, paddingBottom: 20 },
  msgCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, alignItems: 'center' },
  msgCardUnread: { borderLeftWidth: 3, borderLeftColor: '#0055A8' },
  msgLeft: { marginRight: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  avatarActive: { backgroundColor: '#0055A8' },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  msgBody: { flex: 1 },
  msgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sender: { fontSize: 14, color: '#666', flex: 1 },
  senderUnread: { color: '#333', fontWeight: '700' },
  date: { fontSize: 12, color: '#AAA', marginLeft: 8 },
  subject: { fontSize: 15, color: '#333', marginTop: 2 },
  subjectUnread: { fontWeight: '700' },
  fragment: { fontSize: 13, color: '#999', marginTop: 2 },
  sep: { height: 8 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  centerText: { fontSize: 14, color: '#999', marginTop: 12 },
  retryBtn: { marginTop: 16, backgroundColor: '#0055A8', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#0055A8', justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
  },
});
