import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getCommunityFavorites, removeCommunityFavorite, CommunityFavorite } from '../utils/storage';

export const FavoritesScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<CommunityFavorite[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const favs = await getCommunityFavorites();
      setFavorites(favs);
    })();
  }, []);

  const confirmRemove = (courseId: number) => {
    setPendingRemove(courseId);
    setShowConfirm(true);
  };

  const handleRemove = async () => {
    if (pendingRemove === null) return;
    await removeCommunityFavorite(pendingRemove);
    setFavorites(prev => prev.filter(f => f.courseId !== pendingRemove));
    setShowConfirm(false);
    setPendingRemove(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的收藏</Text>
        <View style={{ width: 40 }} />
      </View>
      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="favorite-border" size={48} color="#DDD" />
          <Text style={styles.emptyText}>暂无收藏</Text>
          <Text style={styles.emptyHint}>在搜索课程时点击 ♡ 即可收藏</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => String(item.courseId)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => navigation.navigate('CommunityReview', { initialSearch: item.courseCode })}
                activeOpacity={0.7}
              >
                <Text style={styles.courseName}>{item.courseName || item.courseCode}</Text>
                <Text style={styles.teacherName}>{item.teacherName}</Text>
                {item.avgRating != null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 13, color: '#FFB800' }}>{'★'.repeat(Math.floor(item.avgRating))}{'☆'.repeat(5 - Math.floor(item.avgRating))}</Text>
                    <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>{item.avgRating.toFixed(2)}</Text>
                    <Text style={{ fontSize: 11, color: '#AAA', marginLeft: 4 }}>{item.reviewCount}条</Text>
                    {item.credibilityLevel && (
                      <View style={{ borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: (item.credibilityLevel === '高' ? '#4CAF50' : item.credibilityLevel === '中' ? '#FF9800' : '#9E9E9E') + '20', marginLeft: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: item.credibilityLevel === '高' ? '#4CAF50' : item.credibilityLevel === '中' ? '#FF9800' : '#9E9E9E' }}>可信:{item.credibilityLevel}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmRemove(item.courseId)} style={styles.removeBtn} activeOpacity={0.7}>
                <MaterialIcons name="close" size={18} color="#E53935" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialIcons name="warning" size={36} color="#E53935" style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>确认删除</Text>
            <Text style={styles.modalBody}>确定要从收藏中移除该课程吗？</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowConfirm(false)} activeOpacity={0.7}>
                <Text style={styles.btnCancelText}>算了</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnConfirm} onPress={handleRemove} activeOpacity={0.7}>
                <Text style={styles.btnConfirmText}>是</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#BBB', marginTop: 6 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  courseName: { fontSize: 15, fontWeight: '600', color: '#333' },
  teacherName: { fontSize: 13, color: '#888', marginTop: 2 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', borderRadius: 14, padding: 24, width: '75%', alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  modalBody: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  btnCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#E0E0E0', alignItems: 'center' },
  btnCancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  btnConfirm: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#E53935', alignItems: 'center' },
  btnConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
