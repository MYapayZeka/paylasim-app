import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ChatMessage, resolveImageUrl } from '../services/api';

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  transactionId: string;
  itemTitle: string;
  counterpartName: string;
  currentUserId: string;
  itemImage?: string | null;
  inline?: boolean;
}

export default function ChatModal({
  visible,
  onClose,
  transactionId,
  itemTitle,
  counterpartName,
  currentUserId,
  itemImage,
  inline = false,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!transactionId) return;
    try {
      const res = await api.getMessages(transactionId);
      setMessages(res.data || []);
      // Karşı tarafın mesajlarını okundu olarak işaretle
      api.markMessagesAsRead(transactionId).catch(() => {});
    } catch (e: any) {
      console.log('[ChatModal] Mesajlar çekilemedi:', e.message);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchMessages();

    // 2.5 saniyede bir yeni mesaj ve okundu durumu kontrolü
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [visible, fetchMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await api.sendMessage(transactionId, textToSend);
      if (res.data) {
        setMessages((prev) => [...prev, res.data]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (e: any) {
      console.log('[ChatModal] Mesaj gönderilemedi:', e.message);
    } finally {
      setSending(false);
    }
  };

  // WhatsApp tipi durum tikleri (Tek gri: Gönderildi, Çift gri: İletildi, Çift mavi: Okundu)
  const renderStatusTicks = (status?: 'SENT' | 'DELIVERED' | 'READ') => {
    if (status === 'READ') {
      return <Text style={styles.tickBlue}>✓✓</Text>;
    }
    if (status === 'DELIVERED') {
      return <Text style={styles.tickDelivered}>✓✓</Text>;
    }
    return <Text style={styles.tickSent}>✓</Text>;
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item?.senderId === currentUserId;
    const senderName = item?.sender?.fullName || counterpartName || 'Kullanıcı';
    let timeText = '';
    try {
      const d = new Date(item?.createdAt);
      if (!isNaN(d.getTime())) {
        timeText = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      timeText = '';
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe ? <Text style={styles.senderName}>{senderName}</Text> : null}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
            {item?.content || ''}
          </Text>
          <View style={styles.timeAndStatusRow}>
            {timeText ? (
              <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.otherTimestamp]}>
                {timeText}
              </Text>
            ) : null}
            {isMe ? renderStatusTicks(item.status) : null}
          </View>
        </View>
      </View>
    );
  };

  const thumbnailUri = itemImage ? resolveImageUrl(itemImage) : null;

  const chatBody = (
    <KeyboardAvoidingView
      style={[styles.container, inline && styles.inlineContainer]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      {/* SaaS Standartlarında Modern Sohbet Başlığı */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* İlan Küçük Resmi (Thumbnail) */}
          <View style={styles.thumbnailWrapper}>
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailFallback}>
                <Text style={styles.thumbnailEmoji}>📦</Text>
              </View>
            )}
          </View>

          {/* Satıcı ve Ürün Başlık Alanı */}
          <View style={styles.headerInfo}>
            <View style={styles.counterpartRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {counterpartName}
              </Text>
              <View style={styles.onlineDot} />
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {`📦 ${itemTitle}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeBtnText}>✕ Kapat</Text>
        </TouchableOpacity>
      </View>

      {/* Güvenlik Notu */}
      <View style={styles.safetyBanner}>
        <Text style={styles.safetyText}>
          🛡️ Güvenliğiniz için buluşma yeri ve teslimat detaylarını uygulama içi sohbetten teyit ediniz.
        </Text>
      </View>

      {/* Mesaj Listesi */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
              <Text style={styles.emptySub}>
                İlk mesajı göndererek teslimat yeri ve zamanını kararlaştırın.
              </Text>
            </View>
          }
        />
      )}

      {/* Alt Mesaj Giriş Alanı */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Bir mesaj yazın..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Gönder</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  if (inline) {
    return (
      <View style={styles.inlineWrapper}>
        {chatBody}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {chatBody}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inlineWrapper: {
    flex: 1,
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  inlineContainer: {
    flex: 1,
    height: '100%',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#e2e8f0',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
      },
    }),
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  thumbnailWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  thumbnailEmoji: {
    fontSize: 20,
  },
  headerInfo: {
    flex: 1,
  },
  counterpartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginLeft: 6,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  safetyBanner: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  safetyText: {
    fontSize: 11,
    color: '#1d4ed8',
    lineHeight: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 3,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#0f172a',
  },
  timeAndStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 10,
  },
  myTimestamp: {
    color: '#bfdbfe',
  },
  otherTimestamp: {
    color: '#94a3b8',
  },
  tickSent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#bfdbfe',
    marginLeft: 2,
  },
  tickDelivered: {
    fontSize: 11,
    fontWeight: '800',
    color: '#bfdbfe',
    marginLeft: 2,
  },
  tickBlue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8', // Canlı açık mavi WhatsApp tarzı
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
