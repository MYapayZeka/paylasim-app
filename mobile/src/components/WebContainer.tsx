import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ViewStyle,
  ScrollView,
  useWindowDimensions,
  RefreshControlProps,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface WebContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  disableTopInset?: boolean;
}

export default function WebContainer({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  refreshControl,
  disableTopInset = false,
}: WebContainerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  // Mobilde kamera deliği ve çentik güvenliği
  const topPadding = isDesktop || disableTopInset ? 0 : Math.max(insets.top, 12);

  if (scrollable) {
    return (
      <View style={[styles.root, style, { paddingTop: topPadding }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.desktopScrollContent,
            contentContainerStyle,
          ]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.innerContent, isDesktop && styles.desktopInnerContent]}>
            {children}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, style, { paddingTop: topPadding }]}>
      <View style={[styles.innerContent, isDesktop && styles.desktopInnerContent, contentContainerStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  desktopScrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 0,
  },
  innerContent: {
    width: '100%',
    flex: 1,
  },
  desktopInnerContent: {
    maxWidth: 1150,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
});
