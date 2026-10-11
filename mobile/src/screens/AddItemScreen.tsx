import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { storage } from '../utils/storage';
import WebContainer from '../components/WebContainer';

const CATEGORIES = [
  { label: 'El Aletleri / Hırdavat', value: 'TOOLS', icon: '🔧' },
  { label: 'Kamp & Doğa', value: 'CAMPING', icon: '🏕️' },
  { label: 'Elektronik & Kamera', value: 'ELECTRONICS', icon: '📷' },
  { label: 'Ev & Bahçe', value: 'HOME_GARDEN', icon: '🏡' },
  { label: 'Spor Malzemeleri', value: 'SPORTS', icon: '⚽' },
  { label: 'Araç Gereç / Aksesuar', value: 'VEHICLE_ACCESSORIES', icon: '🚗' },
  { label: 'Diğer', value: 'OTHER', icon: '📦' },
];

export default function AddItemScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [category, setCategory] = useState('TOOLS');
  const [addressText, setAddressText] = useState('Kadıköy, İstanbul');
  const [coords, setCoords] = useState({ latitude: 40.9905, longitude: 29.0295 });
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoOptionModalVisible, setPhotoOptionModalVisible] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (geocode && geocode.length > 0) {
            const g = geocode[0];
            const area = [g.subregion || g.district, g.city || g.region].filter(Boolean).join(', ');
            if (area) setAddressText(area);
          }
        }
      } catch (e) {
        console.log('[AddItemScreen] Konum tespit hatası (varsayılan Kadıköy kullanılıyor):', e);
      }
    })();
  }, []);

  // Galeriden / Dosyadan Fotoğraf Seç (Maksimum 10)
  const pickImageFromGallery = async () => {
    if (images.length >= 10) {
      Alert.alert('Sınır Aşıldı', 'Bir ilana en fazla 10 adet fotoğraf ekleyebilirsiniz.');
      return;
    }
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'İzin Gerekli',
          'İlanınıza fotoğraf ekleyebilmek için galeri erişim izni vermeniz gerekmektedir.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10 - images.length,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUris = result.assets.map((a) => a.uri);
        setImages((prev) => [...prev, ...pickedUris].slice(0, 10));
        setErrorMessage(null);
      }
    } catch (err: any) {
      console.error('[AddItemScreen] Galeri seçme hatası:', err);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir sorun oluştu.');
    }
  };

  // Kamerayı Açarak Fotoğraf Çek
  const takePhotoWithCamera = async () => {
    if (images.length >= 10) {
      Alert.alert('Sınır Aşıldı', 'Bir ilana en fazla 10 adet fotoğraf ekleyebilirsiniz.');
      return;
    }
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'İzin Gerekli',
          'Fotoğraf çekebilmek için kamera izni vermeniz gerekmektedir.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages((prev) => [...prev, result.assets[0].uri].slice(0, 10));
        setErrorMessage(null);
      }
    } catch (err: any) {
      console.error('[AddItemScreen] Kamera hatası:', err);
      Alert.alert('Hata', 'Kamera açılırken bir sorun oluştu.');
    }
  };

  const handleImagePickOptions = () => {
    setPhotoOptionModalVisible(true);
  };

  const handleSubmit = async () => {
    console.log('==============================================');
    console.log('[AddItemScreen] "İlanı Hemen Yayınla" butonuna tıklandı!');
    console.log('Başlık:', title);
    console.log('Açıklama:', description);
    console.log('Fiyat:', pricePerDay);
    console.log('Kategori:', category);
    console.log('Adres:', addressText);
    console.log('Koordinatlar:', coords);
    console.log('Fotoğraf seçili mi?:', images.length > 0);
    console.log('==============================================');

    setErrorMessage(null);

    // 1. Doğrulamalar (Validation)
    if (!title.trim()) {
      const msg = 'Lütfen ilan için bir başlık girin.';
      setErrorMessage(msg);
      Alert.alert('Eksik Alan', msg);
      return;
    }

    if (title.trim().length < 3) {
      const msg = 'İlan başlığı en az 3 karakter olmalıdır.';
      setErrorMessage(msg);
      Alert.alert('Geçersiz Başlık', msg);
      return;
    }

    if (!description.trim()) {
      const msg = 'Lütfen eşyanın durumunu ve teslim kurallarını anlatan bir açıklama girin.';
      setErrorMessage(msg);
      Alert.alert('Eksik Alan', msg);
      return;
    }

    if (!pricePerDay.trim()) {
      const msg = 'Lütfen günlük kiralama bedelini girin.';
      setErrorMessage(msg);
      Alert.alert('Eksik Alan', msg);
      return;
    }

    const cleanPrice = pricePerDay.replace(',', '.').replace(/[^0-9.]/g, '');
    const priceNum = parseFloat(cleanPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      const msg = 'Lütfen geçerli bir günlük kira bedeli girin (Örn: 150).';
      setErrorMessage(msg);
      Alert.alert('Geçersiz Fiyat', msg);
      return;
    }

    // 2. Oturum Token Kontrolü
    const token = await storage.getItem('user_token');
    console.log('[AddItemScreen] Oturum token kontrolü:', token ? 'Token bulundu' : 'TOKEN BULUNAMADI!');
    if (!token) {
      const msg = 'İlan yayınlamak için oturum açmış olmanız gerekmektedir. Lütfen giriş yapın.';
      setErrorMessage(msg);
      Alert.alert('Oturum Gerekli', msg);
      return;
    }

    try {
      setLoading(true);

      // 3. Fotoğraf Yükleme (Varsa)
      let imagesToUpload: string[] = [];
      if (images.length > 0) {
        console.log(`[AddItemScreen] ${images.length} adet fotoğraf backend /upload servisine gönderiliyor...`);
        for (const imgUri of images) {
          try {
            if (imgUri.startsWith('http://') || imgUri.startsWith('https://')) {
              imagesToUpload.push(imgUri);
            } else {
              const uploadedPath = await api.uploadImage(imgUri);
              imagesToUpload.push(uploadedPath);
            }
          } catch (uploadErr: any) {
            console.error('[AddItemScreen] Fotoğraf yükleme hatası:', uploadErr);
          }
        }
      }

      if (imagesToUpload.length === 0) {
        console.log('[AddItemScreen] Özel fotoğraf seçilmedi, varsayılan görsel atanıyor.');
        imagesToUpload = ['https://picsum.photos/400/300'];
      }

      // 4. İlan Oluşturma API İsteği
      const cleanDeposit = deposit ? deposit.replace(',', '.').replace(/[^0-9.]/g, '') : '0';
      const depositNum = parseFloat(cleanDeposit) || 0;

      console.log('[AddItemScreen] /api/v1/items oluşturma isteği gönderiliyor...');
      const createdItem = await api.createItem({
        title: title.trim(),
        description: description.trim(),
        category,
        pricePerDay: priceNum,
        deposit: depositNum,
        latitude: coords.latitude || 40.9905,
        longitude: coords.longitude || 29.0295,
        addressText: addressText.trim() || 'Kadıköy, İstanbul',
        images: imagesToUpload,
      });

      console.log('[AddItemScreen] İlan başarıyla oluşturuldu! API Yanıtı:', createdItem);

      // Formu temizle
      setTitle('');
      setDescription('');
      setPricePerDay('');
      setDeposit('');
      setImages([]);
      setErrorMessage(null);

      Alert.alert('Tebrikler! 🎉', 'İlanınız başarıyla paylaşıldı ve mahallenizde yayına girdi.');

      // Doğrudan Keşfet sayfasına yönlendir
      if (navigation && navigation.navigate) {
        navigation.navigate('Keşfet');
      }
    } catch (error: any) {
      console.error('[AddItemScreen] İlan kaydetme genel hatası:', error);
      const errMsg = error.message || 'İlan kaydedilirken bir hata oluştu.';
      setErrorMessage(errMsg);
      Alert.alert('İlan Yayınlanamadı', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <WebContainer scrollable contentContainerStyle={styles.containerContent}>
        {/* Mobilde Native Geri Butonu & Üst Başlık */}
        <View style={styles.mobileTopBar}>
          <TouchableOpacity
            style={styles.mobileBackBtn}
            onPress={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else {
                navigation?.navigate?.('Keşfet');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.mobileBackIcon}>‹</Text>
            <Text style={styles.mobileBackText}>Geri</Text>
          </TouchableOpacity>
          <Text style={styles.mobileTopBarTitle}>Yeni İlan Oluştur</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.formCard}>
        {/* Başlık Alanı */}
        <View style={styles.formHeader}>
          <Text style={styles.headerTitle}>Yeni Eşya Paylaş</Text>
          <Text style={styles.headerSubtitle}>
            Kullanmadığın aletleri ve eşyaları komşularınla paylaş, hem mahalle kazansın hem sen ek gelir elde et.
          </Text>
        </View>

        {/* Hata Bildirimi Paneli */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerIcon}>⚠️</Text>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Fotoğraf Yükleme ve Çoklu Galeri Alanı */}
        <View style={styles.photoHeaderRow}>
          <Text style={styles.fieldLabel}>Eşya Fotoğrafları ({images.length}/10)</Text>
          <Text style={styles.photoSubHint}>İlk fotoğraf vitrinde kapak görseli olur</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
          {images.map((imgUri, index) => (
            <View key={`img-${index}`} style={styles.imageCard}>
              <Image source={{ uri: imgUri }} style={styles.previewImageCard} />
              {index === 0 && (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>⭐ Kapak</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.deletePhotoBtn}
                onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                activeOpacity={0.8}
              >
                <Text style={styles.deletePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {images.length < 10 && (
            <TouchableOpacity
              style={styles.addPhotoCard}
              onPress={handleImagePickOptions}
              activeOpacity={0.8}
            >
              <View style={styles.uploadIconCircle}>
                <Text style={styles.uploadIcon}>📷</Text>
              </View>
              <Text style={styles.addPhotoText}>+ Fotoğraf Ekle</Text>
              <Text style={styles.addPhotoLimit}>{10 - images.length} adet kaldı</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* İlan Başlığı */}
        <Text style={styles.fieldLabel}>İlan Başlığı *</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: Bosch Darbeli Matkap 750W veya 4 Kişilik Kamp Çadırı"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (errorMessage) setErrorMessage(null);
          }}
        />

        {/* Kategori Seçimi */}
        <Text style={styles.fieldLabel}>Kategori *</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryOption, isSelected && styles.categoryOptionSelected]}
                onPress={() => {
                  setCategory(cat.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryOptionIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryOptionText,
                    isSelected && styles.categoryOptionTextSelected,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Açıklama */}
        <Text style={styles.fieldLabel}>Açıklama & Kullanım Koşulları *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Eşyanın durumu, kutu içeriği, temizlik ve elden teslim detayları..."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            if (errorMessage) setErrorMessage(null);
          }}
        />

        {/* Günlük Kira Bedeli */}
        <Text style={styles.fieldLabel}>Günlük Kiralama Bedeli (TL) *</Text>
        <View style={styles.priceInputWrapper}>
          <TextInput
            style={[styles.input, styles.priceInput]}
            placeholder="0"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={pricePerDay}
            onChangeText={(text) => {
              setPricePerDay(text);
              if (errorMessage) setErrorMessage(null);
            }}
          />
          <Text style={styles.currencyBadge}>₺ / gün</Text>
        </View>

        {/* Opsiyonel Güvence Bedeli (Depozito) */}
        <Text style={styles.fieldLabel}>Güvence Bedeli (Depozito) - Opsiyonel</Text>
        <View style={styles.priceInputWrapper}>
          <TextInput
            style={[styles.input, styles.priceInput]}
            placeholder="0 (Boş bırakılırsa depozitosuz kabul edilir)"
            placeholderTextColor="#94a3b8"
            keyboardType="numeric"
            value={deposit}
            onChangeText={(text) => {
              setDeposit(text);
              if (errorMessage) setErrorMessage(null);
            }}
          />
          <Text style={styles.currencyBadge}>₺</Text>
        </View>
        <Text style={styles.safetyHint}>
          🛡️ Güvence bedeli teslimat anında elden/FAST ile alınır, ürün sağlam teslim edildiğinde iade edilir.
        </Text>

        {/* Konum Bilgisi */}
        <Text style={styles.fieldLabel}>Teslimat Bölgesi</Text>
        <View style={styles.locationContainer}>
          <Text style={styles.locationIcon}>📍</Text>
          <TextInput
            style={styles.locationInput}
            value={addressText}
            onChangeText={setAddressText}
            placeholder="İlçe, İl"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <Text style={styles.safetyHint}>
          💡 Güvenliğiniz için tam ev adresiniz gösterilmez, yaklaşık ~150m mahalle bölgesi olarak ilan edilir.
        </Text>

        {/* Hata Bildirimi (Buton Üstü) */}
        {errorMessage && (
          <View style={[styles.errorBanner, { marginTop: 16, marginBottom: 0 }]}>
            <Text style={styles.errorBannerIcon}>⚠️</Text>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Gönder Butonu */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.loadingButtonText}>İlan Yayınlanıyor...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>İlanı Hemen Yayınla</Text>
          )}
        </TouchableOpacity>
      </View>
    </WebContainer>

    {/* Fotoğraf Seçim Modalı (Kamera / Galeri) */}
    <Modal
      visible={photoOptionModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setPhotoOptionModalVisible(false)}
    >
      <View style={styles.photoPickerOverlay}>
        <View style={styles.photoPickerCard}>
          <Text style={styles.photoPickerTitle}>Fotoğraf Ekle</Text>
          <Text style={styles.photoPickerSubtitle}>
            Eşyanızın net fotoğraflarını yükleyin ({images.length}/10)
          </Text>

          <TouchableOpacity
            style={styles.photoPickerOptionBtn}
            onPress={() => {
              setPhotoOptionModalVisible(false);
              takePhotoWithCamera();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.photoPickerOptionIcon}>📸</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoPickerOptionTitle}>Kamerayı Aç</Text>
              <Text style={styles.photoPickerOptionDesc}>Hemen yeni bir fotoğraf çek</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoPickerOptionBtn}
            onPress={() => {
              setPhotoOptionModalVisible(false);
              pickImageFromGallery();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.photoPickerOptionIcon}>🖼️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoPickerOptionTitle}>Galeriden Çoklu Seç</Text>
              <Text style={styles.photoPickerOptionDesc}>En fazla {10 - images.length} adet fotoğraf seçin</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoPickerCancelBtn}
            onPress={() => setPhotoOptionModalVisible(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.photoPickerCancelText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
  containerContent: {
    paddingVertical: 12,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    marginBottom: 40,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.04)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  formHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerIcon: {
    fontSize: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#b91c1c',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  photoSubHint: {
    fontSize: 12,
    color: '#64748b',
  },
  galleryScroll: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 4,
  },
  imageCard: {
    width: 100,
    height: 100,
    borderRadius: 14,
    marginRight: 10,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  previewImageCard: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coverBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletePhotoText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  addPhotoCard: {
    width: 100,
    height: 100,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginRight: 10,
  },
  uploadIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadIcon: {
    fontSize: 18,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  addPhotoLimit: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    cursor: 'pointer' as any,
  },
  categoryOptionSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  categoryOptionIcon: {
    fontSize: 14,
  },
  categoryOptionText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  categoryOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingRight: 80,
  },
  currencyBadge: {
    position: 'absolute',
    right: 14,
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  locationInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  safetyHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 16,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 26,
    cursor: 'pointer' as any,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
      },
    }),
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed' as any,
  },
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  mobileBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    cursor: 'pointer' as any,
  },
  mobileBackIcon: {
    fontSize: 24,
    color: '#2563eb',
    fontWeight: '800',
    marginRight: 2,
    marginTop: -2,
  },
  mobileBackText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '700',
  },
  mobileTopBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  photoPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  photoPickerCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  photoPickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  photoPickerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 18,
  },
  photoPickerOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 14,
    cursor: 'pointer' as any,
  },
  photoPickerOptionIcon: {
    fontSize: 26,
  },
  photoPickerOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  photoPickerOptionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  photoPickerCancelBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    cursor: 'pointer' as any,
  },
  photoPickerCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});