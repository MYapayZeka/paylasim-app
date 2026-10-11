import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { api, resolveImageUrl } from '../services/api';

export default function WebNavbar({ navigation, route }: BottomTabHeaderProps) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;

  const currentRoute = route.name;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await api.getUnreadCount();
        setUnreadCount(res.data?.unreadCount || 0);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 3500);
    return () => clearInterval(interval);
  }, [user, currentRoute]);

  const navLinks = [
    { name: 'Keşfet', label: 'Keşfet', icon: '🧭' },
    { name: 'Arama', label: 'Arama', icon: '🔍' },
    { name: 'Talepler', label: 'Talepler', icon: '🤝' },
    { name: 'Sohbetler', label: 'Sohbetler', icon: '💬', badge: unreadCount },
    { name: 'Profil', label: 'Profil', icon: '👤' },
  ];

  return (
    <View style={styles.navbarWrapper}>
      <View style={styles.navbarInner}>
        {/* Sol Taraf: Marka Logosu */}
        <TouchableOpacity
          style={styles.brandContainer}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Keşfet')}
        >
          <View style={styles.brandIconWrapper}>
            <Text style={styles.brandEmoji}>🤝</Text>
          </View>
          <View>
            <View style={styles.brandTextRow}>
              <Text style={styles.brandPrimary}>Paylaş</Text>
              <Text style={styles.brandAccent}>IM</Text>
            </View>
            <Text style={styles.brandTagline}>Mahalle Pazar Yeri</Text>
          </View>
        </TouchableOpacity>

        {/* Sağ Taraf: Navigasyon Linkleri & İlan Ver Butonu */}
        <View style={styles.rightContainer}>
          <View style={styles.navLinksRow}>
            {navLinks.map((item) => {
              const isActive = currentRoute === item.name;
              return (
                <TouchableOpacity
                  key={item.name}
                  style={[styles.navLink, isActive && styles.navLinkActive]}
                  onPress={() => navigation.navigate(item.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.navLinkLabelRow}>
                    <Text style={[styles.navLinkText, isActive && styles.navLinkTextActive]}>
                      {item.label}
                    </Text>
                    {item.badge && item.badge > 0 ? (
                      <View style={styles.unreadNavbarBadge}>
                        <Text style={styles.unreadNavbarBadgeText}>
                          {item.badge > 9 ? '9+' : item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {isActive && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* "+ İlan Ver" Butonu */}
          <TouchableOpacity
            style={styles.addItemButton}
            onPress={() => navigation.navigate('İlan Ver')}
            activeOpacity={0.85}
          >
            <Text style={styles.addItemIcon}>+</Text>
            <Text style={styles.addItemText}>İlan Ver</Text>
          </TouchableOpacity>

          {/* Kullanıcı Avatar Kısa Yolu */}
          {user && (
            <TouchableOpacity
              style={styles.userProfilePill}
              onPress={() => navigation.navigate('Profil')}
              activeOpacity={0.8}
            >
              <View style={styles.userAvatarSmall}>
                {user.avatarUrl ? (
                  <Image
                    source={{ uri: resolveImageUrl(user.avatarUrl) }}
                    style={styles.userAvatarImg}
                  />
                ) : (
                  <Text style={styles.userAvatarInitial}>
                    {(user.fullName || 'K').slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              {!isCompact && (
                <Text style={styles.userProfileName} numberOfLines={1}>
                  {user.fullName.split(' ')[0]}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbarWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    width: '100%',
    zIndex: 100,
    ...Platform.select({
      web: {
        position: 'sticky' as any,
        top: 0,
        boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.05)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  navbarInner: {
    maxWidth: 1150,
    width: '100%',
    alignSelf: 'center',
    height: 70,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer' as any,
  },
  brandIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  brandEmoji: {
    fontSize: 20,
  },
  brandTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandPrimary: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandAccent: {
    fontSize: 21,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: -2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    position: 'relative',
    cursor: 'pointer' as any,
  },
  navLinkActive: {
    backgroundColor: '#eff6ff',
  },
  navLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  navLinkTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  addItemButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
    cursor: 'pointer' as any,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
      },
    }),
  },
  addItemIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: -1,
  },
  addItemText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  userProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    cursor: 'pointer' as any,
  },
  userAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImg: {
    width: '100%',
    height: '100%',
  },
  userAvatarInitial: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  userProfileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginRight: 4,
  },
  navLinkLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadNavbarBadge: {
    backgroundColor: '#ef4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadNavbarBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
});
