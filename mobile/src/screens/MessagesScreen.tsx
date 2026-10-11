import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, ConversationItem, resolveImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import WebContainer from '../components/WebContainer';
import ChatModal from '../components/ChatModal';
import ErrorBoundary from '../components/ErrorBoundary';
import PublicProfileModal from '../components/PublicProfileModal';

export default function MessagesScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChat, setActiveChat] = useState<{
    transactionId: string;
    itemTitle: string;
    counterpartName: string;
    itemImage?: string | null;
  } | null>(null);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<ConversationItem | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);

  const { user } = useAuth();

  const handleArchiveConversation = async () => {
    if (!confirmDeleteTx) return;
    try {
      setArchiving(true);
      await api.archiveConversation(confirmDeleteTx.transactionId);
      setConversations((prev) =>
        prev.filter((c) => c.transactionId !== confirmDeleteTx.transactionId)
      );
      setConfirmDeleteTx(null);
    } catch (err: any) {
      console.warn('[MessagesScreen] Sohbet arşivlenemedi:', err?.message);
    } finally {
      setArchiving(false);
    }
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.data || []);
    } catch (err: any) {
      console.warn('[MessagesScreen] Konuşmalar alınamadı:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      const interval = setInterval(fetchConversations, 5000);
      return () => clearInterval(interval);
    }, [fetchConversations])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatMessageTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderConversationItem = ({ item }: { item: ConversationItem }) => {
    const timeStr = formatMessageTime(item.lastMessage?.createdAt || item.updatedAt);
    const hasUnread = item.unreadCount > 0;
    const isSelected = isDesktop && activeChat?.transactionId === item.transactionId;

    return (
      <TouchableOpacity
        style={[
          styles.convCard,
          hasUnread && styles.convCardUnread,
          isSelected && styles.convCardSelected,
        ]}
        onPress={() =>
          setActiveChat({
            transactionId: item.transactionId,
            itemTitle: item.itemTitle,
            counterpartName: item.counterpartName,
            itemImage: item.itemImage,
          })
        }
        activeOpacity={0.7}
      >
        {/* Karşı Taraf Avatarı (48x48 daire) */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={(e) => {
            e.stopPropagation?.();
            if (item.counterpartId) {
              setPublicProfileUserId(item.counterpartId);
            }
          }}
          activeOpacity={0.8}
        >
          {item.counterpartAvatar ? (
            <Image
              source={{ uri: resolveImageUrl(item.counterpartAvatar) }}
              style={styles.counterpartAvatarImg}
            />
          ) : (
            <View style={styles.counterpartAvatarFallback}>
              <Text style={styles.counterpartAvatarInitial}>
                {(item.counterpartName || 'K').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Konuşma Bilgileri */}
        <View style={styles.convMain}>
          <View style={styles.convHeaderRow}>
            <View style={styles.nameAndRole}>
              <Text style={styles.counterpartName} numberOfLines={1}>
                {item.counterpartName}
              </Text>
              <Text style={styles.roleTag}>
                {item.isOwner ? '👑 Kiracı' : '🏠 Sahip'}
              </Text>
            </View>
            <View style={styles.headerRightGroup}>
              <Text style={styles.timeText}>{timeStr}</Text>
              <TouchableOpacity
                style={styles.archiveTrashBtn}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setConfirmDeleteTx(item);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.archiveTrashIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* İlan Başlığı (Bağımsız Satır - Çarpışmasız) */}
          <Text style={styles.itemTitle} numberOfLines={1}>
            {`📦 ${item.itemTitle}`}
          </Text>

          {/* Son Mesaj ve Okunmamış Rozet */}
          <View style={styles.lastMessageRow}>
            <Text
              style={[styles.lastMessageText, hasUnread && styles.lastMessageTextUnread]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'Konuşmayı başlatmak için dokunun.'}
            </Text>

            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ErrorBoundary fallbackTitle="Sohbetler Ekranı Yüklenemedi" onReset={fetchConversations}>
      <WebContainer contentContainerStyle={styles.containerContent}>
        {/* SaaS Üst Başlık */}
        <View style={styles.headerCard}>
          <Text style={styles.headerMainTitle}>Sohbetler</Text>
          <Text style={styles.headerSubTitle}>
            Kiracılar ve ilan sahipleriyle olan tüm aktif mesajlaşmalarınızı buradan takip edebilirsiniz.
          </Text>
        </View>

        {isDesktop ? (
          /* Desktop Split-View: Sol 350px Konuşma Listesi, Sağ Flex:1 Aktif Sohbet Paneli */
          <View style={styles.desktopSplitContainer}>
            <View style={styles.desktopListColumn}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.loadingText}>Sohbetler yükleniyor...</Text>
                </View>
              ) : (
                <FlatList
                  data={conversations}
                  keyExtractor={(item) => item.transactionId}
                  renderItem={renderConversationItem}
                  contentContainerStyle={styles.desktopListContent}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyEmoji}>💬</Text>
                      <Text style={styles.emptyTitle}>Henüz bir sohbet yok</Text>
                      <Text style={styles.emptySub}>
                        Kiralama talepleri üzerinden sohbet başlatabilirsiniz.
                      </Text>
                    </View>
                  }
                />
              )}
            </View>

            <View style={styles.desktopChatColumn}>
              {activeChat ? (
                <ChatModal
                  inline
                  visible={!!activeChat}
                  onClose={() => {
                    setActiveChat(null);
                    fetchConversations();
                  }}
                  transactionId={activeChat.transactionId}
                  itemTitle={activeChat.itemTitle}
                  counterpartName={activeChat.counterpartName}
                  itemImage={activeChat.itemImage}
                  currentUserId={user?.id || ''}
                />
              ) : (
                <View style={styles.desktopEmptyChatPane}>
                  <View style={styles.desktopEmptyIconBox}>
                    <Text style={styles.desktopEmptyIcon}>💬</Text>
                  </View>
                  <Text style={styles.desktopEmptyChatTitle}>Bir Konuşma Seçin</Text>
                  <Text style={styles.desktopEmptyChatSub}>
                    Mesajlaşmaya başlamak veya geçmişi görüntülemek için soldaki listeden bir sohbet seçiniz.
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* Mobil Görünüm: Standart Liste + Modal */
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Sohbetler yükleniyor...</Text>
              </View>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.transactionId}
                renderItem={renderConversationItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>💬</Text>
                    <Text style={styles.emptyTitle}>Henüz bir sohbet bulunmuyor</Text>
                    <Text style={styles.emptySub}>
                      Kiralama talebi onaylandığında veya bir ilanınız için talep aldığınızda doğrudan sohbet başlatabilirsiniz.
                    </Text>
                  </View>
                }
              />
            )}

            {/* Mobil Sohbet Modalı */}
            {activeChat ? (
              <ChatModal
                visible={!!activeChat}
                onClose={() => {
                  setActiveChat(null);
                  fetchConversations();
                }}
                transactionId={activeChat.transactionId}
                itemTitle={activeChat.itemTitle}
                counterpartName={activeChat.counterpartName}
                itemImage={activeChat.itemImage}
                currentUserId={user?.id || ''}
              />
            ) : null}
          </>
        )}

        {/* Sohbet Silme / Arşivleme Onay Modalı */}
        <Modal
          visible={!!confirmDeleteTx}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmDeleteTx(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalConfirmCard}>
              <View style={styles.modalIconBox}>
                <Text style={styles.modalIconEmoji}>🗑️</Text>
              </View>
              <Text style={styles.modalConfirmTitle}>Sohbeti Kaldır</Text>
              <Text style={styles.modalConfirmDesc}>
                {`"${confirmDeleteTx?.counterpartName}" ile olan "${confirmDeleteTx?.itemTitle}" sohbetini listenizden kaldırmak istediğinize emin misiniz?`}
              </Text>
              <View style={styles.modalConfirmButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setConfirmDeleteTx(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalApproveDeleteBtn}
                  onPress={handleArchiveConversation}
                  disabled={archiving}
                  activeOpacity={0.8}
                >
                  {archiving ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalApproveDeleteBtnText}>Evet, Kaldır</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Satıcı / Kullanıcı Genel Profil Modalı */}
        <PublicProfileModal
          visible={!!publicProfileUserId}
          userId={publicProfileUserId}
          onClose={() => setPublicProfileUserId(null)}
        />
      </WebContainer>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    paddingVertical: 12,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.04)',
      },
    }),
  },
  headerMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  headerSubTitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 40,
  },
  convCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer' as any,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  convCardUnread: {
    borderColor: '#bfdbfe',
    backgroundColor: '#f8fafc',
  },
  convCardSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  avatarContainer: {
    marginRight: 14,
  },
  counterpartAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterpartAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
  },
  counterpartAvatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
  },
  convMain: {
    flex: 1,
  },
  convHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  nameAndRole: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 8,
  },
  counterpartName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  roleTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  itemTitle: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700',
    marginBottom: 4,
  },
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessageText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
    marginRight: 8,
  },
  lastMessageTextUnread: {
    color: '#0f172a',
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 18,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  archiveTrashBtn: {
    padding: 4,
    borderRadius: 6,
    cursor: 'pointer' as any,
  },
  archiveTrashIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalConfirmCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.12)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  modalIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalIconEmoji: {
    fontSize: 24,
  },
  modalConfirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalConfirmDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  modalApproveDeleteBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalApproveDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Desktop Split-View Styles
  desktopSplitContainer: {
    flexDirection: 'row',
    height: 700,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
      },
    }),
  },
  desktopListColumn: {
    width: 350,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  desktopListContent: {
    padding: 12,
    paddingBottom: 24,
  },
  desktopChatColumn: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  desktopEmptyChatPane: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8fafc',
  },
  desktopEmptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  desktopEmptyIcon: {
    fontSize: 28,
  },
  desktopEmptyChatTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  desktopEmptyChatSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
});
