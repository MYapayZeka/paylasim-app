import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ItemEntity } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface RentBookingModalProps {
  visible: boolean;
  onClose: () => void;
  item: ItemEntity | null;
  onSuccess?: () => void;
  navigation?: any;
}

export default function RentBookingModal({
  visible,
  onClose,
  item,
  onSuccess,
  navigation,
}: RentBookingModalProps) {
  const { user } = useAuth();
  const [unit, setUnit] = useState<'DAY' | 'HOUR'>('DAY');
  const [duration, setDuration] = useState('1');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setUnit('DAY');
      setDuration('1');
      setModalError(null);
      setModalSuccess(null);
      setBookingLoading(false);
    }
  }, [visible, item]);

  if (!item) return null;

  const dailyPrice = Math.round(item.pricePerDay || 0);
  // Saatlik ücret hesabı: Günlük ücretin 1/8'i (tam sayı)
  const hourlyPrice = Math.max(1, Math.round(dailyPrice / 8));

  // Yalnızca pozitif tam sayı girişine izin veren ve 12 saat kuralını denetleyen handler
  const handleDurationChange = (text: string) => {
    if (modalError) setModalError(null);

    // Ondalık, eksi veya harfleri temizle - sadece rakamlar
    const sanitized = text.replace(/[^0-9]/g, '');

    // Başındaki gereksiz sıfırları temizle
    const cleanNumberStr = sanitized.replace(/^0+/, '');

    if (!cleanNumberStr) {
      setDuration('');
      return;
    }

    const val = parseInt(cleanNumberStr, 10);

    // Saat biriminde 12 saat üst sınır kontrolü
    if (unit === 'HOUR' && val > 12) {
      setModalError('12 saat üzeri kiralamalar için lütfen Gün birimini seçin.');
      setUnit('DAY');
      setDuration('1');
      return;
    }

    setDuration(cleanNumberStr);
  };

  const handleUnitToggle = (newUnit: 'DAY' | 'HOUR') => {
    setModalError(null);
    setUnit(newUnit);
    const currentVal = parseInt(duration, 10) || 1;
    if (newUnit === 'HOUR' && currentVal > 12) {
      setDuration('4');
    } else if (!duration) {
      setDuration('1');
    }
  };

  const count = parseInt(duration, 10) || 1;
  const totalPrice = unit === 'DAY' ? count * dailyPrice : count * hourlyPrice;

  const handleBookingSubmit = async () => {
    setModalError(null);

    if (item.ownerId === user?.id) {
      setModalError('Kendi ilanınıza kiralama talebi oluşturamazsınız.');
      return;
    }

    if (!duration || count < 1) {
      setModalError(`Lütfen geçerli bir ${unit === 'DAY' ? 'gün' : 'saat'} sayısı girin (en az 1).`);
      return;
    }

    if (unit === 'HOUR' && count > 12) {
      setModalError('12 saat üzeri kiralamalar için lütfen Gün birimini seçin.');
      setUnit('DAY');
      setDuration('1');
      return;
    }

    try {
      setBookingLoading(true);

      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + (unit === 'DAY' ? count * 24 : count) * 60 * 60 * 1000
      );

      await api.requestBooking({
        itemId: item.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      setModalSuccess('Kiralama talebiniz başarıyla iletildi! Talepler sayfasına yönlendiriliyorsunuz...');

      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
        if (navigation && navigation.navigate) {
          navigation.navigate('Talepler', { tab: 'outgoing' });
        }
      }, 1200);
    } catch (err: any) {
      const errorMsg = err.message || 'Talep gönderilemedi. Lütfen tekrar deneyin.';
      setModalError(errorMsg);
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <View style={styles.modalIconBox}>
              <Text style={styles.modalIconEmoji}>🤝</Text>
            </View>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.modalHeaderTitle}>Kiralama Talebi</Text>
              <Text style={styles.modalItemTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Hata Bildirimi */}
          {modalError && (
            <View style={styles.modalErrorBanner}>
              <Text style={styles.modalErrorIcon}>⚠️</Text>
              <Text style={styles.modalErrorText}>{modalError}</Text>
            </View>
          )}

          {/* Başarı Bildirimi */}
          {modalSuccess && (
            <View style={styles.modalSuccessBanner}>
              <Text style={styles.modalSuccessIcon}>✅</Text>
              <Text style={styles.modalSuccessText}>{modalSuccess}</Text>
            </View>
          )}

          {/* Süre Birimi Seçici (Gün / Saat Segmenti) */}
          <View style={styles.unitSelectorContainer}>
            <Text style={styles.fieldLabel}>Kiralama Süre Birimi:</Text>
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, unit === 'DAY' && styles.segmentBtnActive]}
                onPress={() => handleUnitToggle('DAY')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentBtnText, unit === 'DAY' && styles.segmentBtnTextActive]}>
                  📅 Günlük
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, unit === 'HOUR' && styles.segmentBtnActive]}
                onPress={() => handleUnitToggle('HOUR')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentBtnText, unit === 'HOUR' && styles.segmentBtnTextActive]}>
                  ⏱️ Saatlik (Maks 12s)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Birim Fiyat Bilgi Kartı */}
          <View style={styles.modalPriceCard}>
            <Text style={styles.modalPriceLabel}>
              {unit === 'DAY' ? 'Günlük Kiralama Bedeli:' : 'Saatlik Kiralama Bedeli:'}
            </Text>
            <Text style={styles.modalPriceVal}>
              {unit === 'DAY' ? `${dailyPrice} ₺ / gün` : `${hourlyPrice} ₺ / saat`}
            </Text>
          </View>

          {/* Süre Girişi (Sadece Pozitif Tam Sayı) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              {unit === 'DAY'
                ? 'Kaç gün kiralamak istiyorsunuz? (Tam sayı)'
                : 'Kaç saat kiralamak istiyorsunuz? (Maksimum 12 saat)'}
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              value={duration}
              onChangeText={handleDurationChange}
              placeholder={unit === 'DAY' ? '1' : '4'}
              maxLength={unit === 'HOUR' ? 2 : 4}
            />
            {unit === 'HOUR' && (
              <Text style={styles.inputSubHint}>
                💡 Not: 12 saati aşan kiralamalar için lütfen Günlük birimi tercih ediniz.
              </Text>
            )}
          </View>

          {/* Tahmini Toplam Tutar (Tam Sayı) */}
          <View style={styles.totalBox}>
            <View>
              <Text style={styles.totalLabel}>Tahmini Toplam Tutar:</Text>
              <Text style={styles.totalSub}>
                {`${count} ${unit === 'DAY' ? 'gün' : 'saat'} × ${
                  unit === 'DAY' ? dailyPrice : hourlyPrice
                } ₺`}
              </Text>
            </View>
            <Text style={styles.totalAmount}>{`${totalPrice} ₺`}</Text>
          </View>

          {/* Güvence Bedeli (Depozito) Uyarısı */}
          {!!item.deposit && item.deposit > 0 && (
            <View style={styles.depositNoticeBox}>
              <Text style={styles.depositNoticeIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.depositNoticeTitle}>
                  Güvence Bedeli: {item.deposit} ₺
                </Text>
                <Text style={styles.depositNoticeSub}>
                  Teslimatta alınır, eşya hasarsız iade edildiğinde geri teslim edilir.
                </Text>
              </View>
            </View>
          )}

          {/* Aksiyon Butonları */}
          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Vazgeç</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (bookingLoading || !!modalSuccess) && styles.disabledButton,
              ]}
              onPress={handleBookingSubmit}
              disabled={bookingLoading || !!modalSuccess}
              activeOpacity={0.8}
            >
              {bookingLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Talebi Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
</Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 0,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconEmoji: {
    fontSize: 22,
  },
  headerTitleWrap: {
    flex: 1,
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
  modalCloseBtn: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  modalErrorIcon: {
    fontSize: 16,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  modalSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  modalSuccessIcon: {
    fontSize: 16,
  },
  modalSuccessText: {
    flex: 1,
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
  },
  unitSelectorContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
    cursor: 'pointer' as any,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.08)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentBtnTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  modalPriceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalPriceLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  modalPriceVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  inputSection: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  inputSubHint: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 4,
    fontWeight: '500',
  },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  totalSub: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  confirmButton: {
    flex: 1.4,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  disabledButton: {
    opacity: 0.6,
  },
  depositNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  depositNoticeIcon: {
    fontSize: 20,
  },
  depositNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  depositNoticeSub: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 2,
    lineHeight: 15,
  },
});
