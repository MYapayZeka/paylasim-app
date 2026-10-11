import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { api, ItemEntity, resolveImageUrl } from '../services/api';
import WebContainer from '../components/WebContainer';
import RentBookingModal from '../components/RentBookingModal';

const CATEGORIES = [
  { label: 'Tümü', value: 'ALL' },
  { label: 'El Aletleri', value: 'TOOLS' },
  { label: 'Kamp & Doğa', value: 'CAMPING' },
  { label: 'Elektronik', value: 'ELECTRONICS' },
  { label: 'Ev & Bahçe', value: 'HOME_GARDEN' },
  { label: 'Spor', value: 'SPORTS' },
  { label: 'Diğer', value: 'OTHER' },
];

export default function SearchScreen({ navigation, route }: any) {
  const [searchQuery, setSearchQuery] = useState(route?.params?.query || '');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [items, setItems] = useState<ItemEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Kiralama Modalı State'i
  const [selectedItem, setSelectedItem] = useState<ItemEntity | null>(null);

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const numColumns = isDesktop ? 3 : 1;

  useEffect(() => {
    if (route?.params?.query !== undefined) {
      setSearchQuery(route.params.query);
    }
  }, [route?.params?.query]);

  // Her saniye canlı geri sayımı güncelle
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadAllItems();
  }, []);

  const loadAllItems = async () => {
    try {
      setLoading(true);
      const res = await api.searchItems(40.9905, 29.0295, 50000);
      setItems(res.data || []);
    } catch (err: any) {
      console.log('Arama verisi yüklenemedi:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRentalCountdown = (endDateStr?: string | Date | null) => {
    if (!endDateStr) return 'Kirada';
    const diff = new Date(endDateStr).getTime() - currentTime;
    if (diff <= 0) return 'Süre Doldu';

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}G ${hours}S`;
    return `${hours}S ${minutes}D`;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setMinPrice('');
    setMaxPrice('');
    setAvailableOnly(false);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    minPrice !== '' ||
    maxPrice !== '' ||
    availableOnly;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesText =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.addressText.toLowerCase().includes(q);

      const matchesCat =
        selectedCategory === 'ALL' || item.category === selectedCategory;

      const minP = minPrice ? parseFloat(minPrice) : null;
      const maxP = maxPrice ? parseFloat(maxPrice) : null;
      const matchesMinPrice = minP === null || item.pricePerDay >= minP;
      const matchesMaxPrice = maxP === null || item.pricePerDay <= maxP;

      const matchesAvailable = !availableOnly || !item.isRented;

      return (
        matchesText &&
        matchesCat &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesAvailable
      );
    });
  }, [items, searchQuery, selectedCategory, minPrice, maxPrice, availableOnly]);

  const handleOpenBookingModal = (item: ItemEntity) => {
    setSelectedItem(item);
  };

  const renderItemCard = ({ item }: { item: ItemEntity }) => (
    <View style={[styles.card, isDesktop && styles.desktopCard]}>
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
        <View style={styles.metaRow}>
          <Text style={styles.locationBadge} numberOfLines={1}>📍 {item.addressText}</Text>
        </View>

        {/* Depozito Rozeti */}
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

          {item.isRented ? (
            <View style={styles.rentedBadgePill}>
              <Text style={styles.rentedBadgeText}>
                🔒 Kirada • Kalan: {getRentalCountdown(item.rentalEndDate)}
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
    <WebContainer contentContainerStyle={styles.containerContent}>
      {/* SaaS Arama ve Akıllı Filtre Başlığı */}
      <View style={styles.searchHeaderCard}>
        <Text style={styles.searchHeaderTitle}>Akıllı Arama & Katalog Filtresi</Text>
        <Text style={styles.searchHeaderSub}>
          Komşularının paylaştığı el aletleri, kamp ekipmanları ve cihazlar arasında detaylı arama yap.
        </Text>

        {/* Arama Input Barı */}
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="İlan adı, marka, alet veya semt ara..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Kategori Çipleri */}
        <View style={styles.categoryScroll}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORIES}
            keyExtractor={(cat) => cat.value}
            contentContainerStyle={styles.categoryContent}
            renderItem={({ item: cat }) => {
              const isSelected = selectedCategory === cat.value;
              return (
                <TouchableOpacity
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* İkincil Filtreler: Fiyat Aralığı & Yalnızca Hemen Kiralanabilir */}
        <View style={styles.filterRow}>
          {/* Min & Max Fiyat Girişi */}
          <View style={styles.priceFilterGroup}>
            <Text style={styles.filterLabel}>Günlük Fiyat (TL):</Text>
            <View style={styles.priceInputsRow}>
              <TextInput
                style={styles.priceFilterInput}
                placeholder="Min ₺"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
              />
              <Text style={styles.priceDash}>-</Text>
              <TextInput
                style={styles.priceFilterInput}
                placeholder="Max ₺"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
            </View>
          </View>

          {/* Yalnızca Hemen Kiralanabilir Olanlar Filtresi */}
          <TouchableOpacity
            style={[styles.availableToggle, availableOnly && styles.availableToggleActive]}
            onPress={() => setAvailableOnly(!availableOnly)}
            activeOpacity={0.8}
          >
            <View style={[styles.toggleCheckbox, availableOnly && styles.toggleCheckboxActive]}>
              <Text style={styles.toggleCheckMark}>{availableOnly ? '✓' : ''}</Text>
            </View>
            <Text style={[styles.availableToggleText, availableOnly && styles.availableToggleTextActive]}>
              Yalnızca Hemen Kiralanabilir
            </Text>
          </TouchableOpacity>

          {/* Filtreleri Temizle Butonu */}
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters} style={styles.resetFiltersBtn} activeOpacity={0.7}>
              <Text style={styles.resetFiltersText}>✕ Sıfırla</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Arama Sonuç Listesi */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Sonuçlar taranıyor...</Text>
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={filteredItems}
          numColumns={numColumns}
          keyExtractor={(item) => item.id}
          renderItem={renderItemCard}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={isDesktop ? styles.columnWrapper : undefined}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>Aradığınız kriterde ilan bulunamadı</Text>
              <Text style={styles.emptySub}>
                Farklı bir arama terimi deneyebilir, fiyat aralığını genişletebilir veya filtreleri sıfırlayabilirsiniz.
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={resetFilters} style={styles.emptyResetBtn} activeOpacity={0.8}>
                  <Text style={styles.emptyResetBtnText}>Filtreleri Sıfırla</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Hızlı Kiralama Talebi Modalı */}
      <RentBookingModal
        visible={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem}
        navigation={navigation}
      />
    </WebContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    paddingVertical: 12,
  },
  searchHeaderCard: {
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
  searchHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  searchHeaderSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryScroll: {
    marginLeft: -4,
  },
  categoryContent: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    cursor: 'pointer' as any,
  },
  categoryChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
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
  centered: {
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
  columnWrapper: {
    gap: 16,
    justifyContent: 'flex-start',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  desktopCard: {
    flex: 1,
    maxWidth: '32%',
    marginBottom: 0,
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
  locationBadge: {
    fontSize: 12,
    color: '#64748b',
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
  emptySub: {
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  priceFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  priceInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceFilterInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: 65,
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  priceDash: {
    color: '#94a3b8',
    fontWeight: '700',
  },
  availableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 8,
    cursor: 'pointer' as any,
  },
  availableToggleActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  toggleCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  toggleCheckboxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  toggleCheckMark: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  availableToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  availableToggleTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  resetFiltersBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  resetFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  emptyResetBtn: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  emptyResetBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});