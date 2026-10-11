import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, HandoverData } from '../services/api';

interface HandoverModalProps {
  visible: boolean;
  onClose: () => void;
  transactionId: string;
  onSuccess?: () => void;
}

export default function HandoverModal({
  visible,
  onClose,
  transactionId,
  onSuccess,
}: HandoverModalProps) {
  const [data, setData] = useState<HandoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'IBAN' | 'CASH'>('IBAN');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [returning, setReturning] = useState(false);
  const [protocolAgreed, setProtocolAgreed] = useState(false);
  const [earlyReturning, setEarlyReturning] = useState(false);
  const [roleView, setRoleView] = useState<'AUTO' | 'BUYER' | 'SELLER'>('AUTO');
  const [returnPinInput, setReturnPinInput] = useState('');
  const [confirmingEarlyReturn, setConfirmingEarlyReturn] = useState(false);

  const fetchData = useCallback(async () => {
    if (!transactionId) return;
    try {
      const res = await api.getHandoverData(transactionId);
      setData(res.data);
      if (res.data?.paymentMethod === 'CASH') {
        setSelectedMethod('CASH');
      }
    } catch (e: any) {
      console.warn('[HandoverModal] Veri yüklenemedi:', e.message);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setFeedback(null);
    setInputPin('');
    setReturnPinInput('');
    setProtocolAgreed(false);
    setRoleView('AUTO');
    fetchData();

    // 2.5 saniyede bir verileri güncelle
    const interval = setInterval(fetchData, 2500);
    // Her saniye canlı geri sayımı güncelle
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [visible, fetchData]);

  const handleConfirmReturn = async () => {
    if (!transactionId || returning) return;
    try {
      setReturning(true);
      const res = await api.confirmReturn(transactionId);
      const notice = (res as any)?.message || '🎉 İade başarıyla onaylandı ve kiralama tamamlandı.';
      showFeedback('success', notice);
      await fetchData();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'İade onaylanırken hata oluştu.');
    } finally {
      setReturning(false);
    }
  };

  const handleConfirmEarlyReturn = async () => {
    if (!transactionId || confirmingEarlyReturn) return;
    const clean = returnPinInput.replace(/[#\s-]/g, '').trim();
    if (clean.length < 6) {
      showFeedback('error', 'Lütfen kiracının ekranındaki 6 haneli iade kodunu eksiksiz giriniz.');
      return;
    }
    try {
      setConfirmingEarlyReturn(true);
      const res = await api.confirmEarlyReturn(transactionId, clean);
      showFeedback('success', res?.message || '🎉 Erken iade PIN kodu doğrulandı ve kiralama tamamlandı.');
      setReturnPinInput('');
      await fetchData();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'İade kodu doğrulanamadı.');
    } finally {
      setConfirmingEarlyReturn(false);
    }
  };

  const handleRequestEarlyReturn = async () => {
    if (!transactionId || earlyReturning) return;
    try {
      setEarlyReturning(true);
      await api.requestEarlyReturn(transactionId);
      showFeedback('success', '⚡ Erken iade talebi iletildi. Eşyayı sahibine teslim ettiğinizde, sahip iadeyi onaylayacaktır.');
      await fetchData();
    } catch (err: any) {
      showFeedback('error', err?.message || 'Erken iade başlatılırken hata oluştu.');
    } finally {
      setEarlyReturning(false);
    }
  };

  const getCountdownInfo = () => {
    if (!data?.endDate) {
      return { label: 'Hesaplanıyor...', sub: '', isExpired: false };
    }
    const end = new Date(data.endDate).getTime();
    const diff = end - currentTime;

    if (diff <= 0) {
      return {
        label: 'Süre Doldu',
        sub: '00:00:00',
        isExpired: true,
      };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return {
        label: `${days} Gün ${hours} Saat ${minutes} Dk`,
        sub: `${String(seconds).padStart(2, '0')} sn`,
        isExpired: false,
      };
    }

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(seconds).padStart(2, '0')}`;
    return {
      label: formatted,
      sub: 'Kalan Süre (Saat:Dk:Sn)',
      isExpired: false,
    };
  };

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback(null);
    }, 5000);
  };

  // Satıcı Tarafı: Alıcının 6 Haneli PIN Kodunu Doğrulama
  const handleVerifyHandshake = async () => {
    if (!transactionId || confirming) return;
    const clean = inputPin.replace(/[#\s-]/g, '').trim();
    if (clean.length < 6) {
      showFeedback('error', 'Lütfen alıcının ekranındaki 6 haneli teslimat kodunu eksiksiz giriniz.');
      return;
    }

    try {
      setConfirming(true);
      await api.confirmHandshake(transactionId, clean, selectedMethod, true);
      showFeedback('success', '🎉 PIN kodu doğrulandı! Teslimat tamamlandı ve kiralama süresi başladı.');
      await fetchData();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Teslimat kodu doğrulanamadı.');
    } finally {
      setConfirming(false);
    }
  };

  if (!visible) return null;

  const isDelivered = data?.status === 'DELIVERED';
  const isActualOwner = !!data?.isOwner;
  const isOwner = roleView === 'SELLER' ? true : roleView === 'BUYER' ? false : isActualOwner;
  const rawPin = data?.deliveryPin || '965156';
  const formattedPin = `#${rawPin.slice(0, 3)}-${rawPin.slice(3)}`;
  const countdownInfo = getCountdownInfo();
  const hasDeposit = !!data?.deposit && data.deposit > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Güvenli Teslimat & PIN Doğrulama</Text>
              <Text style={styles.headerSub}>6 Haneli Sayısal Kod ile Temassız Doğrulama</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕ Kapat</Text>
            </TouchableOpacity>
          </View>

          {loading || !data ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Teslimat detayları hazırlanıyor...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.container}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
            {/* Bildirim Kartı */}
            {feedback ? (
              <View
                style={[
                  styles.noticeBox,
                  feedback.type === 'error' ? styles.noticeError : styles.noticeSuccess,
                ]}
              >
                <Text style={styles.noticeIcon}>{feedback.type === 'error' ? '⚠️' : '✅'}</Text>
                <Text style={styles.noticeText}>{feedback.text}</Text>
              </View>
            ) : null}

            {/* Eşya & Tutar Özeti */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.itemTitle}>{data.itemTitle || 'Eşya Kiralama'}</Text>
                <Text style={styles.partiesText}>
                  {`👤 Kiracı: ${data.borrowerName}  •  🏠 Sahip: ${data.ownerName}`}
                </Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Toplam Kira</Text>
                <Text style={styles.priceValue}>{`${data.totalPrice ?? 0} ₺`}</Text>
              </View>
            </View>

            {/* Güvence Bedeli (Depozito) Bilgilendirmesi */}
            {hasDeposit && (
              <View style={styles.depositAlertCard}>
                <Text style={styles.depositAlertIcon}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.depositAlertTitle}>
                    Güvence Bedeli: {data.deposit} ₺
                  </Text>
                  <Text style={styles.depositAlertSub}>
                    Bu tutar teslimatta satıcı tarafından alınır, ürün hasarsız iade edildiğinde kiracıya eksiksiz teslim edilir.
                  </Text>
                </View>
              </View>
            )}

            {/* Test Kolaylığı İçin Rol Değiştirme Butonları */}
            <View style={styles.roleToggleRow}>
              <Text style={styles.roleToggleLabel}>Görünüm Seçimi (Test Kolaylığı):</Text>
              <View style={styles.roleToggleBtns}>
                <TouchableOpacity
                  style={[styles.roleMiniBtn, !isOwner && styles.roleMiniBtnActive]}
                  onPress={() => setRoleView('BUYER')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleMiniBtnText, !isOwner && styles.roleMiniBtnTextActive]}>
                    👤 Alıcı (Kiracı)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleMiniBtn, isOwner && styles.roleMiniBtnActive]}
                  onPress={() => setRoleView('SELLER')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleMiniBtnText, isOwner && styles.roleMiniBtnTextActive]}>
                    👑 Satıcı (İlan Sahibi)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* DURUM 1: İŞLEM TAMAMLANDI / İADE EDİLDİ */}
            {data.status === 'COMPLETED' ? (
              <View style={styles.completedCard}>
                <Text style={styles.completedEmoji}>🎉</Text>
                <Text style={styles.completedTitle}>Kiralama ve İade Tamamlandı!</Text>
                <Text style={styles.completedDesc}>
                  Eşya sahibine teslim edildi ve kiralama süreci başarıyla sonlandırıldı. PaylaşIM güvencesiyle tamamlanan işlem için teşekkür ederiz.
                </Text>

                {/* Depozito İade Hatırlatması */}
                {hasDeposit && (
                  <View style={styles.depositReturnNotice}>
                    <Text style={styles.depositReturnIcon}>🛡️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.depositReturnTitle}>Depozito Hatırlatması</Text>
                      <Text style={styles.depositReturnDesc}>
                        {isOwner
                          ? `Eşyayı teslim aldıysanız, alınan ${data.deposit} TL güvence bedelini (depozito) kiracıya teslim etmeyi unutmayınız.`
                          : `Teslim ettiğiniz ${data.deposit} TL güvence bedelini (depozito) eşya sahibinden teslim almayı unutmayınız.`}
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.completedCloseBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.completedCloseText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            ) : isDelivered ? (
              /* DURUM 2: AKTİF KİRALAMA TAKİP PANELİ (CANLI GERİ SAYIM & ERKEN İADE / İADE ONAYI) */
              <View style={styles.trackingCard}>
                <View style={styles.trackingBadgeRow}>
                  <Text
                    style={[
                      styles.trackingStatusBadge,
                      countdownInfo.isExpired ? styles.badgeExpired : styles.badgeActive,
                    ]}
                  >
                    {countdownInfo.isExpired
                      ? '⚠️ Süre Doldu / İade Bekleniyor'
                      : data.earlyReturnRequested
                      ? '⚡ Erken İade Sürecinde'
                      : '🟢 Aktif Kiralama Sürecinde'}
                  </Text>
                </View>

                {/* Büyük Canlı Geri Sayım Kartı */}
                <View
                  style={[
                    styles.countdownCard,
                    countdownInfo.isExpired && styles.countdownCardExpired,
                  ]}
                >
                  <Text style={styles.countdownHeaderLabel}>KALAN KİRALAMA SÜRESİ</Text>
                  <Text
                    style={[
                      styles.countdownMainText,
                      countdownInfo.isExpired && styles.countdownTextExpired,
                    ]}
                  >
                    {countdownInfo.label}
                  </Text>
                  {countdownInfo.sub ? (
                    <Text style={styles.countdownSubText}>{countdownInfo.sub}</Text>
                  ) : null}
                  <Text style={styles.countdownEndInfo}>
                    {`Bitiş Zamanı: ${
                      data.endDate
                        ? new Date(data.endDate).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'
                    }`}
                  </Text>
                </View>

                {/* Dijital Teslim Tutanağı Onay Zaman Damgası */}
                <View style={styles.protocolBadgeBox}>
                  <Text style={styles.protocolBadgeText}>
                    📋 Dijital Teslim Tutanağı Onaylandı
                  </Text>
                </View>

                {/* Erken İade Bildirim Kutusu (Talep Edildiyse) */}
                {data.earlyReturnRequested && (
                  <View style={styles.earlyNoticeBox}>
                    <Text style={styles.earlyNoticeIcon}>⚡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.earlyNoticeTitle}>Erken İade Talebi Başlatıldı</Text>
                      <Text style={styles.earlyNoticeDesc}>
                        Kiracı eşyayı erken iade etmek istediğini bildirdi. Kalan süre için ücret iadesi yapılmaksızın süreç sonlandırılacaktır.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Süre Doldu Uyarısı & Aksiyonu */}
                {countdownInfo.isExpired && !data.earlyReturnRequested ? (
                  <View style={styles.expiredNoticeBox}>
                    <Text style={styles.expiredNoticeEmoji}>⚠️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expiredNoticeTitle}>Kiralama Süresi Doldu</Text>
                      <Text style={styles.expiredNoticeDesc}>
                        {isOwner
                          ? 'Eşyayı alıcıdan teslim aldıysanız lütfen iadeyi onaylayınız.'
                          : 'Lütfen kiraladığınız eşyayı sahibine teslim ediniz.'}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* İade Onay & Erken İade Butonları */}
                {isOwner ? (
                  /* SATICI (EŞYA SAHİBİ) İADE ONAYI */
                  <View style={styles.returnActionWrap}>
                    {data.earlyReturnRequested ? (
                      <View style={styles.earlyReturnSellerCard}>
                        <Text style={styles.earlyReturnSellerTitle}>⚡ Kiracı Erken İade Başlattı</Text>
                        <Text style={styles.earlyReturnSellerSub}>
                          Eşyayı teslim aldığınızda kiracının ekranında görünen 6 haneli iade PIN kodunu giriniz:
                        </Text>
                        <View style={styles.pinInputContainer}>
                          <TextInput
                            style={styles.pinInputField}
                            value={returnPinInput}
                            onChangeText={setReturnPinInput}
                            placeholder="6 Haneli İade PIN"
                            placeholderTextColor="#94a3b8"
                            keyboardType="number-pad"
                            maxLength={6}
                          />
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.returnConfirmBtn,
                            (!returnPinInput.trim() || confirmingEarlyReturn) && styles.disabledBtn,
                          ]}
                          onPress={handleConfirmEarlyReturn}
                          disabled={!returnPinInput.trim() || confirmingEarlyReturn}
                          activeOpacity={0.8}
                        >
                          {confirmingEarlyReturn ? (
                            <ActivityIndicator
                              color="#ffffff"
                              size="small"
                              style={{ marginRight: 8 }}
                            />
                          ) : null}
                          <Text style={styles.returnConfirmBtnText}>
                            🤝 PIN Kodunu Doğrula ve İadeyi Tamamla
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.returnConfirmBtn, returning && styles.disabledBtn]}
                          onPress={handleConfirmReturn}
                          disabled={returning}
                          activeOpacity={0.8}
                        >
                          {returning ? (
                            <ActivityIndicator
                              color="#ffffff"
                              size="small"
                              style={{ marginRight: 8 }}
                            />
                          ) : null}
                          <Text style={styles.returnConfirmBtnText}>
                            {countdownInfo.isExpired
                              ? '✅ Eşyayı Teslim Aldım (İadeyi Onayla)'
                              : '🤝 Eşyayı Teslim Aldım (Kiralama Sonlandır)'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.returnHintText}>
                          İadeyi onayladığınızda sayaç durdurulur, ürün anında tekrar yayına girer ve taraflara puanlama açılır.
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  /* ALICI (KİRACI) ERKEN İADE AKSİYONU */
                  <View style={styles.borrowerActionWrap}>
                    {data.earlyReturnRequested ? (
                      <View style={styles.borrowerReturnPinBox}>
                        <Text style={styles.borrowerReturnPinBadge}>⚡ İADE DOĞRULAMA KODUNUZ</Text>
                        <Text style={styles.borrowerReturnPinNumber}>
                          {data.returnPin ? `#${data.returnPin.slice(0, 3)}-${data.returnPin.slice(3)}` : '6 Haneli Kod'}
                        </Text>
                        <Text style={styles.borrowerReturnPinHint}>
                          Eşyayı teslim ederken bu kodu satıcıya iletiniz. Satıcı kodu doğruladığında kiralama başarıyla tamamlanacaktır.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ width: '100%' }}>
                        <TouchableOpacity
                          style={[styles.earlyReturnBtn, earlyReturning && styles.disabledBtn]}
                          onPress={handleRequestEarlyReturn}
                          disabled={earlyReturning}
                          activeOpacity={0.8}
                        >
                          {earlyReturning ? (
                            <ActivityIndicator
                              color="#ffffff"
                              size="small"
                              style={{ marginRight: 8 }}
                            />
                          ) : null}
                          <Text style={styles.earlyReturnBtnText}>
                            ⚡ Erken İade Et (Kalan Süre İadesiz)
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.earlyReturnSub}>
                          İşiniz erken bittiyse eşyayı hemen iade edebilirsiniz. Kalan süre için para iadesi yapılmaz.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity style={styles.trackingCloseBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.trackingCloseBtnText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* DURUM 3: TESLİMAT DOĞRULAMA (PIN TOKALAŞMASI) */
              <>
                {/* 1. KİRACI (ALICI) EKRANI: PIN KODUNU GÖSTERİR */}
                {!isOwner ? (
                  <View style={styles.buyerCard}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.buyerRoleBadge}>🤝 ALICI (KİRACI) TESLİM ALMA EKRANI</Text>
                    </View>

                    <Text style={styles.instructionText}>
                      Eşyayı teslim alırken satıcıya aşağıdaki 6 haneli kodu gösteriniz veya söyleyiniz:
                    </Text>

                    {/* 6 Haneli Sayısal PIN Kodu */}
                    <View style={styles.pinDisplayCard}>
                      <Text style={styles.pinLabel}>TESLİMAT ALMA KODUNUZ</Text>
                      <Text style={styles.pinValue}>{formattedPin}</Text>
                      <Text style={styles.pinHint}>
                        Satıcı bu 6 haneli kodu kendi uygulamasından girdiğinde kiralama süreniz başlayacaktır.
                      </Text>
                    </View>

                    {/* Dijital Teslim Tutanağı Onay Kutusu (Zorunlu Checkbox) */}
                    <TouchableOpacity
                      style={[styles.protocolBox, protocolAgreed && styles.protocolBoxActive]}
                      onPress={() => setProtocolAgreed(!protocolAgreed)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, protocolAgreed && styles.checkboxActive]}>
                        <Text style={styles.checkboxTick}>{protocolAgreed ? '✓' : ''}</Text>
                      </View>
                      <Text style={styles.protocolText}>
                        Eşyayı çalışır ve sağlam durumda teslim aldığımı, kullanım süresince oluşabilecek hasarlardan sorumlu olduğumu onaylıyorum.
                      </Text>
                    </TouchableOpacity>

                    {/* Bekleme Rozeti */}
                    <View style={styles.waitingBadge}>
                      <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 8 }} />
                      <Text style={styles.waitingBadgeText}>
                        Satıcının bu kodu sisteme girmesi bekleniyor...
                      </Text>
                    </View>
                  </View>
                ) : (
                  /* 2. SATICI (İLAN SAHİBİ) EKRANI: PIN KODUNU GİRER VE ONAYLAR */
                  <View style={styles.sellerCard}>
                    <View style={styles.badgeRow}>
                      <Text style={styles.roleBadge}>👑 EŞYA SAHİBİ (TESLİM EDEN) EKRANI</Text>
                    </View>

                    <Text style={styles.instructionText}>
                      Eşyayı alıcıya fiziksel olarak verirken, alıcının ekranında yer alan 6 haneli teslimat kodunu giriniz:
                    </Text>

                    {/* PIN Giriş Kutusu */}
                    <View style={styles.pinInputContainer}>
                      <TextInput
                        style={styles.pinInputField}
                        placeholder="Örn: 965-156"
                        placeholderTextColor="#94a3b8"
                        value={inputPin}
                        onChangeText={setInputPin}
                        keyboardType="numeric"
                        maxLength={8}
                        textAlign="center"
                      />

                      <TouchableOpacity
                        style={[
                          styles.verifyPinButton,
                          (inputPin.replace(/\D/g, '').length < 6 || confirming) && styles.disabledBtn,
                        ]}
                        onPress={handleVerifyHandshake}
                        disabled={inputPin.replace(/\D/g, '').length < 6 || confirming}
                        activeOpacity={0.8}
                      >
                        {confirming ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <Text style={styles.verifyPinButtonText}>
                            Teslimatı Doğrula ve Süreci Başlat
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Test Kolaylığı Kodu */}
                    <View style={styles.testHintCard}>
                      <Text style={styles.testHintLabel}>
                        💡 Test Kolaylığı: Alıcının kodu: <Text style={{ fontWeight: '800' }}>{formattedPin}</Text>
                      </Text>
                      <TouchableOpacity
                        onPress={() => setInputPin(rawPin)}
                        style={styles.autoFillBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.autoFillBtnText}>Kodu Doldur</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Ödeme Yöntemi Tercihi */}
                <View style={styles.paymentSection}>
                  <Text style={styles.sectionHeader}>ÖDEME TÜRÜ TERCİHİ</Text>
                  <View style={styles.methodRow}>
                    <TouchableOpacity
                      style={[styles.methodCard, selectedMethod === 'IBAN' && styles.methodCardActive]}
                      onPress={() => setSelectedMethod('IBAN')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.methodIcon}>🏦</Text>
                      <Text style={[styles.methodTitle, selectedMethod === 'IBAN' && styles.methodTitleActive]}>
                        IBAN / FAST
                      </Text>
                      <Text style={styles.methodDesc}>Banka transferi</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.methodCard, selectedMethod === 'CASH' && styles.methodCardActive]}
                      onPress={() => setSelectedMethod('CASH')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.methodIcon}>💵</Text>
                      <Text style={[styles.methodTitle, selectedMethod === 'CASH' && styles.methodTitleActive]}>
                        Elden Nakit
                      </Text>
                      <Text style={styles.methodDesc}>Buluşmada nakit</Text>
                    </TouchableOpacity>
                  </View>

                  {/* IBAN Bilgisi */}
                  {selectedMethod === 'IBAN' ? (
                    <View style={styles.ibanCard}>
                      <Text style={styles.ibanLabel}>EŞYA SAHİBİNİN IBAN BİLGİSİ</Text>
                      <Text style={styles.ibanOwnerName}>{data.ownerName}</Text>
                      <Text style={styles.ibanValue} selectable>
                        {data.ownerIban || 'TR...'}
                      </Text>
                      <Text style={styles.ibanTip}>
                        💡 FAST / Havale ile ödemeyi bu IBAN adresine gönderebilirsiniz.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#e2e8f0',
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748b',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
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
    fontSize: 18,
    marginRight: 10,
  },
  noticeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  partiesText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 2,
  },
  sellerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  badgeRow: {
    marginBottom: 10,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  buyerRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  instructionText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14,
  },
  pinDisplayCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  pinValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 4,
    marginVertical: 6,
  },
  pinHint: {
    fontSize: 11,
    color: '#94a3b8',
  },
  qrCard: {
    alignItems: 'center',
    marginBottom: 14,
  },
  qrBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    width: '100%',
  },
  qrEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  qrCodeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  qrTokenText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 4,
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    borderRadius: 10,
  },
  waitingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  buyerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  pinInputContainer: {
    marginTop: 6,
  },
  pinInputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#0f172a',
    marginBottom: 12,
  },
  verifyPinButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  verifyPinButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  paymentSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  methodCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  methodCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  methodIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  methodTitleActive: {
    color: '#2563eb',
  },
  methodDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  ibanCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ibanLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
  },
  ibanOwnerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  ibanValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
    marginTop: 2,
    letterSpacing: 1,
  },
  ibanTip: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
  },
  completedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  completedEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#15803d',
    marginBottom: 6,
  },
  completedDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  completedCloseBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  completedCloseText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  trackingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  trackingBadgeRow: {
    marginBottom: 16,
  },
  trackingStatusBadge: {
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  badgeActive: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },
  badgeExpired: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
  },
  countdownCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  countdownCardExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  countdownHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3b82f6',
    letterSpacing: 1,
    marginBottom: 6,
  },
  countdownMainText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1d4ed8',
    letterSpacing: -0.5,
  },
  countdownTextExpired: {
    color: '#dc2626',
  },
  countdownSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 4,
  },
  countdownEndInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    fontWeight: '500',
  },
  expiredNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    width: '100%',
  },
  expiredNoticeEmoji: {
    fontSize: 20,
  },
  expiredNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b45309',
    marginBottom: 4,
  },
  expiredNoticeDesc: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 17,
  },
  returnActionWrap: {
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  returnConfirmBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    cursor: 'pointer' as any,
  },
  returnConfirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  returnHintText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  borrowerWaitWrap: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    width: '100%',
  },
  borrowerWaitText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    textAlign: 'center',
  },
  trackingCloseBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 11,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    cursor: 'pointer' as any,
  },
  trackingCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  depositAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  depositAlertIcon: {
    fontSize: 24,
  },
  depositAlertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  depositAlertSub: {
    fontSize: 12,
    color: '#3b82f6',
    marginTop: 2,
    lineHeight: 16,
  },
  roleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 16,
  },
  roleToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  roleToggleBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  roleMiniBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  roleMiniBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  roleMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  roleMiniBtnTextActive: {
    color: '#ffffff',
  },
  depositReturnNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    gap: 10,
  },
  depositReturnIcon: {
    fontSize: 22,
  },
  depositReturnTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#854d0e',
  },
  depositReturnDesc: {
    fontSize: 12,
    color: '#a16207',
    marginTop: 2,
    lineHeight: 16,
  },
  protocolBadgeBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 14,
  },
  protocolBadgeText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
  earlyNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    width: '100%',
  },
  earlyNoticeIcon: {
    fontSize: 20,
  },
  earlyNoticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e40af',
    marginBottom: 4,
  },
  earlyNoticeDesc: {
    fontSize: 12,
    color: '#2563eb',
    lineHeight: 17,
  },
  borrowerActionWrap: {
    width: '100%',
    marginBottom: 14,
    alignItems: 'center',
  },
  earlyReturnBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    cursor: 'pointer' as any,
  },
  earlyReturnBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  earlyReturnSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 15,
  },
  protocolBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    cursor: 'pointer' as any,
  },
  protocolBoxActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxTick: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  protocolText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
    lineHeight: 16,
    fontWeight: '600',
  },
  testHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  testHintLabel: {
    fontSize: 12,
    color: '#475569',
  },
  autoFillBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  autoFillBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
  },
  earlyReturnSellerCard: {
    width: '100%',
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  earlyReturnSellerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
    marginBottom: 4,
  },
  earlyReturnSellerSub: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 16,
    marginBottom: 12,
  },
  borrowerReturnPinBox: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  borrowerReturnPinBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  borrowerReturnPinNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1e40af',
    letterSpacing: 6,
    marginVertical: 4,
  },
  borrowerReturnPinHint: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
  },
});
