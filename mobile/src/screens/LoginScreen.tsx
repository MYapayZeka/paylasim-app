import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Eksik Alan', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(email.trim().toLowerCase(), password);
      await signIn(res.token, res.user);
    } catch (err: any) {
      Alert.alert('Giriş Başarısız', err.message || 'Bilgilerinizi kontrol ediniz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBox}>
            <Text style={styles.logo}>🤝 Paylaşım</Text>
            <Text style={styles.subTitle}>Mahallende güvenle eşya paylaş ve kirala</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Giriş Yap</Text>

            <Text style={styles.label}>E-Posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@eposta.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.disabledBtn]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>Giriş Yap</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Hesabın yok mu? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                <Text style={styles.registerLink}>Kayıt Ol</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 32,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  logo: { fontSize: 32, fontWeight: '800', color: '#2563eb', marginBottom: 8 },
  subTitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
      },
    }),
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  loginBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledBtn: { backgroundColor: '#93c5fd' },
  loginBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#64748b', fontSize: 14 },
  registerLink: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
});