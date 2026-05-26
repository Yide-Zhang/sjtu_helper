import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { sectionStyles as s } from './sectionStyles';

interface ZimbraMessage {
  flags?: string;
  from: { name?: string; address?: string };
  subject?: string;
}

interface Props {
  navigation: any;
  hasJAccountCreds: boolean | null;
  mailChecking: boolean;
  mailAuthed: boolean;
  mailUnread: number;
  mailLatest: ZimbraMessage | null;
}

export const MailSection: React.FC<Props> = ({
  navigation, hasJAccountCreds, mailChecking, mailAuthed, mailUnread, mailLatest,
}) => (
  <TouchableOpacity style={s.section} onPress={hasJAccountCreds ? () => navigation.navigate('Mail') : () => navigation.navigate('Settings')} activeOpacity={0.7}>
    <View style={s.sectionHeader}>
      <MaterialIcons name="email" size={16} color="#1A73E8" />
      <Text style={s.sectionTitle}>邮箱</Text>
      {mailUnread > 0 && (
        <View style={s.unreadBadge}>
          <Text style={s.unreadBadgeText}>{mailUnread > 99 ? '99+' : mailUnread}</Text>
        </View>
      )}
    </View>
    <View style={s.sectionCard}>
      {hasJAccountCreds === false ? (
        <View style={s.guideRow}>
          <MaterialIcons name="info-outline" size={14} color="#FF8C00" style={{ marginRight: 4 }} />
          <Text style={s.guideText}>未设置 jAccount，前去填写</Text>
        </View>
      ) : mailChecking ? (
        <View style={s.guideRow}>
          <ActivityIndicator size="small" color="#1A73E8" style={{ marginRight: 6 }} />
          <Text style={s.guideText}>正在登录邮箱...</Text>
        </View>
      ) : !mailAuthed ? (
        <View style={s.guideRow}>
          <MaterialIcons name="sync-problem" size={14} color="#E53935" style={{ marginRight: 4 }} />
          <Text style={s.guideText}>邮箱登录失败，请检查凭据</Text>
        </View>
      ) : mailLatest ? (
        <>
          <View style={s.mailFromRow}>
            <View style={[s.mailDot, mailLatest.flags?.includes('u') && s.mailDotUnread]} />
            <Text style={[s.citem, mailLatest.flags?.includes('u') && { fontWeight: '700' }]} numberOfLines={1}>
              {mailLatest.from.name || mailLatest.from.address}
            </Text>
          </View>
          <Text style={s.csub} numberOfLines={1}>{mailLatest.subject}</Text>
        </>
      ) : (
        <Text style={s.cmain}>暂无邮件</Text>
      )}
    </View>
  </TouchableOpacity>
);
