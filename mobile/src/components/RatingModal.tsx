import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  transactionId: string;
  itemTitle: string;
  counterpartName: string;
  onSuccess?: () => void;
}

export default function RatingModal({
  visible,
  onClose,
  transactionId,
  itemTitle,
  counterpartName,
  onSuccess,
}: RatingModalProps) {
  const [itemRating, setItemRating] = useState(5);
  const [ownerRating, setOwnerRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorText(null);
      await api.submitReview(transactionId, {
        itemRating,
        ownerRating,
        comment: comment.trim(),
      });
      Alert.alert('Teşekkürler!', 'Değerlendirmeniz başarıyla kaydedildi.');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorText(err.message || 'Değerlendirme kaydedilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (currentRating: number, onSelect: (r: number) => void) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onSelect(star)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.starIcon, star <= currentRating && styles.starIconActive]}>
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', maxWidth: 480 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 0 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              {/* Başlık */}
              <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Kiralama Deneyimini Puanla</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {itemTitle} • {counterpartName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {errorText ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorText}</Text>
            </View>
          ) : null}

          {/* 1. Eşya Puanı */}
          <View style={styles.ratingSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>📦 Eşya Durumu ve Performansı</Text>
              <Text style={styles.ratingNumberBadge}>{itemRating} / 5</Text>
            </View>
            <Text style={styles.sectionDesc}>Eşya ilandaki gibi temiz ve çalışır durumda mıydı?</Text>
            {renderStars(itemRating, setItemRating)}
          </View>

          {/* 2. Komşu / Eşya Sahibi Puanı */}
          <View style={styles.ratingSection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>👤 {counterpartName} ile İletişim</Text>
              <Text style={styles.ratingNumberBadge}>{ownerRating} / 5</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Teslimat tokalaşması, dakiklik ve genel iletişim nasıldı?
            </Text>
            {renderStars(ownerRating, setOwnerRating)}
          </View>

          {/* 3. Opsiyonel Yorum */}
          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>💬 Yorumunuz (Opsiyonel)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Deneyiminizi diğer mahalle sakinleriyle paylaşın..."
              placeholderTextColor="#94a3b8"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              maxLength={400}
            />
          </View>

          {/* Butonlar */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Vazgeç</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Değerlendirmeyi Gönder ➔</Text>
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
    maxWidth: 500,
    padding: 24,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    maxWidth: 380,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  ratingSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  ratingNumberBadge: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  starIcon: {
    fontSize: 32,
    color: '#cbd5e1',
  },
  starIconActive: {
    color: '#f59e0b',
  },
  commentSection: {
    marginBottom: 18,
  },
  commentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
