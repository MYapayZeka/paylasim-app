import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  Image,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, TransactionItem, resolveImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ChatModal from '../components/ChatModal';
import HandoverModal from '../components/HandoverModal';
import WebContainer from '../components/WebContainer';
import ErrorBoundary from '../components/ErrorBoundary';
import RatingModal from '../components/RatingModal';
import PublicProfileModal from '../components/PublicProfileModal';

export default function RequestsScreen({ route }: any) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'agreements'>('incoming');
  const [agreementSubFilter, setAgreementSubFilter] = useState<'lending' | 'borrowing'>('lending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [incomingList, setIncomingList] = useState<TransactionItem[]>([]);
  const [outgoingList, setOutgoingList] = useState<TransactionItem[]>([]);

  // Erken İade PIN Onay Modal State'leri (Satıcı Doğrulaması)
  const [earlyReturnVerifyTx, setEarlyReturnVerifyTx] = useState<TransactionItem | null>(null);
  const [returnPinInput, setReturnPinInput] = useState('');
  const [verifyingReturnPin, setVerifyingReturnPin] = useState(false);

  // Bildirim ve İptal Onay Modal State'leri
  const [confirmCancelTx, setConfirmCancelTx] = useState<TransactionItem | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sohbet, Değerlendirme ve Genel Profil State'leri
  const [activeChat, setActiveChat] = useState<{
    transactionId: string;
    itemTitle: string;
    counterpartName: string;
    itemImage?: string | null;
  } | null>(null);
  const [activeHandoverId, setActiveHandoverId] = useState<string | null>(null);
  const [reviewingTx, setReviewingTx] = useState<TransactionItem | null>(null);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);

  const { user } = useAuth();

  // Her saniye canlı geri sayımı güncelle
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dışarıdan veya parametre ile sekme yönlendirmesi geldiyse uygula
  useEffect(() => {
    if (route?.params?.tab === 'incoming' || route?.params?.tab === 'outgoing' || route?.params?.tab === 'agreements') {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);

  // Otomatik kapanan bildirim mesajı
  const showNotice = (type: 'success' | 'error', text: string) => {
    setActionNotice({ type, text });
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  const fetchTransactions = useCallback(async () => {
    try {
      setFetchError(null);
      const [incRes, outRes] = await Promise.all([
        api.getIncomingTransactions().catch((err) => {
          console.warn('[RequestsScreen] getIncomingTransactions uyarısı:', err?.message);
          return { data: [] };
        }),
        api.getOutgoingTransactions().catch((err) => {
          console.warn('[RequestsScreen] getOutgoingTransactions uyarısı:', err?.message);
          return { data: [] };
        }),
      ]);

      const inc = Array.isArray(incRes?.data)
        ? incRes.data
        : Array.isArray(incRes)
        ? (incRes as any)
        : [];
      const out = Array.isArray(outRes?.data)
        ? outRes.data
        : Array.isArray(outRes)
        ? (outRes as any)
        : [];

      setIncomingList(inc);
      setOutgoingList(out);
    } catch (err: any) {
      console.error('[RequestsScreen] fetchTransactions hata:', err);
      setFetchError(err?.message || 'Talepler yüklenirken bir problem oluştu.');
      setIncomingList([]);
      setOutgoingList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sayfa her odaklandığında güncel verileri çek
  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [fetchTransactions])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  // Talebi Onayla veya Reddet (Gelen Talepler - Optimistic UI)
  const handleStatusAction = async (id?: string, action?: 'approve' | 'reject') => {
    if (!id || !action) return;
    try {
      setLoadingActionId(id);
      // Optimistic state update
      setIncomingList((prev) =>
        prev.map((tx) =>
          tx.id === id
            ? { ...tx, status: action === 'approve' ? 'APPROVED' : 'REJECTED' }
            : tx
        )
      );

      if (action === 'approve') {
        await api.approveTransaction(id);
        showNotice('success', 'Talep başarıyla onaylandı! Şimdi teslimat ve sohbet sürecini başlatabilirsiniz.');
      } else {
        await api.rejectTransaction(id);
        showNotice('success', 'Kiralama talebi reddedildi.');
      }
      fetchTransactions();
    } catch (err: any) {
      console.error('[RequestsScreen] handleStatusAction hatası:', err);
      showNotice('error', err?.message || 'İşlem gerçekleştirilemedi.');
      fetchTransactions();
    } finally {
      setLoadingActionId(null);
    }
  };

  // Talebi İptal Etme İşlemini Gerçekleştir (Giden Talepler - Optimistic UI)
  const executeCancel = async () => {
    if (!confirmCancelTx?.id) return;
    const targetId = confirmCancelTx.id;
    try {
      setLoadingActionId(targetId);
      setOutgoingList((prev) =>
        prev.map((tx) => (tx.id === targetId ? { ...tx, status: 'CANCELLED' } : tx))
      );
      setConfirmCancelTx(null);
      await api.cancelTransaction(targetId);
      showNotice('success', 'Kiralama talebiniz başarıyla iptal edildi.');
      fetchTransactions();
    } catch (err: any) {
      console.error('[RequestsScreen] executeCancel hatası:', err);
      showNotice('error', err?.message || 'Talep iptal edilemedi.');
      fetchTransactions();
    } finally {
      setLoadingActionId(null);
    }
  };

  // Kiracı: Erken İade Başlatma & PIN Alma
  const handleEarlyReturn = async (transactionId: string) => {
    try {
      setLoadingActionId(transactionId);
      const res = await api.requestEarlyReturn(transactionId);
      const pin = res?.data?.returnPin || res?.returnPin;
      showNotice(
        'success',
        `⚡ Erken iade başlatıldı! İade Doğrulama Kodunuz: ${pin || ''}. Eşyayı teslim ederken bu kodu satıcıya iletin.`
      );
      fetchTransactions();
    } catch (err: any) {
      showNotice('error', err?.message || 'Erken iade başlatılamadı.');
    } finally {
      setLoadingActionId(null);
    }
  };

  // Satıcı: Kiracının Erken İade PIN Kodunu Doğrulama & İadeyi Tamamlama
  const handleConfirmEarlyReturnSubmit = async () => {
    if (!earlyReturnVerifyTx?.id || !returnPinInput.trim()) {
      showNotice('error', 'Lütfen 6 haneli iade PIN kodunu giriniz.');
      return;
    }
    try {
      setVerifyingReturnPin(true);
      const res = await api.confirmEarlyReturn(earlyReturnVerifyTx.id, returnPinInput.trim());
      showNotice('success', res?.message || 'Erken iade başarıyla onaylandı ve ürün teslim alındı!');
      setEarlyReturnVerifyTx(null);
      setReturnPinInput('');
      fetchTransactions();
    } catch (err: any) {
      showNotice('error', err?.message || 'İade PIN kodu doğrulanamadı.');
    } finally {
      setVerifyingReturnPin(false);
    }
  };

  const getRentalCountdown = (endDateStr?: string | Date | null) => {
    if (!endDateStr) return { text: '-', isExpired: false };
    const diff = new Date(endDateStr).getTime() - currentTime;
    if (diff <= 0) {
      return { text: 'Süre Doldu (İade Bekleniyor)', isExpired: true };
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
      text: `${hours}S ${minutes}D ${seconds}s`,
      isExpired: false,
    };
  };

  // Güvenli Tarih Formatlayıcı
  const formatDate = (dateStr?: string | Date | null): string => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('tr-TR');
    } catch {
      return '-';
    }
  };

  // Güvenli Fiyat Formatlayıcı
  const formatPrice = (price?: number | null): string => {
    if (price === undefined || price === null || isNaN(Number(price))) return '0 ₺';
    return `${price} ₺`;
  };

  // Karşı Taraf Adı Belirleyici
  const getCounterpartName = (item?: TransactionItem | null, tab?: 'incoming' | 'outgoing' | 'agreements'): string => {
    if (!item) return '-';
    if (tab === 'incoming' || (tab === 'agreements' && agreementSubFilter === 'lending')) {
      return (
        item.borrower?.fullName ||
        item.renter?.fullName ||
        (item as any)?.borrowerName ||
        'Kiracı'
      );
    } else {
      return (
        item.item?.owner?.fullName ||
        item.owner?.fullName ||
        (item.item as any)?.owner?.fullName ||
        (item as any)?.ownerName ||
        'Eşya Sahibi'
      );
    }
  };

  const renderStatusBadge = (status?: TransactionItem['status'] | string | null) => {
    switch (status) {
      case 'APPROVED':
        return <Text key="badge-app" style={[styles.badge, styles.badgeApproved]}>✓ Onaylandı</Text>;
      case 'DELIVERED':
        return <Text key="badge-del" style={[styles.badge, styles.badgeDelivered]}>🤝 Teslim Edildi</Text>;
      case 'REJECTED':
        return <Text key="badge-rej" style={[styles.badge, styles.badgeRejected]}>✕ Reddedildi</Text>;
      case 'CANCELLED':
        return <Text key="badge-cnc" style={[styles.badge, styles.badgeCancelled]}>İptal Edildi</Text>;
      case 'COMPLETED':
        return <Text key="badge-cmp" style={[styles.badge, styles.badgeCompleted]}>Tamamlandı</Text>;
      case 'PENDING':
      default:
        return <Text key="badge-pen" style={[styles.badge, styles.badgePending]}>⏳ Onay Bekliyor</Text>;
    }
  };

  const renderItem = ({ item }: { item: TransactionItem }) => {
    if (!item || !item.id) return null;

    const isProcessing = loadingActionId === item.id;
    const itemTitle = item.item?.title || item.itemTitle || (item as any)?.title || 'Eşya Kiralama';
    const counterpartName = getCounterpartName(item, activeTab);
    const canInteract = item.status === 'APPROVED' || (item.status as string) === 'DELIVERED';
    const imageUri = item.item?.images?.[0] ? resolveImageUrl(item.item.images[0]) : null;
    const isAgreement = activeTab === 'agreements';
    const countdown = getRentalCountdown(item.endDate);
    const priceText =
      item.totalPrice !== undefined && item.totalPrice !== null
        ? `${item.totalPrice} ₺`
        : item.item?.pricePerDay
        ? `${item.item.pricePerDay} ₺/gün`
        : '-';

    return (
      <View style={styles.card} key={item.id}>
        <View style={styles.cardHeader}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.cardItemThumbnail} />
          ) : (
            <View style={styles.cardItemThumbnailFallback}>
              <Text style={{ fontSize: 20 }}>📦</Text>
            </View>
          )}

          <View style={styles.cardTitleCol}>
            <Text style={styles.cardTitle}>{itemTitle}</Text>
            {/* DOM removeChild hatasını engellemek için iç içe Text kullanılmaz */}
            <TouchableOpacity
              style={styles.counterpartRow}
              onPress={() => {
                const targetId =
                  activeTab === 'incoming' || (activeTab === 'agreements' && agreementSubFilter === 'lending')
                    ? (item.borrower?.id || item.renter?.id || item.borrowerId)
                    : (item.item?.owner?.id || item.owner?.id || item.item?.ownerId);
                if (targetId) setPublicProfileUserId(targetId);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.counterpartLabel}>
                {activeTab === 'incoming' || (activeTab === 'agreements' && agreementSubFilter === 'lending')
                  ? 'Kiracı:'
                  : 'Eşya Sahibi:'}
              </Text>
              <Text style={[styles.counterpartValue, styles.counterpartClickable]}>
                {` ${counterpartName}`}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badgeWrapper}>
            {renderStatusBadge(item.status)}
          </View>
        </View>

        {/* Canlı Kiralama Geri Sayımı (DELIVERED ise) */}
        {item.status === 'DELIVERED' ? (
          <View style={styles.agreementCountdownBanner}>
            <Text style={styles.agreementCountdownIcon}>⏱️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.agreementCountdownLabel}>KALAN KİRALAMA SÜRESİ</Text>
              <Text style={[styles.agreementCountdownTime, countdown.isExpired && styles.countdownExpiredText]}>
                {countdown.text}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.detailsBox}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Başlangıç</Text>
            <Text style={styles.detailValue}>{formatDate(item.startDate)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Bitiş</Text>
            <Text style={styles.detailValue}>{formatDate(item.endDate)}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Toplam Tutar</Text>
            <Text style={[styles.detailValue, styles.detailPrice]}>{priceText}</Text>
          </View>
        </View>

        {/* Depozito Bilgisi - Rogue "0" hatasını tamamen engelleyen güvenli boolean ternary */}
        {Boolean(
          (item.deposit && Number(item.deposit) > 0) ||
          (item.item?.deposit && Number(item.item.deposit) > 0)
        ) ? (
          <View style={styles.depositRowNotice}>
            <Text style={styles.depositRowNoticeText}>
              🛡️ Güvence Bedeli: {item.deposit || item.item?.deposit} ₺ (Teslimatta alınır, iadede teslim edilir)
            </Text>
          </View>
        ) : null}

        {/* Kiracı Tarafı: Erken İade PIN Kodu Gösterimi */}
        {item.status === 'DELIVERED' && item.earlyReturnRequested && (activeTab === 'outgoing' || (activeTab === 'agreements' && agreementSubFilter === 'borrowing')) ? (
          <View style={styles.returnPinDisplayBox}>
            <Text style={styles.returnPinDisplayTitle}>⚡ İADE DOĞRULAMA KODUNUZ</Text>
            <Text style={styles.returnPinDisplayCode}>{item.returnPin || '6 Haneli Kod'}</Text>
            <Text style={styles.returnPinDisplaySub}>Eşyayı teslim ederken bu kodu satıcıya iletiniz.</Text>
          </View>
        ) : null}

        {/* Satıcı Tarafı: Erken İade Bildirimi & PIN Doğrulama Aksiyonu */}
        {item.status === 'DELIVERED' && item.earlyReturnRequested && (activeTab === 'incoming' || (activeTab === 'agreements' && agreementSubFilter === 'lending')) ? (
          <View style={styles.earlyReturnSellerNoticeBox}>
            <Text style={styles.earlyReturnSellerNoticeTitle}>⚡ Kiracı Erken İade Başlattı</Text>
            <Text style={styles.earlyReturnSellerNoticeSub}>
              Eşyayı teslim aldığınızda kiracının ekranındaki 6 haneli iade kodunu giriniz.
            </Text>
            <TouchableOpacity
              style={styles.confirmEarlyReturnBtn}
              onPress={() => {
                setEarlyReturnVerifyTx(item);
                setReturnPinInput('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmEarlyReturnBtnText}>🤝 İadeyi Teslim Al & Kodu Doğrula (PIN)</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Kiracı Erken İade Butonu (Henüz talep edilmediyse) */}
        {item.status === 'DELIVERED' && !item.earlyReturnRequested && (activeTab === 'outgoing' || (activeTab === 'agreements' && agreementSubFilter === 'borrowing')) ? (
          <TouchableOpacity
            style={styles.earlyReturnActionBtn}
            onPress={() => handleEarlyReturn(item.id)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
            ) : null}
            <Text style={styles.earlyReturnActionText}>⚡ Erken İade Et (Kalan Süre İadesiz)</Text>
          </TouchableOpacity>
        ) : null}

        {/* Değerlendirme & Puanlama Alanı */}
        {(item.status === 'COMPLETED' || (item.status as string) === 'DELIVERED') ? (
          <View key={`review-sec-${item.id}`} style={styles.reviewSectionRow}>
            {item.review ? (
              <View style={styles.reviewedBadge}>
                <Text style={styles.reviewedBadgeText}>
                  {`⭐ Değerlendirildi (Eşya: ${item.review.itemRating}★, Komşu: ${item.review.ownerRating}★)`}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.rateButton}
                onPress={() => setReviewingTx(item)}
                activeOpacity={0.8}
              >
                <Text style={styles.rateButtonText}>⭐ Puan Ver & Değerlendir ➔</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Karşı Taraf İletişim & Teslimat Alanı */}
        {canInteract ? (
          <View key={`interact-${item.id}`} style={styles.interactionBox}>
            <View style={styles.interactionHeader}>
              <Text style={styles.interactionBadge}>Doğrudan İletişim & Teslimat</Text>
            </View>

            <View style={styles.interactionButtons}>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  setActiveChat({
                    transactionId: item.id,
                    itemTitle,
                    counterpartName,
                    itemImage: item.item?.images?.[0] || (item as any)?.images?.[0] || null,
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.chatButtonText}>💬 Uygulama İçi Sohbet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.handoverButton}
                onPress={() => setActiveHandoverId(item.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.handoverButtonText}>
                  {item.status === 'DELIVERED'
                    ? '🤝 Teslim Edildi (Detay)'
                    : activeTab === 'incoming'
                    ? '🤝 Teslim Et & PIN (Satıcı)'
                    : '🤝 Ürünü Teslim Al (Alıcı)'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Gelen Talepler - Onayla / Reddet Butonları */}
        {activeTab === 'incoming' && item.status === 'PENDING' ? (() => {
          const isItemCurrentlyRented =
            !!item.item?.isRented ||
            incomingList.some(
              (tx) => tx.itemId === item.itemId && tx.id !== item.id && tx.status === 'DELIVERED'
            );

          return (
            <View key={`act-inc-${item.id}`}>
              {isItemCurrentlyRented && (
                <View style={styles.conflictWarningBox}>
                  <Text style={styles.conflictWarningText}>
                    ⚠️ Bu ürün şu anda başka bir kullanıcıda kiradadır (RENTED). Mevcut kiralama tamamlanmadan bu talep onaylanamaz.
                  </Text>
                </View>
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.rejectButton, isProcessing && styles.disabledBtn]}
                  onPress={() => handleStatusAction(item.id, 'reject')}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonInner}>
                    {isProcessing ? (
                      <ActivityIndicator color="#dc2626" size="small" style={styles.btnSpinner} />
                    ) : null}
                    <Text style={styles.rejectButtonText}>
                      {isProcessing ? 'İşleniyor...' : 'Reddet'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.approveButton,
                    (isProcessing || isItemCurrentlyRented) && styles.disabledBtn,
                    isItemCurrentlyRented && styles.disabledApproveBtn,
                  ]}
                  onPress={() => !isItemCurrentlyRented && handleStatusAction(item.id, 'approve')}
                  disabled={isProcessing || isItemCurrentlyRented}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonInner}>
                    {isProcessing ? (
                      <ActivityIndicator color="#ffffff" size="small" style={styles.btnSpinner} />
                    ) : null}
                    <Text style={styles.approveButtonText}>
                      {isProcessing
                        ? 'Onaylanıyor...'
                        : isItemCurrentlyRented
                        ? '🔒 Ürün Kirada (Pasif)'
                        : 'Talebi Onayla'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })() : null}

        {/* Giden Talepler - İptal Et Butonu */}
        {activeTab === 'outgoing' && item.status === 'PENDING' ? (
          <View key={`act-out-${item.id}`} style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.cancelRequestButton, isProcessing && styles.disabledBtn]}
              onPress={() => setConfirmCancelTx(item)}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <View style={styles.buttonInner}>
                {isProcessing ? (
                  <ActivityIndicator color="#dc2626" size="small" style={styles.btnSpinner} />
                ) : null}
                <Text style={styles.cancelRequestButtonText}>
                  {isProcessing ? 'İptal Ediliyor...' : 'Talebi İptal Et'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const activeLending = incomingList.filter((tx) => tx.status === 'DELIVERED');
  const activeBorrowing = outgoingList.filter((tx) => tx.status === 'DELIVERED');
  const totalAgreements = activeLending.length + activeBorrowing.length;

  const currentData =
    activeTab === 'incoming'
      ? incomingList
      : activeTab === 'outgoing'
      ? outgoingList
      : agreementSubFilter === 'lending'
      ? activeLending
      : activeBorrowing;

  return (
    <ErrorBoundary fallbackTitle="Talepler Ekranı Yüklenemedi" onReset={fetchTransactions}>
      <WebContainer contentContainerStyle={styles.containerContent}>
        {/* SaaS Üst Başlık & Segmented Tab Kontrolü */}
        <View style={styles.headerCard}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerMainTitle}>Kiralama ve Paylaşım Talepleri</Text>
            <Text style={styles.headerSubTitle}>
              Gelen, giden ve aktif devam eden tüm kiralama süreçlerini buradan yönetebilirsiniz.
            </Text>
          </View>

          {/* Bildirim Kutusu (Toast Banner) */}
          {actionNotice ? (
            <View
              style={[
                styles.noticeBanner,
                actionNotice.type === 'error' ? styles.noticeError : styles.noticeSuccess,
              ]}
            >
              <Text style={styles.noticeIcon}>
                {actionNotice.type === 'error' ? '⚠️' : '✅'}
              </Text>
              <Text style={styles.noticeText}>{actionNotice.text}</Text>
              <TouchableOpacity
                onPress={() => setActionNotice(null)}
                style={styles.noticeCloseBtn}
              >
                <Text style={styles.noticeCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]}
              onPress={() => setActiveTab('incoming')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'incoming' && styles.tabButtonTextActive,
                ]}
              >
                {`Gelen (${incomingList.length})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'outgoing' && styles.tabButtonActive]}
              onPress={() => setActiveTab('outgoing')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'outgoing' && styles.tabButtonTextActive,
                ]}
              >
                {`Giden (${outgoingList.length})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'agreements' && styles.tabButtonActive]}
              onPress={() => setActiveTab('agreements')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'agreements' && styles.tabButtonTextActive,
                ]}
              >
                {`🤝 Aktif Kiralamalar (${totalAgreements})`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Aktif Kiralamalar Alt Filtresi */}
          {activeTab === 'agreements' && (
            <View style={styles.subFilterRow}>
              <TouchableOpacity
                style={[
                  styles.subFilterBtn,
                  agreementSubFilter === 'lending' && styles.subFilterBtnActive,
                ]}
                onPress={() => setAgreementSubFilter('lending')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.subFilterBtnText,
                    agreementSubFilter === 'lending' && styles.subFilterBtnTextActive,
                  ]}
                >
                  {`🤝 Kiraya Verdiklerim (${activeLending.length})`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subFilterBtn,
                  agreementSubFilter === 'borrowing' && styles.subFilterBtnActive,
                ]}
                onPress={() => setAgreementSubFilter('borrowing')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.subFilterBtnText,
                    agreementSubFilter === 'borrowing' && styles.subFilterBtnTextActive,
                  ]}
                >
                  {`📦 Kiraladıklarım (${activeBorrowing.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Talepler yükleniyor...</Text>
          </View>
        ) : fetchError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorTitle}>Talepler Yüklenemedi</Text>
            <Text style={styles.errorSub}>{fetchError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTransactions} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>Yeniden Dene</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={Array.isArray(currentData) ? currentData : []}
            keyExtractor={(item, index) => item?.id || `req-${index}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563eb']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📬</Text>
                <Text style={styles.emptyTitle}>Henüz herhangi bir talep yok</Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'incoming'
                    ? 'İlanlarınıza bir talep geldiğinde burada görünecektir.'
                    : 'Keşfet sekmesinden mahallenizdeki ilanlara kiralama isteği gönderebilirsiniz.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Web ve Mobil Uyumlu İptal Onay Modalı */}
        <Modal
          visible={!!confirmCancelTx}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmCancelTx(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalConfirmCard}>
              <View style={styles.modalIconBox}>
                <Text style={styles.modalIconEmoji}>🗑️</Text>
              </View>
              <Text style={styles.modalConfirmTitle}>Talebi İptal Et</Text>
              <Text style={styles.modalConfirmDesc}>
                {`"${confirmCancelTx?.item?.title || 'Eşya'}" için oluşturduğunuz kiralama talebini iptal etmek istiyor musunuz?`}
              </Text>
              <View style={styles.modalConfirmButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setConfirmCancelTx(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalApproveCancelBtn}
                  onPress={executeCancel}
                  disabled={loadingActionId === confirmCancelTx?.id}
                  activeOpacity={0.8}
                >
                  {loadingActionId === confirmCancelTx?.id ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.modalApproveCancelBtnText}>Evet, İptal Et</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Uygulama İçi Güvenli Sohbet Modalı */}
        {activeChat ? (
          <ChatModal
            visible={!!activeChat}
            onClose={() => setActiveChat(null)}
            transactionId={activeChat.transactionId}
            itemTitle={activeChat.itemTitle}
            counterpartName={activeChat.counterpartName}
            currentUserId={user?.id || ''}
            itemImage={activeChat.itemImage}
          />
        ) : null}

        {/* Teslimat & Ödeme Onay Modalı (QR & IBAN) */}
        {activeHandoverId ? (
          <HandoverModal
            visible={!!activeHandoverId}
            onClose={() => setActiveHandoverId(null)}
            transactionId={activeHandoverId}
            onSuccess={fetchTransactions}
          />
        ) : null}

        {/* İki Yönlü Değerlendirme & Puanlama Modalı */}
        {reviewingTx ? (
          <RatingModal
            visible={!!reviewingTx}
            onClose={() => setReviewingTx(null)}
            transactionId={reviewingTx.id}
            itemTitle={reviewingTx.item?.title || reviewingTx.itemTitle || 'Eşya'}
            counterpartName={getCounterpartName(reviewingTx, activeTab)}
            onSuccess={fetchTransactions}
          />
        ) : null}

        {/* Satıcı / Kullanıcı Genel Profil Modalı */}
        <PublicProfileModal
          visible={!!publicProfileUserId}
          userId={publicProfileUserId}
          onClose={() => setPublicProfileUserId(null)}
        />

        {/* Satıcı Erken İade PIN Doğrulama Modalı */}
        <Modal
          visible={!!earlyReturnVerifyTx}
          transparent
          animationType="fade"
          onRequestClose={() => setEarlyReturnVerifyTx(null)}
        >
          <View style={styles.pinModalOverlay}>
            <View style={styles.pinModalCard}>
              <View style={styles.pinModalHeader}>
                <Text style={styles.pinModalIcon}>🤝</Text>
                <Text style={styles.pinModalTitle}>Erken İadeyi Teslim Al</Text>
                <Text style={styles.pinModalSub}>
                  Kiracının ekranında gösterilen 6 haneli doğrulama PIN kodunu girerek eşyayı teslim aldığınızı onaylayın.
                </Text>
              </View>

              <TextInput
                style={styles.pinModalInput}
                placeholder="6 Haneli PIN Kodu"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={6}
                value={returnPinInput}
                onChangeText={setReturnPinInput}
                autoFocus
              />

              <View style={styles.pinModalActions}>
                <TouchableOpacity
                  style={styles.pinModalCancelBtn}
                  onPress={() => {
                    setEarlyReturnVerifyTx(null);
                    setReturnPinInput('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pinModalCancelText}>Vazgeç</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pinModalConfirmBtn,
                    (!returnPinInput.trim() || verifyingReturnPin) && styles.disabledBtn,
                  ]}
                  onPress={handleConfirmEarlyReturnSubmit}
                  disabled={!returnPinInput.trim() || verifyingReturnPin}
                  activeOpacity={0.8}
                >
                  {verifyingReturnPin ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.pinModalConfirmText}>Doğrula ve Bitir</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  headerTitleRow: {
    marginBottom: 16,
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
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  noticeSuccess: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  noticeError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  noticeIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  noticeCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
  noticeCloseText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
    cursor: 'pointer' as any,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.06)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  tabButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#0f172a',
    fontWeight: '700',
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
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 24,
  },
  errorEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 6,
  },
  errorSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 18,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  counterpartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  counterpartLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  counterpartValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  counterpartClickable: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  reviewSectionRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  reviewedBadge: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  reviewedBadgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  rateButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  rateButtonText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  badgeWrapper: {
    alignSelf: 'flex-start',
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    color: '#b45309',
  },
  badgeApproved: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  badgeDelivered: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
  },
  badgeRejected: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
  },
  badgeCancelled: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  badgeCompleted: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  detailsBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 14,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  detailPrice: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '800',
  },
  detailDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  interactionBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginTop: 6,
  },
  interactionHeader: {
    marginBottom: 10,
  },
  interactionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  interactionButtons: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  chatButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
    minWidth: 160,
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  handoverButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
    minWidth: 180,
  },
  handoverButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSpinner: {
    marginRight: 6,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  rejectButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 13,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  approveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelRequestButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  cancelRequestButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 13,
  },
  disabledBtn: {
    opacity: 0.6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalConfirmCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  modalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconEmoji: {
    fontSize: 26,
  },
  modalConfirmTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalConfirmDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalApproveCancelBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  modalApproveCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  depositRowNotice: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  depositRowNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  earlyReturnNoticePill: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  earlyReturnNoticePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  conflictWarningBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  conflictWarningText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '700',
    lineHeight: 16,
  },
  disabledApproveBtn: {
    backgroundColor: '#94a3b8',
    borderColor: '#94a3b8',
    opacity: 0.6,
  },
  // Item Thumbnail
  cardItemThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginRight: 12,
  },
  cardItemThumbnailFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  // Countdown Banner
  agreementCountdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  agreementCountdownIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  agreementCountdownLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  agreementCountdownTime: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
    marginTop: 2,
  },
  countdownExpiredText: {
    color: '#dc2626',
  },
  // Return PIN Box
  returnPinDisplayBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  returnPinDisplayTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  returnPinDisplayCode: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e40af',
    letterSpacing: 6,
    marginVertical: 4,
  },
  returnPinDisplaySub: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
  // Seller Early Return Notice
  earlyReturnSellerNoticeBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  earlyReturnSellerNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 4,
  },
  earlyReturnSellerNoticeSub: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 16,
    marginBottom: 10,
  },
  confirmEarlyReturnBtn: {
    backgroundColor: '#d97706',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  confirmEarlyReturnBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Renter Early Return Action
  earlyReturnActionBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 12,
    cursor: 'pointer' as any,
  },
  earlyReturnActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // SubFilter Row
  subFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  subFilterBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  subFilterBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  subFilterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  subFilterBtnTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  // PIN Verification Modal
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  pinModalHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  pinModalIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  pinModalSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  pinModalInput: {
    width: '100%',
    height: 52,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    marginBottom: 20,
  },
  pinModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  pinModalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  pinModalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  pinModalConfirmBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  pinModalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});