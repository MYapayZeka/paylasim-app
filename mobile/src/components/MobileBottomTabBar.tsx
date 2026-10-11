import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MobileBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [unreadCount, setUnreadCount] = useState(0);
  const [hasPendingRequests, setHasPendingRequests] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchBadgeData = async () => {
      try {
        const [unreadRes, incomingRes] = await Promise.all([
          api.getUnreadCount().catch(() => ({ data: { unreadCount: 0 } })),
          api.getIncomingTransactions().catch(() => ({ data: [] })),
        ]);
        setUnreadCount(unreadRes.data?.unreadCount || 0);
        const incoming = incomingRes.data || [];
        const pending = incoming.some((tx: any) => tx.status === 'PENDING');
        setHasPendingRequests(pending);
      } catch {}
    };

    fetchBadgeData();
    const interval = setInterval(fetchBadgeData, 4000);
    return () => clearInterval(interval);
  }, [user]);

  // Desktop web'de alt gezinme çubuğu yerine üst menü (WebNavbar) kullanılır
  if (isDesktop) {
    return null;
  }

  // Mobilde gösterilen 5 temel sekme
  const tabConfig = [
    { name: 'Keşfet', label: 'Keşfet', icon: '🧭' },
    { name: 'Arama', label: 'Arama', icon: '🔍' },
    { name: 'Talepler', label: 'Talepler', icon: '🤝', hasDot: hasPendingRequests },
    { name: 'Sohbetler', label: 'Sohbetler', icon: '💬', badge: unreadCount },
    { name: 'Profil', label: 'Profil', icon: '👤' },
  ];

  const currentRouteName = state.routes[state.index]?.name;
  const isAddingItem = currentRouteName === 'İlan Ver';
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <>
      {/* Sağ Altta Yüzen Hızlı Aksiyon Butonu (+ İlan Ver FAB) - İlan Ver ekranında değilken görünür */}
      {!isAddingItem && (
        <Pressable
          style={({ pressed }) => [
            styles.fabButton,
            { bottom: bottomPadding + 62 },
            pressed && styles.fabButtonPressed,
          ]}
          onPress={() => navigation.navigate('İlan Ver')}
        >
          <View style={styles.fabInner}>
            <Text style={styles.fabIcon}>＋</Text>
            <Text style={styles.fabText}>İlan Ver</Text>
          </View>
        </Pressable>
      )}

      {/* Ekranın En Altına Sabitlenen Modern Gölgeli Alt Gezinme Çubuğu */}
      <View style={[styles.tabBarContainer, { paddingBottom: bottomPadding }]}>
        <View style={styles.tabBarInner}>
          {tabConfig.map((item) => {
            const isFocused = currentRouteName === item.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes.find((r) => r.name === item.name)?.key || '',
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(item.name);
              }
            };

            return (
              <Pressable
                key={item.name}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.tabItem,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
                ]}
              >
                <View style={[styles.iconWrapper, isFocused && styles.iconWrapperActive]}>
                  <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>
                    {item.icon}
                  </Text>

                  {/* Sohbet Okunmamış Mesaj Sayı Rozeti */}
                  {item.badge && item.badge > 0 ? (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {item.badge > 9 ? '9+' : item.badge}
                      </Text>
                    </View>
                  ) : null}

                  {/* Bekleyen Talep Bildirim Noktası */}
                  {item.hasDot ? <View style={styles.dotBadge} /> : null}
                </View>

                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    width: '100%',
    ...Platform.select({
      web: {
        boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.06)',
      },
      default: {
        elevation: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
    }),
  },
  tabBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 56,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    cursor: 'pointer' as any,
  },
  iconWrapper: {
    position: 'relative',
    width: 38,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: '#eff6ff',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.8,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: '#ef4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  dotBadge: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#f59e0b',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  fabButton: {
    position: 'absolute',
    right: 18,
    zIndex: 999,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer' as any,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)',
      },
      default: {
        elevation: 8,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
    }),
  },
  fabButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: -1,
  },
  fabText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
