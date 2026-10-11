import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, PublicProfileUser, ReviewEntity, resolveImageUrl, ItemEntity } from '../services/api';

interface PublicProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  onSelectItem?: (item: ItemEntity) => void;
  onSendMessage?: (sellerId: string, sellerName: string) => void;
}

export default function PublicProfileModal({
  visible,
  onClose,
  userId,
  onSelectItem,
  onSendMessage,
}: PublicProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfileUser | null>(null);
  const [reviews, setReviews] = useState<ReviewEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'items' | 'reviews'>('items');

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  useEffect(() => {
    if (!visible || !userId) {
      setProfile(null);
      setReviews([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [profRes, revRes] = await Promise.all([
          api.getPublicProfile(userId).catch(() => ({ data: null })),
          api.getUserReviews(userId).catch(() => ({ data: [] })),
        ]);

        if (isMounted) {
          setProfile(profRes.data);
          setReviews(revRes.data || []);
        }
      } catch (err) {
        console.warn('[PublicProfileModal] Profil bilgisi yüklenemedi:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [visible, userId]);

  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return 'Yeni Üye';
    try {
      const date = new Date(dateStr);
      const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
      ];
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${month} ${year}'den beri üye`;
    } catch {
      return 'Kayıtlı Komşu';
    }
  };

  const avatarUri = profile?.avatarUrl ? resolveImageUrl(profile.avatarUrl) : null;
  const initial = (profile?.fullName || 'K').slice(0, 1).toUpperCase();
  const ratingValue = (profile?.rating ?? 5.0).toFixed(1);
  const ratingCount = profile?.ratingCount ?? reviews.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.modalCard, isDesktop && styles.desktopModalCard]}>
          {/* Modal Üst Başlık & Kapat Butonu */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Satıcı Profili</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Satıcı profili yükleniyor...</Text>
            </View>
          ) : !profile ? (
            <View style={styles.centered}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
              <Text style={styles.notFoundTitle}>Profil Bulunamadı</Text>
              <Text style={styles.notFoundSub}>Bu kullanıcıya ait bilgilere ulaşılamadı.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Profil Kartı Hero */}
              <View style={styles.heroBox}>
                <View style={styles.avatarSection}>
                  <View style={styles.avatarCircle}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    )}
                  </View>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeIcon}>✓</Text>
                  </View>
                </View>

                <View style={styles.heroDetails}>
                  <View style={styles.nameRow}>
                    <Text style={styles.sellerName}>{profile.fullName}</Text>
                    <View style={styles.verifiedPill}>
                      <Text style={styles.verifiedPillText}>✓ Doğrulanmış Hesap</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingStar}>⭐</Text>
                      <Text style={styles.ratingText}>
                        {ratingValue} ({ratingCount} Değerlendirme)
                      </Text>
                    </View>
                    <Text style={styles.dotSeparator}>•</Text>
                    <Text style={styles.joinDateText}>📅 {formatJoinDate(profile.createdAt)}</Text>
                  </View>

                  <Text style={styles.safetyGuarantee}>
                    🛡️ Güvenli Mahalle Paylaşımcısı • Telefon ve E-posta Gizlilik Koruması Altında
                  </Text>
                </View>
              </View>

              {/* Sekme Butonları (Yayındaki İlanlar vs. Değerlendirmeler) */}
              <View style={styles.tabsRow}>
                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'items' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('items')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabBtnText, activeTab === 'items' && styles.tabBtnTextActive]}>
                    📦 Yayındaki İlanları ({profile.items?.length || 0})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]}
                  onPress={() => setActiveTab('reviews')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabBtnText, activeTab === 'reviews' && styles.tabBtnTextActive]}>
                    ⭐ Değerlendirmeler ({reviews.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* SEKME 1: YAYINDAKİ İLANLAR */}
              {activeTab === 'items' && (
                <View style={styles.tabContentContainer}>
                  {profile.items && profile.items.length > 0 ? (
                    <View style={[styles.itemsGrid, isDesktop && styles.desktopItemsGrid]}>
                      {profile.items.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.itemCard, isDesktop && styles.desktopItemCard]}
                          onPress={() => {
                            onClose();
                            onSelectItem?.(item);
                          }}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: resolveImageUrl(item.images?.[0]) }}
                            style={styles.itemImage}
                            resizeMode="cover"
                          />
                          <View style={styles.itemCardBody}>
                            <Text style={styles.itemCardTitle} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.itemCardPrice}>{item.pricePerDay} ₺ / gün</Text>
                            <View style={styles.itemCardRatingRow}>
                              <Text style={styles.itemCardRating}>⭐ {(item.rating ?? 5.0).toFixed(1)}</Text>
                              <Text style={styles.itemCardCategory}>{item.category}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyEmoji}>📦</Text>
                      <Text style={styles.emptyTitle}>Yayında Aktif İlan Bulunmuyor</Text>
                      <Text style={styles.emptySub}>Bu komşumuzun şu anda kiralık eşyası yok.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* SEKME 2: DEĞERLENDİRMELER */}
              {activeTab === 'reviews' && (
                <View style={styles.tabContentContainer}>
                  {reviews.length > 0 ? (
                    <View style={styles.reviewsList}>
                      {reviews.map((rev) => (
                        <View key={rev.id} style={styles.reviewCard}>
                          <View style={styles.reviewHeader}>
                            <View style={styles.reviewerAvatar}>
                              {rev.reviewer?.avatarUrl ? (
                                <Image
                                  source={{ uri: resolveImageUrl(rev.reviewer.avatarUrl) }}
                                  style={styles.reviewerAvatarImg}
                                />
                              ) : (
                                <Text style={styles.reviewerAvatarInitial}>
                                  {(rev.reviewer?.fullName || 'K').slice(0, 1).toUpperCase()}
                                </Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reviewerName}>
                                {rev.reviewer?.fullName || 'Anonim Komşu'}
                              </Text>
                              <View style={styles.reviewStarsRow}>
                                <Text style={styles.starsText}>
                                  {'⭐'.repeat(rev.ownerRating || rev.itemRating || 5)}
                                </Text>
                                <Text style={styles.reviewDate}>
                                  {new Date(rev.createdAt).toLocaleDateString('tr-TR')}
                                </Text>
                              </View>
                            </View>
                          </View>
                          {rev.comment ? (
                            <Text style={styles.reviewComment}>"{rev.comment}"</Text>
                          ) : (
                            <Text style={styles.reviewCommentPlaceholder}>Yorum belirtilmedi.</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyEmoji}>🌟</Text>
                      <Text style={styles.emptyTitle}>Henüz Değerlendirme Yok</Text>
                      <Text style={styles.emptySub}>Bu kullanıcı henüz bir kiralama değerlendirmesi almamış.</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(6px)',
      },
    }),
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  desktopModalCard: {
    maxWidth: 720,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  centered: {
    padding: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  notFoundSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  scrollContent: {
    padding: 24,
  },
  heroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 18,
    marginBottom: 20,
  },
  avatarSection: {
    position: 'relative',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#eff6ff',
    borderWidth: 3,
    borderColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '800',
    color: '#2563eb',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  verifiedBadgeIcon: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  heroDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sellerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifiedPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  verifiedPillText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    fontSize: 14,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  dotSeparator: {
    color: '#94a3b8',
    fontSize: 12,
  },
  joinDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  safetyGuarantee: {
    fontSize: 11,
    color: '#0284c7',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
      },
    }),
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  tabContentContainer: {
    marginTop: 4,
  },
  itemsGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  desktopItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopItemCard: {
    width: '48.5%',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  itemImage: {
    width: 100,
    height: 100,
    backgroundColor: '#e2e8f0',
  },
  itemCardBody: {
    padding: 12,
    flex: 1,
  },
  itemCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemCardPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 3,
  },
  itemCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  itemCardRating: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  itemCardCategory: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  reviewerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  reviewerAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  starsText: {
    fontSize: 11,
  },
  reviewDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  reviewComment: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  reviewCommentPlaceholder: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
});
