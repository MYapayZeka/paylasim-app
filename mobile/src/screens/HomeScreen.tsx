import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { api, ItemEntity, TransactionItem, resolveImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import WebContainer from '../components/WebContainer';
import RentBookingModal from '../components/RentBookingModal';
import HandoverModal from '../components/HandoverModal';
import PublicProfileModal from '../components/PublicProfileModal';

const CATEGORIES = [
  { label: 'Tümü', value: 'ALL', icon: '✨' },
  { label: 'El Aletleri', value: 'TOOLS', icon: '🔧' },
  { label: 'Kamp & Doğa', value: 'CAMPING', icon: '🏕️' },
  { label: 'Elektronik', value: 'ELECTRONICS', icon: '📷' },
  { label: 'Ev & Bahçe', value: 'HOME_GARDEN', icon: '🏡' },
  { label: 'Spor', value: 'SPORTS', icon: '⚽' },
  { label: 'Araç Gereç', value: 'VEHICLE_ACCESSORIES', icon: '🚗' },
  { label: 'Diğer', value: 'OTHER', icon: '📦' },
];

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemEntity | null>(null);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Canlı Takip & Eylem Merkezi (Actionable Dashboard) State'leri
  const [pendingRequests, setPendingRequests] = useState<TransactionItem[]>([]);
  const [activeRentals, setActiveRentals] = useState<TransactionItem[]>([]);
  const [activeHandoverId, setActiveHandoverId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Konum State'i (Varsayılan: İstanbul Kadıköy)
  const [coords, setCoords] = useState({ latitude: 40.9905, longitude: 29.0295 });

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const numColumns = isDesktop ? 3 : 1;

  const fetchItems = useCallback(async (currentCoords = coords) => {
    try {
      const res = await api.searchItems(currentCoords.latitude, currentCoords.longitude);
      setItems(res.data || []);
    } catch (err: any) {
      console.log('İlan çekme hatası:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coords]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const newCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setCoords(newCoords);
          fetchItems(newCoords);
          return;
        }
      } catch (e) {
        console.log('Konum izni alınamadı, varsayılan konum kullanılıyor.');
      }
      fetchItems();
    })();
  }, []);

  // Her saniye canlı geri sayımı güncelle
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) {
      setPendingRequests([]);
      setActiveRentals([]);
      return;
    }
    try {
      const [incRes, outRes] = await Promise.all([
        api.getIncomingTransactions().catch(() => ({ data: [] })),
        api.getOutgoingTransactions().catch(() => ({ data: [] })),
      ]);

      const inc: TransactionItem[] = Array.isArray(incRes?.data)
        ? incRes.data
        : Array.isArray(incRes)
        ? (incRes as any)
        : [];
      const out: TransactionItem[] = Array.isArray(outRes?.data)
        ? outRes.data
        : Array.isArray(outRes)
        ? (outRes as any)
        : [];

      // Bekleyen yeni teklifler (İlan sahibine gelen onay bekleyen talepler)
      const pending = inc.filter((tx) => tx.status === 'PENDING');

      // Aktif kiralamalar (DELIVERED statüsündeki gelen veya giden işlemler)
      const allDelivered = [...inc, ...out].filter((tx) => tx.status === 'DELIVERED');
      const uniqueDelivered = Array.from(
        new Map(allDelivered.map((tx) => [tx.id, tx])).values()
      );

      setPendingRequests(pending);
      setActiveRentals(uniqueDelivered);
    } catch (err: any) {
      console.warn('[HomeScreen] Operasyon merkezi verileri alınamadı:', err?.message);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 6000);
      return () => clearInterval(interval);
    }, [fetchDashboardData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchItems();
    fetchDashboardData();
  };

  const handleOpenBookingModal = (item: ItemEntity) => {
    setSelectedItem(item);
  };

  const getRentalCountdown = (endDateStr?: string | Date | null) => {
    if (!endDateStr) return { text: '-', isExpired: false };
    const diff = new Date(endDateStr).getTime() - currentTime;
    if (diff <= 0) {
      return { text: 'Süre Doldu', isExpired: true };
    }
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return {
        text: `${days}G ${hours}S ${minutes}D ${seconds}s`,
        isExpired: false,
      };
    }
    return {
      text: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0'
      )}:${String(seconds).padStart(2, '0')}`,
      isExpired: false,
    };
  };

  const renderActionableDashboard = () => {
    if (!user) return null;
    if (pendingRequests.length === 0 && activeRentals.length === 0) return null;

    return (
      <View style={styles.dashboardContainer}>
        <View style={styles.dashboardHeader}>
          <View style={styles.dashboardIconBox}>
            <Text style={styles.dashboardHeaderIcon}>🎯</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dashboardTitle}>CANLI OPERASYON VE EYLEM MERKEZİ</Text>
            <Text style={styles.dashboardSub}>
              Aksiyon bekleyen talepleriniz ve süreci devam eden aktif kiralamalarınız
            </Text>
          </View>
        </View>

        {/* BÖLÜM 1: BEKLEYEN YENİ TEKLİFLER */}
        {pendingRequests.length > 0 && (
          <View style={styles.dashSection}>
            <View style={styles.dashSectionTagRow}>
              <Text style={styles.pendingTagBadge}>
                {`⚡ ONAY BEKLEYEN TALEPLER (${pendingRequests.length})`}
              </Text>
            </View>
            <View style={styles.dashCardsList}>
              {pendingRequests.map((req) => {
                const requesterName =
                  req.borrower?.fullName ||
                  (req as any)?.renter?.fullName ||
                  'Kiracı';
                const itemTitle = req.item?.title || req.itemTitle || 'Eşya';
                return (
                  <View key={`pending-${req.id}`} style={styles.pendingActionCard}>
                    <View style={styles.pendingCardLeft}>
                      <Text style={styles.pendingCardTitle}>
                        {`⚡ Yeni Talep: ${itemTitle} - ${requesterName}`}
                      </Text>
                      <Text style={styles.pendingCardDetails}>
                        {`Tutar: ${req.totalPrice ?? 0} ₺  •  Durum: Onayınızı bekliyor`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.pendingCardBtn}
                      onPress={() =>
                        navigation?.navigate?.('Talepler', { tab: 'incoming' })
                      }
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pendingCardBtnText}>İncele ➔</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* BÖLÜM 2: AKTİF KİRALAMALAR VE CANLI SAYAÇ */}
        {activeRentals.length > 0 && (
          <View
            style={[
              styles.dashSection,
              pendingRequests.length > 0 && { marginTop: 14 },
            ]}
          >
            <View style={styles.dashSectionTagRow}>
              <Text style={styles.activeTagBadge}>
                {`📦 AKTİF KİRALAMA & SÜRE TAKİBİ (${activeRentals.length})`}
              </Text>
            </View>
            <View style={styles.dashCardsList}>
              {activeRentals.map((rental) => {
                const isOwner = rental.item?.ownerId === user?.id;
                const counterpart = isOwner
                  ? `Kiracı: ${
                      rental.borrower?.fullName ||
                      (rental as any)?.renter?.fullName ||
                      'Kiracı'
                    }`
                  : `Sahip: ${
                      rental.item?.owner?.fullName ||
                      (rental as any)?.owner?.fullName ||
                      'Eşya Sahibi'
                    }`;
                const itemTitle =
                  rental.item?.title || rental.itemTitle || 'Eşya';
                const imageUri = rental.item?.images?.[0]
                  ? resolveImageUrl(rental.item.images[0])
                  : null;
                const countdown = getRentalCountdown(rental.endDate);

                return (
                  <View key={`active-${rental.id}`} style={styles.activeRentalCard}>
                    {/* Görsel Thumbnail */}
                    <View style={styles.rentalThumbnailBox}>
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.rentalThumbnail}
                        />
                      ) : (
                        <Text style={{ fontSize: 20 }}>📦</Text>
                      )}
                    </View>

                    {/* Detay Bilgileri */}
                    <View style={styles.rentalInfoCol}>
                      <Text style={styles.rentalItemTitle} numberOfLines={1}>
                        {itemTitle}
                      </Text>
                      <Text style={styles.rentalCounterpart} numberOfLines={1}>
                        {counterpart}
                      </Text>

                      {/* Canlı Geri Sayım / Süre Doldu Rozeti */}
                      <View style={styles.rentalCountdownRow}>
                        {countdown.isExpired ? (
                          <View style={styles.expiredBadgeBox}>
                            <Text style={styles.expiredBadgeText}>
                              ⚠️ İade Bekleniyor (Süre Doldu)
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.liveTimerBadgeBox}>
                            <Text style={styles.liveTimerBadgeText}>
                              {`⏱️ Kalan: ${countdown.text}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Aksiyon Butonu */}
                    <TouchableOpacity
                      style={[
                        styles.rentalActionBtn,
                        countdown.isExpired && styles.rentalActionBtnExpired,
                      ]}
                      onPress={() => setActiveHandoverId(rental.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.rentalActionBtnText}>
                        {countdown.isExpired ? 'İadeyi Yönet ➔' : 'Canlı Takip ➔'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderItemCard = ({ item }: { item: ItemEntity }) => (
    <View style={styles.card}>
      <View style={styles.cardImageContainer}>
        <Image
          source={{ uri: resolveImageUrl(item.images[0]) }}
          style={styles.cardImage}
        />
        <View style={styles.imageOverlayBadge}>
          <Text style={styles.categoryBadge}>{item.category}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        {/* Satıcı Bilgisi ve Puanı (Tıklanınca Genel Profil Açar) */}
        <TouchableOpacity
          style={styles.sellerHeaderPill}
          onPress={() => item.ownerId && setPublicProfileUserId(item.ownerId)}
          activeOpacity={0.7}
        >
          <View style={styles.sellerMiniAvatar}>
            {item.owner?.avatarUrl ? (
              <Image
                source={{ uri: resolveImageUrl(item.owner.avatarUrl) }}
                style={styles.sellerMiniAvatarImg}
              />
            ) : (
              <Text style={styles.sellerMiniInitial}>
                {(item.owner?.fullName || 'K').slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.sellerMiniName} numberOfLines={1}>
            {item.owner?.fullName || 'Komşu'}
          </Text>
          <View style={styles.sellerRatingPill}>
            <Text style={styles.sellerRatingText}>
              ⭐ {(item.owner?.rating ?? item.rating ?? 5.0).toFixed(1)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.metaRow}>
          <Text style={styles.distanceBadge}>
            📍 {item.distanceMeters !== undefined
              ? (item.distanceMeters > 1000
                ? `${(item.distanceMeters / 1000).toFixed(1)} km`
                : `${item.distanceMeters} m`)
              : 'Yaklaşık ~150m'}
          </Text>
          <Text style={styles.addressMini} numberOfLines={1}>{item.addressText}</Text>
        </View>

        {/* Depozito Bilgi Rozeti */}
        {!!item.deposit && item.deposit > 0 && (
          <View style={styles.depositPill}>
            <Text style={styles.depositPillText}>🛡️ Depozito: {item.deposit} ₺</Text>
          </View>
        )}

        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.priceText}>{item.pricePerDay} ₺</Text>
            <Text style={styles.priceSub}>günlük ücret</Text>
          </View>

          {item.ownerId === user?.id ? (
            <View style={styles.ownItemBadgePill}>
              <Text style={styles.ownItemBadgeText}>Bu İlan Size Ait</Text>
            </View>
          ) : item.isRented ? (
            <View style={styles.rentedBadgePill}>
              <Text style={styles.rentedBadgeText}>
                🔒 Kirada • {getRentalCountdown(item.rentalEndDate).text}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.rentButton}
              onPress={() => handleOpenBookingModal(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.rentButtonText}>Kirala</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <WebContainer
      scrollable
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />
      }
      contentContainerStyle={styles.containerContent}
    >
      {/* Mobilde Native Uygulama Başlığı (Logo, Mahalle Konumu ve Hızlı Aksiyon) */}
      {!isDesktop && (
        <View style={styles.nativeMobileHeader}>
          <View style={styles.nativeHeaderLeft}>
            <View style={styles.nativeLogoRow}>
              <View style={styles.nativeLogoBox}>
                <Text style={styles.nativeLogoEmoji}>🤝</Text>
              </View>
              <Text style={styles.nativeLogoText}>
                Paylaş<Text style={{ color: '#2563eb' }}>IM</Text>
              </Text>
            </View>
            <View style={styles.nativeLocationRow}>
              <Text style={styles.nativeLocationIcon}>📍</Text>
              <Text style={styles.nativeLocationText}>Kadıköy, İstanbul</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.nativeHeaderActionBtn}
            onPress={() => navigation?.navigate?.('İlan Ver')}
            activeOpacity={0.8}
          >
            <Text style={styles.nativeHeaderActionIcon}>＋</Text>
            <Text style={styles.nativeHeaderActionText}>İlan Ver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SaaS Minimalist Arama & Kategori Çubuğu */}
      <View style={styles.compactSearchSection}>
        <View style={styles.compactSearchBar}>
          <Text style={styles.compactSearchIcon}>🔍</Text>
          <TextInput
            style={styles.compactSearchInput}
            placeholder="İlan adı, marka veya semt ara..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.heroSearchActionBtn}
            onPress={() => navigation?.navigate?.('Arama', { query: searchQuery })}
            activeOpacity={0.8}
          >
            <Text style={styles.heroSearchActionText}>Filtreler ➔</Text>
          </TouchableOpacity>
        </View>

        {/* Yatay Kategori Çipleri (Pill Chips) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesRow}
          contentContainerStyle={styles.categoriesRowContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryChip,
                selectedCategory === cat.value && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.value)}
              activeOpacity={0.8}
            >
              <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === cat.value && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CANLI TAKİP & OPERASYON EYLEM MERKEZİ */}
      {renderActionableDashboard()}

      {/* İlanlar Başlık Şeridi */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>📍 Çevrendeki İlanlar</Text>
        <Text style={styles.sectionHeaderSub}>
          {searchQuery
            ? `"${searchQuery}" için bulunan sonuçlar (${
                items.filter((item) => {
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    item.title.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q) ||
                    item.addressText.toLowerCase().includes(q)
                  );
                }).length
              })`
            : 'En yakın mesafedeki onaylı komşu eşyaları'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Yakındaki ilanlar taranıyor...</Text>
        </View>
      ) : (() => {
          const filtered = items.filter((item) => {
            const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
            if (!matchesCat) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            return (
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.addressText.toLowerCase().includes(q)
            );
          });

          if (filtered.length === 0) {
            return (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🔎</Text>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'Aradığınız kriterde ilan bulunamadı' : 'Henüz yakınınızda ilan bulunamadı'}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'Arama kelimesini değiştirebilir veya arama çubuğunu temizleyebilirsiniz.'
                    : 'İlk eşyayı siz paylaşarak mahallenizde paylaşım hareketini başlatabilirsiniz.'}
                </Text>
              </View>
            );
          }

          return (
            <View style={[styles.gridContainer, isDesktop && styles.desktopGridContainer]}>
              {filtered.map((item) => (
                <View key={item.id} style={[styles.cardWrapper, isDesktop && styles.desktopCardWrapper]}>
                  {renderItemCard({ item })}
                </View>
              ))}
            </View>
          );
        })()}

      {/* Gün / Saat Destekli Kiralama Modalı */}
      <RentBookingModal
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        navigation={navigation}
      />

      {/* Teslimat Tokalaşması & Canlı Kiralama Takip Modalı */}
      {activeHandoverId ? (
        <HandoverModal
          visible={!!activeHandoverId}
          onClose={() => setActiveHandoverId(null)}
          transactionId={activeHandoverId}
          onSuccess={() => {
            fetchDashboardData();
            fetchItems();
          }}
        />
      ) : null}

      {/* Satıcı Genel Profil Modalı (Gizlilik Korumalı) */}
      <PublicProfileModal
        visible={!!publicProfileUserId}
        userId={publicProfileUserId}
        onClose={() => setPublicProfileUserId(null)}
        onSelectItem={(item) => handleOpenBookingModal(item)}
      />
    </WebContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    paddingVertical: 12,
  },
  compactSearchSection: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px -3px rgba(15, 23, 42, 0.05)',
      },
    }),
  },
  compactSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  compactSearchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  compactSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 4,
    outlineWidth: 0,
  } as any,
  categoriesRow: {
    flexDirection: 'row',
  },
  categoriesRowContent: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  categoryChipIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryChipTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  ownItemBadgePill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  ownItemBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  centered: {
    paddingVertical: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  gridContainer: {
    width: '100%',
    paddingBottom: 40,
  },
  desktopGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  cardWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  desktopCardWrapper: {
    width: '31.5%',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  sellerHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sellerMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sellerMiniAvatarImg: {
    width: '100%',
    height: '100%',
  },
  sellerMiniInitial: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563eb',
  },
  sellerMiniName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    flex: 1,
  },
  sellerRatingPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sellerRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  cardImageContainer: {
    position: 'relative',
    width: '100%',
    height: 190,
    backgroundColor: '#e2e8f0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distanceBadge: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '700',
  },
  addressMini: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14,
    minHeight: 36,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  rentButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    cursor: 'pointer' as any,
  },
  rentButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
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
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  modalIconEmoji: {
    fontSize: 22,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalItemTitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  modalErrorIcon: {
    fontSize: 16,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#b91c1c',
    lineHeight: 18,
  },
  modalSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  modalSuccessIcon: {
    fontSize: 16,
  },
  modalSuccessText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
    lineHeight: 18,
  },
  modalPriceCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  modalPriceLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  modalPriceVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#93c5fd',
  },
  sectionHeaderRow: {
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  sectionHeaderSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  dashboardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.06)',
      },
      default: {
        elevation: 3,
      },
    }),
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dashboardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardHeaderIcon: {
    fontSize: 22,
  },
  dashboardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1e3a8a',
    letterSpacing: 0.5,
  },
  dashboardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dashSection: {
    marginTop: 4,
  },
  dashSectionTagRow: {
    marginBottom: 10,
  },
  pendingTagBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  activeTagBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  dashCardsList: {
    gap: 10,
  },
  pendingActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 12,
  },
  pendingCardLeft: {
    flex: 1,
  },
  pendingCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },
  pendingCardDetails: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
    fontWeight: '500',
  },
  pendingCardBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  pendingCardBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  activeRentalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  rentalThumbnailBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  rentalInfoCol: {
    flex: 1,
  },
  rentalItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  rentalCounterpart: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  rentalCountdownRow: {
    marginTop: 4,
  },
  expiredBadgeBox: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  expiredBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  liveTimerBadgeBox: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  liveTimerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  rentalActionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  rentalActionBtnExpired: {
    backgroundColor: '#dc2626',
  },
  rentalActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  rentedBadgePill: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentedBadgeText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  depositPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  depositPillText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '700',
  },
  heroSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    marginTop: 18,
    height: 48,
    maxWidth: 620,
  },
  heroSearchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  heroSearchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
    outlineStyle: 'none' as any,
  },
  clearSearchBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearSearchText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  heroSearchActionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 6,
    cursor: 'pointer' as any,
  },
  heroSearchActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  nativeMobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  nativeHeaderLeft: {
    gap: 2,
  },
  nativeLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nativeLogoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  nativeLogoEmoji: {
    fontSize: 18,
  },
  nativeLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  nativeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  nativeLocationIcon: {
    fontSize: 11,
  },
  nativeLocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  nativeHeaderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
      },
      default: {
        elevation: 3,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  nativeHeaderActionIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  nativeHeaderActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});