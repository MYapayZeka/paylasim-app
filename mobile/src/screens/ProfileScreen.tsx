import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  Platform,
  useWindowDimensions,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { api, ItemEntity, resolveImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import WebContainer from '../components/WebContainer';
import * as ImagePicker from 'expo-image-picker';
import EditItemModal from '../components/EditItemModal';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myItems, setMyItems] = useState<ItemEntity[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItemEntity | null>(null);

  // Görünüm Modu ('profile' veya 'my_items')
  const [viewMode, setViewMode] = useState<'profile' | 'my_items'>('profile');
  const [itemsFilterTab, setItemsFilterTab] = useState<'ALL' | 'ACTIVE' | 'RENTED' | 'PASSIVE' | 'POPULAR'>('ALL');

  // Avatar Yükleme State'i
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // IBAN Düzenleme State'leri
  const [ibanModalVisible, setIbanModalVisible] = useState(false);
  const [ibanInput, setIbanInput] = useState('');
  const [savingIban, setSavingIban] = useState(false);

  const { user, signOut, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Profil Fotoğrafı Seçme & Yükleme
  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçebilmek için galeri erişim izni vermeniz gerekir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        setUploadingAvatar(true);
        const uploadedUrl = await api.uploadImage(pickedUri);
        await api.updateProfile({ avatarUrl: uploadedUrl });
        await updateUser({ avatarUrl: uploadedUrl });
        Alert.alert('Başarılı', 'Profil fotoğrafınız başarıyla güncellendi.');
      }
    } catch (err: any) {
      console.warn('[ProfileScreen] Avatar yükleme hatası:', err);
      Alert.alert('Hata', err.message || 'Profil fotoğrafı yüklenemedi.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleOpenIbanModal = () => {
    setIbanInput(user?.iban || '');
    setIbanModalVisible(true);
  };

  const handleSaveIban = async () => {
    const cleanIban = ibanInput.trim().toUpperCase();
    if (!cleanIban) {
      Alert.alert('Eksik Bilgi', 'Lütfen geçerli bir IBAN girin.');
      return;
    }

    try {
      setSavingIban(true);
      await api.updateProfile({ iban: cleanIban });
      await updateUser({ iban: cleanIban });
      setIbanModalVisible(false);
      Alert.alert('Başarılı', 'Banka IBAN bilginiz kaydedildi. Kiralama onaylarında bu IBAN kiracıya gösterilecektir.');
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'IBAN güncellenemedi.');
    } finally {
      setSavingIban(false);
    }
  };

  const loadMyItems = useCallback(async () => {
    try {
      const res = await api.getMyItems();
      setMyItems(res.data || []);
    } catch (e: any) {
      console.log('İlanlarım yüklenemedi:', e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMyItems();
  }, [loadMyItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMyItems();
  };

  const handleDeleteItem = (itemId: string, itemTitle: string) => {
    Alert.alert(
      'İlanı Sil',
      `"${itemTitle}" başlıklı ilanı silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(itemId);
              await api.deleteItem(itemId);
              setMyItems((prev) => prev.filter((item) => item.id !== itemId));
              Alert.alert('Başarılı', 'İlan başarıyla yayından kaldırıldı.');
            } catch (err: any) {
              Alert.alert('Hata', err.message || 'İlan silinemedi.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleBlockDemo = () => {
    Alert.alert(
      'Kullanıcı Engelle',
      'Rahatsızlık veren kullanıcıları profillerindeki "Engelle" butonuyla engelleyebilirsiniz. Engellenen kişilerin ilanları size gösterilmez.',
      [{ text: 'Tamam' }]
    );
  };

  const handleSafetyPolicy = () => {
    Alert.alert(
      'Topluluk & Güvenlik Politikası',
      'Paylaşım platformumuzda 150m bulanık konum koruması uygulanır. Hassas ev adresiniz asla yabancılarla paylaşılmaz. Güvenli elden teslim için ortak noktaları tercih ediniz.',
      [{ text: 'Anladım' }]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Oturumunuz kapatılacaktır. Emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Kalıcı Olarak Sil',
      'Tüm aktif ilanlarınız, kiralama geçmişiniz ve hesap bilgileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz. Onaylıyor musunuz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Hesabımı Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.deleteAccount();
              await signOut();
              Alert.alert('Hesap Silindi', 'Hesabınız ve tüm verileriniz başarıyla silindi.');
            } catch (err: any) {
              Alert.alert('Hata', err.message || 'Hesap silinemedi.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const isItemRented = (item: ItemEntity) => {
    return (item.transactions || []).some(
      (tx) => tx.status === 'DELIVERED' || tx.status === 'APPROVED'
    );
  };

  const getFilteredItems = () => {
    switch (itemsFilterTab) {
      case 'ACTIVE':
        return myItems.filter((i) => i.isActive && !isItemRented(i));
      case 'RENTED':
        return myItems.filter((i) => isItemRented(i));
      case 'PASSIVE':
        return myItems.filter((i) => !i.isActive);
      case 'POPULAR':
        return [...myItems].sort((a, b) => {
          const aCount = a._count?.transactions ?? a.transactions?.length ?? 0;
          const bCount = b._count?.transactions ?? b.transactions?.length ?? 0;
          return bCount - aCount;
        });
      case 'ALL':
      default:
        return myItems;
    }
  };

  return (
    <WebContainer
      scrollable
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      contentContainerStyle={styles.containerContent}
    >
      {viewMode === 'my_items' ? (
        /* ================= ÜRÜNLERİM YÖNETİM GÖRÜNÜMÜ ================= */
        <View style={styles.myItemsManageView}>
          {/* Üst Başlık ve Geri Dön Butonu */}
          <View style={styles.myItemsHeaderBar}>
            <TouchableOpacity
              style={styles.backToProfileBtn}
              onPress={() => setViewMode('profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.backToProfileBtnText}>← Profile Dön</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.myItemsViewTitle}>Ürünlerim ve İlan Yönetimi</Text>
              <Text style={styles.myItemsViewSubtitle}>
                İlanlarınızın güncel durumunu, teklifleri ve kiradaki ürünleri filtreleyin
              </Text>
            </View>
          </View>

          {/* 5 Filtre Sekmesi */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabsScroll}
          >
            {[
              { id: 'ALL', label: 'Tümü', count: myItems.length },
              {
                id: 'ACTIVE',
                label: 'Yayındakiler (Aktif)',
                count: myItems.filter((i) => i.isActive && !isItemRented(i)).length,
              },
              {
                id: 'RENTED',
                label: 'Kirada Olanlar',
                count: myItems.filter((i) => isItemRented(i)).length,
              },
              {
                id: 'PASSIVE',
                label: 'Süresi Dolanlar / Pasif',
                count: myItems.filter((i) => !i.isActive).length,
              },
              {
                id: 'POPULAR',
                label: 'Popüler / En Çok Teklif Alanlar',
                count: myItems.filter(
                  (i) => (i._count?.transactions ?? i.transactions?.length ?? 0) > 0
                ).length,
              },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.filterTabPill,
                  itemsFilterTab === tab.id && styles.filterTabPillActive,
                ]}
                onPress={() => setItemsFilterTab(tab.id as any)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterTabPillText,
                    itemsFilterTab === tab.id && styles.filterTabPillTextActive,
                  ]}
                >
                  {`${tab.label} (${tab.count})`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filtrelenmiş İlan Listesi */}
          {getFilteredItems().length === 0 ? (
            <View style={styles.emptyFilteredBox}>
              <Text style={styles.emptyFilteredEmoji}>📦</Text>
              <Text style={styles.emptyFilteredTitle}>Bu sekmede ilan bulunmuyor</Text>
              <Text style={styles.emptyFilteredSub}>
                Seçili filtre durumuna ({itemsFilterTab}) uyan herhangi bir ürününüz yok.
              </Text>
            </View>
          ) : (
            <View style={styles.filteredCardsList}>
              {getFilteredItems().map((item) => {
                const rented = isItemRented(item);
                const offerCount =
                  item._count?.transactions ?? item.transactions?.length ?? 0;
                return (
                  <View key={item.id} style={styles.manageCardRow}>
                    <Image
                      source={{ uri: resolveImageUrl(item.images[0]) }}
                      style={styles.manageThumbnail}
                    />

                    <View style={styles.manageBodyCol}>
                      <View style={styles.manageHeaderLine}>
                        <Text style={styles.manageItemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {rented ? (
                          <View style={styles.badgeRented}>
                            <Text style={styles.badgeRentedText}>📦 Kirada</Text>
                          </View>
                        ) : !item.isActive ? (
                          <View style={styles.badgePassive}>
                            <Text style={styles.badgePassiveText}>⏸️ Pasif</Text>
                          </View>
                        ) : (
                          <View style={styles.badgeActive}>
                            <Text style={styles.badgeActiveText}>🟢 Yayında</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.manageMetaLine}>
                        <Text style={styles.managePriceText}>{item.pricePerDay} ₺ / gün</Text>
                        <Text style={styles.manageMetaDot}>•</Text>
                        <Text style={styles.manageRatingText}>
                          ⭐ {(item.rating ?? 5.0).toFixed(1)}
                        </Text>
                        <Text style={styles.manageMetaDot}>•</Text>
                        <Text style={styles.manageOfferText}>
                          🔥 {offerCount} Teklif
                        </Text>
                      </View>

                      <Text style={styles.manageAddressText} numberOfLines={1}>
                        📍 {item.addressText}
                      </Text>
                    </View>

                    <View style={styles.manageActionsCol}>
                      <TouchableOpacity
                        style={styles.editItemBtn}
                        onPress={() => setEditingItem(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.editItemBtnText}>✏️ Düzenle</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteItemBtn}
                        onPress={() => handleDeleteItem(item.id, item.title)}
                        disabled={deletingId === item.id}
                        activeOpacity={0.8}
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator size="small" color="#dc2626" />
                        ) : (
                          <Text style={styles.deleteItemBtnText}>Sil</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        /* ================= ANA PROFİL GÖRÜNÜMÜ ================= */
        <>
          {/* 1. Profil Hero Kartı */}
          <View style={styles.heroCard}>
            <View style={[styles.heroTopRow, !isDesktop && styles.heroTopRowMobile]}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                  {user?.avatarUrl ? (
                    <Image
                      source={{ uri: resolveImageUrl(user.avatarUrl) }}
                      style={styles.avatarPhoto}
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(user?.fullName || 'K').slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                  {uploadingAvatar && (
                    <View style={styles.avatarLoadingLayer}>
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  )}
                </View>

                {/* Profil Fotoğrafı Yükleme / Değiştirme Butonu */}
                <TouchableOpacity
                  style={styles.avatarEditBtn}
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                  activeOpacity={0.8}
                >
                  <Text style={styles.avatarEditBtnIcon}>📷</Text>
                </TouchableOpacity>

                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓</Text>
                </View>
              </View>

              <View style={[styles.heroInfoCol, !isDesktop && styles.heroInfoColMobile]}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName}>{user?.fullName || 'Kullanıcı'}</Text>
                  <View style={styles.memberTag}>
                    <Text style={styles.memberTagText}>Mahalle Sakini</Text>
                  </View>
                </View>

                {/* Kullanıcı Değerlendirme Puanı */}
                <View style={styles.userRatingRow}>
                  <Text style={styles.userRatingStar}>⭐</Text>
                  <Text style={styles.userRatingText}>
                    {(user?.rating ?? 5.0).toFixed(1)} ({user?.ratingCount ?? 0} Değerlendirme)
                  </Text>
                </View>

                <Text style={styles.userEmail}>{user?.email || 'kullanici@example.com'}</Text>

                <View style={styles.contactRow}>
                  {user?.phoneNumber ? (
                    <View style={styles.phoneChip}>
                      <Text style={styles.phoneChipText}>📞 {user.phoneNumber}</Text>
                    </View>
                  ) : (
                    <View style={styles.phoneChipMissing}>
                      <Text style={styles.phoneChipMissingText}>📱 Telefon Eklenmedi</Text>
                    </View>
                  )}
                  <View style={styles.locationChip}>
                    <Text style={styles.locationChipText}>📍 Kadıköy / İstanbul</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 2. Modern 3 Ayrı Metrik Kartı */}
            <View style={[styles.metricsContainer, !isDesktop && styles.metricsContainerMobile]}>
              {/* Metrik 1: Güven Puanı */}
              <View style={[styles.metricCard, styles.metricCardGreen]}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricIcon}>🛡️</Text>
                  <Text style={[styles.metricBadge, styles.metricBadgeGreen]}>Kusursuz</Text>
                </View>
                <Text style={[styles.metricValue, styles.metricValueGreen]}>100 / 100</Text>
                <Text style={styles.metricTitle}>Güven Puanı</Text>
                <Text style={styles.metricSub}>Topluluk onaylı profil</Text>
              </View>

              {/* Metrik 2: Paylaşım Sayısı */}
              <View style={[styles.metricCard, styles.metricCardBlue]}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricIcon}>📦</Text>
                  <Text style={[styles.metricBadge, styles.metricBadgeBlue]}>Aktif</Text>
                </View>
                <Text style={[styles.metricValue, styles.metricValueBlue]}>{myItems.length}</Text>
                <Text style={styles.metricTitle}>Paylaşılan Eşya</Text>
                <Text style={styles.metricSub}>Yayındaki toplam ilan</Text>
              </View>

              {/* Metrik 3: Hesap Durumu */}
              <View style={[styles.metricCard, styles.metricCardPurple]}>
                <View style={styles.metricHeaderRow}>
                  <Text style={styles.metricIcon}>⚡</Text>
                  <Text style={[styles.metricBadge, styles.metricBadgePurple]}>Doğrulanmış</Text>
                </View>
                <Text style={[styles.metricValue, styles.metricValuePurple]}>Onaylı</Text>
                <Text style={styles.metricTitle}>Hesap Durumu</Text>
                <Text style={styles.metricSub}>Kiralama ve paylaşım aktif</Text>
              </View>
            </View>
          </View>

          {/* 3. Ödeme ve Banka Bilgisi (IBAN) Kartı */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>ÖDEME VE BANKA HESABI</Text>
          </View>
          <TouchableOpacity
            style={styles.ibanCard}
            onPress={handleOpenIbanModal}
            activeOpacity={0.85}
          >
            <View style={styles.ibanIconWrapper}>
              <Text style={styles.ibanIconEmoji}>🏦</Text>
            </View>
            <View style={styles.ibanContent}>
              <View style={styles.ibanTitleRow}>
                <Text style={styles.ibanTitle}>Banka IBAN Numaram</Text>
                {user?.iban ? (
                  <View style={styles.ibanStatusChipActive}>
                    <Text style={styles.ibanStatusChipActiveText}>Tanımlı</Text>
                  </View>
                ) : (
                  <View style={styles.ibanStatusChipWarning}>
                    <Text style={styles.ibanStatusChipWarningText}>Tanımlanmadı</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.ibanText, !user?.iban && styles.ibanTextWarning]}>
                {user?.iban
                  ? user.iban
                  : 'Ödemelerinizi FAST / Havale ile alabilmek için IBAN bilgisi ekleyin.'}
              </Text>
            </View>
            <View style={styles.arrowCircle}>
              <Text style={styles.arrowText}>›</Text>
            </View>
          </TouchableOpacity>

          {/* 4. "📦 Ürünlerim" Yönetim Kartı */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>ÜRÜNLERİM VE İLANLARIM</Text>
          </View>
          <TouchableOpacity
            style={styles.myItemsHubCard}
            onPress={() => setViewMode('my_items')}
            activeOpacity={0.85}
          >
            <View style={styles.myItemsHubIconBox}>
              <Text style={styles.myItemsHubEmoji}>📦</Text>
            </View>
            <View style={styles.myItemsHubContent}>
              <View style={styles.myItemsHubTitleRow}>
                <Text style={styles.myItemsHubTitle}>Ürünlerimi Yönet</Text>
                <View style={styles.myItemsHubCountBadge}>
                  <Text style={styles.myItemsHubCountBadgeText}>{myItems.length} İlan</Text>
                </View>
              </View>
              <Text style={styles.myItemsHubSub}>
                Yayındaki aktif ilanlarınızı, kirada olanları ve popüler teklifleri sekmelerle detaylı yönetin.
              </Text>
            </View>
            <View style={styles.myItemsHubArrowBtn}>
              <Text style={styles.myItemsHubArrowText}>Yönet ➔</Text>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* 5. Güvenlik, Gizlilik ve Destek Grubu */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>GÜVENLİK VE DESTEK</Text>
      </View>

      <View style={styles.settingsGroupCard}>
        <TouchableOpacity
          style={styles.settingsItem}
          onPress={handleBlockDemo}
          activeOpacity={0.7}
        >
          <View style={[styles.settingsIconWrapper, { backgroundColor: '#fee2e2' }]}>
            <Text style={styles.settingsIconText}>🚫</Text>
          </View>
          <View style={styles.settingsItemInfo}>
            <Text style={styles.settingsItemTitle}>Engellenen Kullanıcılar</Text>
            <Text style={styles.settingsItemSub}>İstenmeyen kullanıcıların ilanlarını filtreleyin</Text>
          </View>
          <Text style={styles.settingsArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.settingsDivider} />

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={handleSafetyPolicy}
          activeOpacity={0.7}
        >
          <View style={[styles.settingsIconWrapper, { backgroundColor: '#e0e7ff' }]}>
            <Text style={styles.settingsIconText}>🛡️</Text>
          </View>
          <View style={styles.settingsItemInfo}>
            <Text style={styles.settingsItemTitle}>Gizlilik ve Topluluk Güvenliği</Text>
            <Text style={styles.settingsItemSub}>150m konum gizleme ve elden teslim kuralları</Text>
          </View>
          <Text style={styles.settingsArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.settingsDivider} />

        <TouchableOpacity
          style={styles.settingsItem}
          onPress={() => Alert.alert('Yardım & Destek', 'Destek ekibimize iletisim@paylasimapp.com adresinden ulaşabilirsiniz.')}
          activeOpacity={0.7}
        >
          <View style={[styles.settingsIconWrapper, { backgroundColor: '#fef3c7' }]}>
            <Text style={styles.settingsIconText}>💬</Text>
          </View>
          <View style={styles.settingsItemInfo}>
            <Text style={styles.settingsItemTitle}>Yardım & Destek</Text>
            <Text style={styles.settingsItemSub}>Sıkça sorulan sorular ve müşteri destek kanalı</Text>
          </View>
          <Text style={styles.settingsArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 6. Oturum & Hesap Yönetimi */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>HESAP İŞLEMLERİ</Text>
      </View>

      <View style={styles.accountActionsContainer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>🚪 Güvenli Çıkış Yap</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, loading && styles.disabledButton]}
          onPress={handleDeleteAccount}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text style={styles.deleteButtonText}>Hesabımı ve Tüm Verilerimi Kalıcı Olarak Sil</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          PaylaşIM, KVKK ve GDPR veri koruma standartlarına tam uyumludur. Hesap silme işlemi tüm aktif kayıtlarınızı ve kiralama geçmişinizi sunuculardan geri döndürülemez şekilde siler.
        </Text>
      </View>

      {/* IBAN Düzenleme Modalı */}
      <Modal
        visible={ibanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIbanModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconBox}>
                <Text style={styles.modalIconEmoji}>🏦</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>Banka IBAN Numaranız</Text>
                <Text style={styles.modalHeaderSub}>Ödeme Alma Hesabı</Text>
              </View>
            </View>

            <Text style={styles.modalSub}>
              Kiracınız eşyayı teslim aldığında, kiralama tutarını FAST / Havale ile doğrudan bu IBAN adresine yatıracaktır.
            </Text>

            <TextInput
              style={styles.ibanInput}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              placeholderTextColor="#94a3b8"
              value={ibanInput}
              onChangeText={setIbanInput}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIbanModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, savingIban && styles.disabledButton]}
                onPress={handleSaveIban}
                disabled={savingIban}
              >
                {savingIban ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <EditItemModal
        visible={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={(updated) => {
          setMyItems((prev) =>
            prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
          );
        }}
      />
    </WebContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    paddingVertical: 12,
  },
  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.04)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  heroTopRowMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center' as any,
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#eff6ff',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
      },
    }),
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarLoadingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
  },
  avatarEditBtn: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ffffff',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    cursor: 'pointer' as any,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  avatarEditBtnIcon: {
    fontSize: 14,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#16a34a',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  verifiedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  userRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  userRatingStar: {
    fontSize: 13,
  },
  userRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  heroInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  heroInfoColMobile: {
    alignItems: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  memberTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  memberTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  phoneChip: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  phoneChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  phoneChipMissing: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  phoneChipMissingText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  locationChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },

  // 3 Ayrı Metrik Kartı
  metricsContainer: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
  },
  metricsContainerMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  metricCardGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#dcfce7',
  },
  metricCardBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#dbeafe',
  },
  metricCardPurple: {
    backgroundColor: '#faf5ff',
    borderColor: '#f3e8ff',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIcon: {
    fontSize: 20,
  },
  metricBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricBadgeGreen: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  metricBadgeBlue: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
  },
  metricBadgePurple: {
    backgroundColor: '#f3e8ff',
    color: '#7e22ce',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricValueGreen: { color: '#15803d' },
  metricValueBlue: { color: '#1d4ed8' },
  metricValuePurple: { color: '#7e22ce' },
  metricTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },

  // IBAN Kartı
  ibanCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    gap: 14,
    cursor: 'pointer' as any,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  ibanIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  ibanIconEmoji: {
    fontSize: 22,
  },
  ibanContent: {
    flex: 1,
  },
  ibanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ibanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  ibanStatusChipActive: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ibanStatusChipActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  ibanStatusChipWarning: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ibanStatusChipWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  ibanText: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 4,
  },
  ibanTextWarning: {
    color: '#64748b',
    fontWeight: '400',
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  arrowText: {
    fontSize: 18,
    color: '#94a3b8',
    marginTop: -2,
  },

  // İlanlarım Listesi
  itemsListContainer: {
    gap: 10,
    marginBottom: 24,
  },
  emptyItemsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyItemsEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyItemsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  emptyItemsSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 480,
  },
  itemRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)',
      },
    }),
  },
  itemThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  itemPriceSub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  itemDot: {
    marginHorizontal: 6,
    color: '#cbd5e1',
  },
  itemAddress: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  deleteItemBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    cursor: 'pointer' as any,
  },
  deleteItemBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },

  // Ayarlar Grubu
  settingsGroupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    cursor: 'pointer' as any,
  },
  settingsIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: {
    fontSize: 18,
  },
  settingsItemInfo: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  settingsItemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  settingsArrow: {
    fontSize: 20,
    color: '#cbd5e1',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 68,
  },

  // Hesap & Oturum Butonları
  accountActionsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  logoutButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  disabledButton: { opacity: 0.6 },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  privacyNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
    paddingHorizontal: 10,
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
    marginBottom: 12,
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
  modalHeaderSub: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 16,
  },
  ibanInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalSaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Ürünlerimi Yönet Hub Kartı
  myItemsHubCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    cursor: 'pointer' as any,
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
  myItemsHubIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  myItemsHubEmoji: {
    fontSize: 26,
  },
  myItemsHubContent: {
    flex: 1,
  },
  myItemsHubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  myItemsHubTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  myItemsHubCountBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  myItemsHubCountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  myItemsHubSub: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  myItemsHubArrowBtn: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  myItemsHubArrowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },

  // Ürünlerim Yönetim Sayfası / Görünümü
  myItemsManageView: {
    paddingVertical: 8,
  },
  myItemsHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  backToProfileBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    cursor: 'pointer' as any,
  },
  backToProfileBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  myItemsViewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  myItemsViewSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  filterTabsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 14,
  },
  filterTabPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    cursor: 'pointer' as any,
  },
  filterTabPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  filterTabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTabPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  emptyFilteredBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 40,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginTop: 10,
  },
  emptyFilteredEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyFilteredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyFilteredSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  filteredCardsList: {
    gap: 12,
    marginTop: 6,
  },
  manageCardRow: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  manageThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  manageBodyCol: {
    flex: 1,
  },
  manageHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  manageItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeActiveText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeRented: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeRentedText: {
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '700',
  },
  badgePassive: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePassiveText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  manageMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  managePriceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  manageMetaDot: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  manageRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  manageOfferText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  manageAddressText: {
    fontSize: 12,
    color: '#64748b',
  },
  manageActionsCol: {
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editItemBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    cursor: 'pointer' as any,
  },
  editItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
});