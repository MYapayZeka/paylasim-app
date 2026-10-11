import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { api, ItemEntity, resolveImageUrl } from '../services/api';

const CATEGORIES = [
  { label: 'El Aletleri / Hırdavat', value: 'TOOLS', icon: '🔧' },
  { label: 'Kamp & Doğa', value: 'CAMPING', icon: '🏕️' },
  { label: 'Elektronik & Kamera', value: 'ELECTRONICS', icon: '📷' },
  { label: 'Ev & Bahçe', value: 'HOME_GARDEN', icon: '🏡' },
  { label: 'Spor Malzemeleri', value: 'SPORTS', icon: '⚽' },
  { label: 'Araç Gereç / Aksesuar', value: 'VEHICLE_ACCESSORIES', icon: '🚗' },
  { label: 'Diğer', value: 'OTHER', icon: '📦' },
];

interface EditItemModalProps {
  visible: boolean;
  item: ItemEntity | null;
  onClose: () => void;
  onSuccess: (updatedItem: ItemEntity) => void;
}

export default function EditItemModal({
  visible,
  item,
  onClose,
  onSuccess,
}: EditItemModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [category, setCategory] = useState('TOOLS');
  const [addressText, setAddressText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRented =
    !!item?.isRented ||
    (item?.transactions || []).some((tx) => tx.status === 'DELIVERED');

  useEffect(() => {
    if (item && visible) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setPricePerDay(String(item.pricePerDay || ''));
      setDeposit(String(item.deposit || '0'));
      setCategory(item.category || 'OTHER');
      setAddressText(item.addressText || '');
      setImages(Array.isArray(item.images) ? [...item.images] : []);
      setErrorMsg(null);
    }
  }, [item, visible]);

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10 - images.length,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        setErrorMsg(null);
        try {
          const newUrls: string[] = [];
          for (const asset of result.assets) {
            if (images.length + newUrls.length >= 10) break;
            const uploadedUrl = await api.uploadImage(asset.uri);
            if (uploadedUrl) {
              newUrls.push(
                typeof uploadedUrl === 'string'
                  ? uploadedUrl
                  : (uploadedUrl as any)?.data?.url || (uploadedUrl as any)?.url
              );
            }
          }
          setImages((prev) => [...prev, ...newUrls].slice(0, 10));
        } catch (uploadErr: any) {
          setErrorMsg(uploadErr?.message || 'Görseller yüklenirken hata oluştu.');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Fotoğraf seçilemedi.');
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera izni gereklidir.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        setErrorMsg(null);
        try {
          const uploadedUrl = await api.uploadImage(result.assets[0].uri);
          if (uploadedUrl) {
            const finalUrl =
              typeof uploadedUrl === 'string'
                ? uploadedUrl
                : (uploadedUrl as any)?.data?.url || (uploadedUrl as any)?.url;
            setImages((prev) => [...prev, finalUrl].slice(0, 10));
          }
        } catch (uploadErr: any) {
          setErrorMsg(uploadErr?.message || 'Görsel yüklenirken hata oluştu.');
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Kamera açılamadı.');
    }
  };

  const handlePickImages = () => {
    if (images.length >= 10) {
      Alert.alert('Sınır Aşıldı', 'Bir ilana en fazla 10 adet fotoğraf ekleyebilirsiniz.');
      return;
    }

    if (Platform.OS === 'web') {
      pickFromGallery();
      return;
    }

    Alert.alert(
      'Fotoğraf Ekle',
      'Eşyanın görselini nasıl yüklemek istersiniz?',
      [
        { text: '📸 Kamerayı Aç', onPress: takePhotoWithCamera },
        { text: '🖼️ Galeriden Çoklu Seç', onPress: pickFromGallery },
        { text: 'Vazgeç', style: 'cancel' },
      ]
    );
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    if (!item?.id) return;
    if (!title.trim()) {
      setErrorMsg('Lütfen ilan başlığını giriniz.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Lütfen açıklama giriniz.');
      return;
    }
    if (!isRented && (!pricePerDay || isNaN(Number(pricePerDay)) || Number(pricePerDay) <= 0)) {
      setErrorMsg('Lütfen geçerli bir günlük kiralama ücreti giriniz.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        category,
        addressText: addressText.trim() || item.addressText,
        images,
      };

      if (!isRented) {
        payload.pricePerDay = Number(pricePerDay);
        payload.deposit = Number(deposit || 0);
      }

      const res = await api.updateItem(item.id, payload);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'İlan güncellenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !item) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          {/* Başlık & Native Geri Butonu */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backBtnIcon}>‹</Text>
              <Text style={styles.backBtnText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>İlanı Düzenle</Text>
            <View style={{ width: 44 }} />
          </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          {/* Kirada Uyarısı */}
          {isRented && (
            <View style={styles.rentedNoticeBox}>
              <Text style={styles.rentedNoticeTitle}>🔒 Ürün Şu Anda Kiradadır</Text>
              <Text style={styles.rentedNoticeDesc}>
                Kiracıyı ve mevcut anlaşmayı korumak adına kiralama süresince günlük ücret ve depozito bedeli değiştirilemez.
              </Text>
            </View>
          )}

          {/* Çoklu Fotoğraf Galerisi */}
          <Text style={styles.sectionTitle}>
            Fotoğraflar ({images.length}/10)
          </Text>
          <Text style={styles.sectionSubtitle}>
            İlk sıradaki görsel vitrinde kapak fotoğrafı olarak kullanılır.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
            {images.map((imgUri, index) => (
              <View key={`img-${index}`} style={styles.imageCard}>
                <Image source={{ uri: resolveImageUrl(imgUri) }} style={styles.imageThumbnail} />
                {index === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>⭐ Kapak</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deletePhotoBtn}
                  onPress={() => handleRemoveImage(index)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deletePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {images.length < 10 && (
              <TouchableOpacity
                style={styles.addPhotoCard}
                onPress={handlePickImages}
                disabled={uploadingImage}
                activeOpacity={0.8}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <>
                    <Text style={styles.addPhotoIcon}>📷</Text>
                    <Text style={styles.addPhotoText}>+ Fotoğraf Ekle</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* İlan Başlığı */}
          <Text style={styles.inputLabel}>İlan Başlığı</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Örn: Bosch Darbeli Matkap 750W"
            placeholderTextColor="#94a3b8"
          />

          {/* Kategori Seçimi */}
          <Text style={styles.inputLabel}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catChip, category === cat.value && styles.catChipActive]}
                onPress={() => setCategory(cat.value)}
                activeOpacity={0.8}
              >
                <Text style={styles.catChipIcon}>{cat.icon}</Text>
                <Text style={[styles.catChipText, category === cat.value && styles.catChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Fiyat ve Depozito */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.inputLabel}>Günlük Ücret (₺)</Text>
              <TextInput
                style={[styles.input, isRented && styles.inputDisabled]}
                value={pricePerDay}
                onChangeText={setPricePerDay}
                keyboardType="numeric"
                editable={!isRented}
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.inputLabel}>Güvence / Depozito (₺)</Text>
              <TextInput
                style={[styles.input, isRented && styles.inputDisabled]}
                value={deposit}
                onChangeText={setDeposit}
                keyboardType="numeric"
                editable={!isRented}
                placeholder="0"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          {/* Açıklama */}
          <Text style={styles.inputLabel}>Açıklama</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholder="Eşyanın durumu, kutu içeriği ve kullanım talimatları..."
            placeholderTextColor="#94a3b8"
          />

          {/* Adres / Konum */}
          <Text style={styles.inputLabel}>Bölge / Semt Bilgisi</Text>
          <TextInput
            style={styles.input}
            value={addressText}
            onChangeText={setAddressText}
            placeholder="Örn: Moda, Kadıköy"
            placeholderTextColor="#94a3b8"
          />

          {/* Kaydet Butonu */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#e2e8f0',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    cursor: 'pointer' as any,
  },
  backBtnIcon: {
    fontSize: 26,
    color: '#2563eb',
    fontWeight: '800',
    marginRight: 2,
    marginTop: -2,
  },
  backBtnText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '600',
  },
  rentedNoticeBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  rentedNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b45309',
    marginBottom: 4,
  },
  rentedNoticeDesc: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  galleryScroll: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  imageCard: {
    width: 96,
    height: 96,
    borderRadius: 12,
    marginRight: 10,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
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
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  addPhotoIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 10,
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    color: '#94a3b8',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  catScroll: {
    marginBottom: 10,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  catChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  catChipTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
