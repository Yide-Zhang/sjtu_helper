import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { sectionStyles as s } from './sectionStyles';

interface XuanKeInfo {
  academicYear: string;
  seasonCn: string;
  rounds: { round: string; start: string; end: string }[];
}

interface JwcNotice {
  id: string;
  title: string;
  date: string;
  url?: string;
  isXuanKe?: boolean;
  isPingJiao?: boolean;
  pingJiaoEndTime?: string;
  xuankeInfo?: XuanKeInfo;
}

interface IsjtuNotice {
  id: string;
  title: string;
  time?: string;
  isTiaoKe?: boolean;
}

interface Props {
  navigation: any;
  pinnedXuanKe: JwcNotice | null;
  jwcNotices: JwcNotice[];
  isjtuNotices: IsjtuNotice[];
}

export const NotifSection: React.FC<Props> = ({ navigation, pinnedXuanKe, jwcNotices, isjtuNotices }) => (
  <TouchableOpacity style={s.section} onPress={() => navigation.navigate('Notif')} activeOpacity={0.7}>
    <View style={s.sectionHeader}>
      <MaterialIcons name="school" size={16} color="#7B1FA2" />
      <Text style={s.sectionTitle}>教务通知</Text>
      <MaterialIcons name="chevron-right" size={18} color="#999" style={{ marginLeft: 'auto' }} />
    </View>
    {pinnedXuanKe?.xuankeInfo ? (
      <>
        <View style={[s.sectionCard, { borderLeftWidth: 3, borderLeftColor: '#E65100', marginBottom: 6 }]}>
          <View style={s.notifItemRow}>
            <MaterialIcons name="bookmark" size={14} color="#E65100" style={{ marginRight: 4 }} />
            <Text style={[s.citem, { fontWeight: '700', color: '#E65100' }]}>选课通知</Text>
            <View style={[s.notifBadge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[s.notifBadgeText, { color: '#E65100', fontSize: 10 }]}>置顶</Text>
            </View>
          </View>
          <Text style={[s.csub, { fontWeight: '600', marginTop: 4 }]}>{pinnedXuanKe.xuankeInfo.academicYear} {pinnedXuanKe.xuankeInfo.seasonCn}选课</Text>
          {pinnedXuanKe.xuankeInfo.rounds.slice(0, 2).map((r, i) => (
            <View key={i} style={{ marginTop: 2 }}>
              <Text style={[s.csub, { fontSize: 11, color: '#888' }]}>
                {r.round}：{r.start.substring(5, 10)} {r.start.substring(11, 16)} 至
              </Text>
              <Text style={[s.csub, { fontSize: 11, color: '#888', paddingLeft: 0 }]}>
                {r.end.substring(5, 10)} {r.end.substring(11, 16)}
              </Text>
            </View>
          ))}
          {pinnedXuanKe.xuankeInfo.rounds.length > 2 && (
            <Text style={[s.csub, { fontSize: 11, color: '#999', marginTop: 2, fontStyle: 'italic' }]}>{'<点击查看详细>'}</Text>
          )}
        </View>
        {(() => {
          const others: { id: string; title: string; date: string; url?: string; badge?: string; badgeColor?: string }[] = [];
          for (const n of jwcNotices) {
            if (n.id === pinnedXuanKe.id) continue;
            others.push({ id: 'jwc_' + n.id, title: n.title, date: n.date, url: n.url, badge: n.isXuanKe ? '选课' : undefined, badgeColor: '#2E7D32' });
          }
          for (const n of isjtuNotices) {
            others.push({ id: 'isjtu_' + n.id, title: n.title, date: n.time?.substring(0, 10) || '', badge: n.isTiaoKe ? '调课' : undefined, badgeColor: '#E65100' });
          }
          others.sort((a, b) => b.date.localeCompare(a.date));
          const top = others[0];
          if (!top) return null;
          return (
            <TouchableOpacity
              style={s.notifMinorCard}
              activeOpacity={0.7}
              onPress={() => {
                if (top.url && !top.badge) { navigation.navigate('WebView', { url: top.url, title: '教务通知' }); }
                else { navigation.navigate('Notif'); }
              }}
            >
              <View style={s.notifItemRow}>
                <Text style={s.citem} numberOfLines={1}>{top.title}</Text>
                {top.badge && (
                  <View style={[s.notifBadge, { backgroundColor: (top.badgeColor || '#999') + '18' }]}>
                    <Text style={[s.notifBadgeText, { color: top.badgeColor || '#999' }]}>{top.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={s.csub}>{top.date}</Text>
            </TouchableOpacity>
          );
        })()}
      </>
    ) : (() => {
      const merged: { id: string; title: string; date: string; url?: string; badge?: string; badgeColor?: string }[] = [];
      for (const n of jwcNotices) {
        merged.push({ id: 'jwc_' + n.id, title: n.title, date: n.date, url: n.url, badge: n.isXuanKe ? '选课' : undefined, badgeColor: '#2E7D32' });
      }
      for (const n of isjtuNotices) {
        merged.push({ id: 'isjtu_' + n.id, title: n.title, date: n.time?.substring(0, 10) || '', badge: n.isTiaoKe ? '调课' : undefined, badgeColor: '#E65100' });
      }
      const top2 = merged.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
      if (top2.length === 0) return <View style={s.sectionCard}><Text style={s.cmain}>暂无通知</Text></View>;
      return top2.map((item, i) => (
        <TouchableOpacity
          key={item.id}
          style={[item.badge ? s.sectionCard : s.notifMinorCard, i < top2.length - 1 && { marginBottom: 6 }]}
          activeOpacity={0.7}
          onPress={() => {
            if (item.url && !item.badge) { navigation.navigate('WebView', { url: item.url, title: '教务通知' }); }
            else { navigation.navigate('Notif'); }
          }}
        >
          <View style={s.notifItemRow}>
            <Text style={s.citem} numberOfLines={1}>{item.title}</Text>
            {item.badge && (
              <View style={[s.notifBadge, { backgroundColor: (item.badgeColor || '#999') + '18' }]}>
                <Text style={[s.notifBadgeText, { color: item.badgeColor || '#999' }]}>{item.badge}</Text>
              </View>
            )}
          </View>
          <Text style={s.csub}>{item.date}</Text>
        </TouchableOpacity>
      ));
    })()}
  </TouchableOpacity>
);
