import { Platform } from 'react-native';
import { storage } from '../utils/storage';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const SERVER_HOST =
  configuredApiUrl ||
  (Platform.OS === 'web' ? 'http://localhost:5000' : 'http://10.63.180.220:5000');
export const BASE_URL = `${SERVER_HOST}/api/v1`;

export function resolveImageUrl(url?: string): string {
  if (!url) return 'https://picsum.photos/400/250';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${SERVER_HOST}${url}`;
  return `${SERVER_HOST}/${url}`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = await storage.getItem('user_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    console.log('Token okuma hatası:', e);
  }
  return headers;
}

export interface CreateItemPayload {
  title: string;
  description: string;
  category: string;
  pricePerDay: number;
  deposit?: number;
  latitude: number;
  longitude: number;
  addressText: string;
  images: string[];
}

export interface ItemEntity {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  pricePerDay: number;
  deposit?: number;
  fuzzyLatitude: number;
  fuzzyLongitude: number;
  addressText: string;
  images: string[];
  isActive: boolean;
  rating?: number;
  ratingCount?: number;
  distanceMeters?: number;
  isRented?: boolean;
  rentalEndDate?: string | null;
  activeTransactionId?: string | null;
  createdAt: string;
  owner?: {
    id: string;
    fullName: string;
    phoneNumber?: string;
    avatarUrl?: string | null;
    rating?: number;
    ratingCount?: number;
  };
  transactions?: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    borrower?: {
      id: string;
      fullName: string;
      avatarUrl?: string | null;
    };
  }[];
  _count?: {
    transactions: number;
  };
}

export interface CreateBookingPayload {
  itemId: string;
  startDate: string;
  endDate: string;
}

export interface ReviewEntity {
  id: string;
  transactionId: string;
  reviewerId: string;
  targetUserId: string;
  itemId: string;
  itemRating: number;
  ownerRating: number;
  comment?: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
}

export interface PublicProfileUser {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  rating: number;
  ratingCount: number;
  createdAt: string;
  items: ItemEntity[];
}

export interface TransactionItem {
  id: string;
  itemId: string;
  borrowerId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  deposit?: number;
  status: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  protocolAccepted?: boolean;
  protocolAcceptedAt?: string | null;
  earlyReturnRequested?: boolean;
  earlyReturnRequestedAt?: string | null;
  returnPin?: string;
  createdAt: string;
  item?: ItemEntity;
  itemTitle?: string;
  review?: ReviewEntity | null;
  borrower?: {
    id: string;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    avatarUrl?: string | null;
  };
  renter?: {
    id: string;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    avatarUrl?: string | null;
  };
  owner?: {
    id: string;
    fullName: string;
    email?: string;
    phoneNumber?: string;
    avatarUrl?: string | null;
  };
}

export interface ChatMessage {
  id: string;
  transactionId: string;
  senderId: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  readAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
}

export interface ConversationItem {
  transactionId: string;
  itemId: string;
  itemTitle: string;
  itemImage?: string | null;
  pricePerDay: number;
  totalPrice: number;
  status: string;
  counterpartName: string;
  counterpartId: string;
  counterpartAvatar?: string | null;
  isOwner: boolean;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    status: 'SENT' | 'DELIVERED' | 'READ';
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export interface HandoverData {
  transactionId: string;
  itemTitle: string;
  itemImage?: string | null;
  startDate?: string;
  endDate?: string;
  totalPrice: number;
  deposit?: number;
  qrToken?: string;
  deliveryPin?: string;
  status: string;
  ownerName: string;
  ownerIban: string;
  borrowerName: string;
  ownerConfirmed: boolean;
  borrowerConfirmed: boolean;
  protocolAccepted?: boolean;
  protocolAcceptedAt?: string | null;
  earlyReturnRequested?: boolean;
  earlyReturnRequestedAt?: string | null;
  returnPin?: string;
  paymentMethod: string | null;
  isOwner: boolean;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    iban?: string;
    avatarUrl?: string;
    rating?: number;
    ratingCount?: number;
    role?: string;
  };
}

export const api = {
  // Giriş Yap
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Giriş yapılamadı.');
    }
    return {
      token: data.token || data.data?.token,
      user: data.user || data.data?.user,
    };
  },

  // Kayıt Ol
  async register(fullName: string, email: string, password: string, phoneNumber?: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, phoneNumber }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Kayıt işlemi başarısız.');
    }
    return {
      token: data.token || data.data?.token,
      user: data.user || data.data?.user,
    };
  },

  // Yeni İlan Oluştur
  async createItem(payload: CreateItemPayload) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        realLatitude: payload.latitude,
        realLongitude: payload.longitude,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'İlan oluşturulamadı.');
    }
    return data;
  },

  // İlan Güncelle (Full Edit)
  async updateItem(id: string, payload: Partial<CreateItemPayload>): Promise<{ success: boolean; data: ItemEntity; message?: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        ...payload,
        ...(payload.latitude !== undefined ? { realLatitude: payload.latitude } : {}),
        ...(payload.longitude !== undefined ? { realLongitude: payload.longitude } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'İlan güncellenemedi.');
    }
    return data;
  },

  // Yakındaki İlanları Getir & Filtrele
  async searchItems(
    lat?: number,
    lng?: number,
    radiusMeters = 50000,
    category?: string,
    search?: string,
    minPrice?: number,
    maxPrice?: number,
    availableOnly?: boolean
  ): Promise<{ data: ItemEntity[] }> {
    let url = `${BASE_URL}/items/search?radiusMeters=${radiusMeters}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    if (category && category !== 'ALL') {
      url += `&category=${encodeURIComponent(category)}`;
    }
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    if (minPrice !== undefined && !isNaN(minPrice)) {
      url += `&minPrice=${minPrice}`;
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      url += `&maxPrice=${maxPrice}`;
    }
    if (availableOnly) {
      url += `&availableOnly=true`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'İlanlar getirilemedi.');
    }
    return data;
  },

  // Kullanıcının Kendi İlanları
  async getMyItems(): Promise<{ data: ItemEntity[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/items/my-items`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'İlanlarınız getirilemedi.');
    }
    return data;
  },

  // İlanı Sil
  async deleteItem(id: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'İlan silinemedi.');
    }
    return data;
  },

  // Rezervasyon / Kiralama Talebi Gönder
  async requestBooking(payload: CreateBookingPayload) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Rezervasyon talebi oluşturulamadı.');
    }
    return data;
  },

  // Gelen Talepleri Getir (İlan Sahibi İçin)
  async getIncomingTransactions(): Promise<{ data: TransactionItem[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/incoming`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Gelen talepler getirilemedi.');
    }
    return data;
  },

  // Giden Talepleri Getir (Kiracı İçin)
  async getOutgoingTransactions(): Promise<{ data: TransactionItem[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/outgoing`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Kiralama talepleriniz getirilemedi.');
    }
    return data;
  },

  // Talebi Onayla
  async approveTransaction(id: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${id}/approve`, {
      method: 'PATCH',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Talep onaylanırken hata oluştu.');
    }
    return data;
  },

  // Talebi Reddet
  async rejectTransaction(id: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${id}/reject`, {
      method: 'PATCH',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Talep reddedilirken hata oluştu.');
    }
    return data;
  },

  // Talebi İptal Et
  async cancelTransaction(id: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${id}/cancel`, {
      method: 'PATCH',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Talep iptal edilirken hata oluştu.');
    }
    return data;
  },

  // Kullanıcıyı Engelle
  async blockUser(targetUserId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/reports/block`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetUserId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Kullanıcı engellenemedi.');
    }
    return data;
  },

  // Fotoğraf Yükle
  async uploadImage(fileUri: string): Promise<string> {
    console.log('[api.uploadImage] Görsel yükleme başladı, URI:', fileUri ? fileUri.slice(0, 60) + '...' : 'yok');
    const headers = await getAuthHeaders();
    delete headers['Content-Type'];
    delete headers['content-type'];

    const formData = new FormData();
    const rawFilename = fileUri.split('/').pop() || 'photo.jpg';

    if (Platform.OS === 'web') {
      let blob: Blob;
      if (fileUri.startsWith('data:')) {
        const parts = fileUri.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const byteString = atob(parts[1]);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i++) {
          uint8Array[i] = byteString.charCodeAt(i);
        }
        blob = new Blob([uint8Array], { type: mime });
      } else {
        const response = await fetch(fileUri);
        blob = await response.blob();
      }

      const mimeSubtype = (blob.type || 'image/jpeg').split('/')[1] || 'jpg';
      const cleanExt = mimeSubtype.replace('+xml', '');
      const finalFilename = rawFilename.includes('.')
        ? rawFilename
        : `upload-${Date.now()}.${cleanExt}`;

      formData.append('image', blob, finalFilename);
      console.log('[api.uploadImage] Web Blob oluşturuldu:', { size: blob.size, type: blob.type, filename: finalFilename });
    } else {
      const match = /\.(\w+)$/.exec(rawFilename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      formData.append('image', {
        uri: fileUri,
        name: rawFilename,
        type,
      } as any);
    }

    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    console.log('[api.uploadImage] Sunucu yanıt kodu:', res.status, data);

    if (!res.ok) {
      throw new Error(data.message || `Fotoğraf yüklenemedi (HTTP ${res.status}).`);
    }
    return data.url;
  },

  // Profil Güncelle
  async updateProfile(data: {
    fullName?: string;
    phoneNumber?: string;
    iban?: string;
    avatarUrl?: string;
  }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.message || 'Profil güncellenemedi.');
    }
    return resData;
  },

  // Mesajları Getir
  async getMessages(transactionId: string): Promise<{ data: ChatMessage[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/chat/${transactionId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Mesajlar alınamadı.');
    }
    return data;
  },

  // Mesaj Gönder
  async sendMessage(transactionId: string, content: string): Promise<{ data: ChatMessage }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/chat/${transactionId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Mesaj gönderilemedi.');
    }
    return data;
  },

  // QR Teslimat & IBAN Bilgilerini Getir
  async getHandoverData(transactionId: string): Promise<{ data: HandoverData }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/handover-data`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Teslimat bilgileri alınamadı.');
    }
    return data;
  },

  // Tüm Konuşmaları Getir
  async getConversations(): Promise<{ data: ConversationItem[] }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/chat/conversations`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Konuşmalar alınamadı.');
    }
    return data;
  },

  // Toplam Okunmamış Mesaj Sayısını Getir (Navbar Rozeti)
  async getUnreadCount(): Promise<{ data: { unreadCount: number } }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BASE_URL}/chat/unread-count`, { headers });
      const data = await res.json();
      if (!res.ok) {
        return { data: { unreadCount: 0 } };
      }
      return {
        data: {
          unreadCount:
            data?.data?.unreadCount ?? data?.data?.count ?? data?.unreadCount ?? 0,
        },
      };
    } catch {
      return { data: { unreadCount: 0 } };
    }
  },

  // Mesajları Okundu Olarak İşaretle
  async markMessagesAsRead(transactionId: string): Promise<{ data: { updatedCount: number } }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/chat/${transactionId}/read`, {
      method: 'PATCH',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Mesajlar okundu olarak işaretlenemedi.');
    }
    return data;
  },

  // Konuşmayı Arşivle / Gizle (Kullanıcı Listesinden Kaldır)
  async archiveConversation(transactionId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/chat/conversations/${transactionId}/archive`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Konuşma arşivlenemedi.');
    }
    return data;
  },

  // Kiralama Süreci Tamamlama / İadeyi Onayla
  async confirmReturn(transactionId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/confirm-return`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'İade onaylanırken hata oluştu.');
    }
    return data;
  },

  // Güvenli Teslimat Tokalaşması (PIN Doğrulama & Teslim Tutanağı)
  async confirmHandshake(
    transactionId: string,
    pin: string,
    paymentMethod?: string,
    protocolAccepted = true
  ) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/confirm-handshake`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pin, paymentMethod, protocolAccepted }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Teslimat kodu doğrulanamadı.');
    }
    return data;
  },

  // Kiracı Erken İade Başlatma
  async requestEarlyReturn(transactionId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/early-return`, {
      method: 'POST',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Erken iade talebi iletilemedi.');
    }
    return data;
  },

  // Satıcı Erken İadeyi PIN ile Onayla
  async confirmEarlyReturn(transactionId: string, returnPin: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/confirm-early-return`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ returnPin }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Erken iade onaylanırken hata oluştu.');
    }
    return data;
  },

  // Teslimat & Ödeme Onayla
  async confirmHandover(transactionId: string, paymentMethod?: 'IBAN' | 'CASH') {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/confirm-handover`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ paymentMethod }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Teslimat onaylanırken hata oluştu.');
    }
    return data;
  },

  // Hesabı Kalıcı Olarak Sil
  async deleteAccount() {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/auth/delete-account`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Hesap silinirken bir hata oluştu.');
    }
    return data;
  },

  // Satıcı Genel Profili
  async getPublicProfile(userId: string): Promise<{ data: PublicProfileUser }> {
    const res = await fetch(`${BASE_URL}/users/${userId}/public-profile`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Kullanıcı profili alınamadı.');
    }
    return data;
  },

  // Satıcı Değerlendirmeleri
  async getUserReviews(userId: string): Promise<{ data: ReviewEntity[] }> {
    const res = await fetch(`${BASE_URL}/users/${userId}/reviews`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Değerlendirmeler alınamadı.');
    }
    return data;
  },

  // Eşya Değerlendirmeleri
  async getItemReviews(itemId: string): Promise<{ data: ReviewEntity[] }> {
    const res = await fetch(`${BASE_URL}/items/${itemId}/reviews`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Eşya değerlendirmeleri alınamadı.');
    }
    return data;
  },

  // İki Yönlü Değerlendirme Gönder
  async submitReview(
    transactionId: string,
    reviewData: { itemRating: number; ownerRating: number; comment?: string }
  ): Promise<{ data: ReviewEntity }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/transactions/${transactionId}/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify(reviewData),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Değerlendirme kaydedilemedi.');
    }
    return data;
  },
};