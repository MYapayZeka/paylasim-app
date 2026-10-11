import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Eksik Alan', 'Lütfen ad-soyad, e-posta ve şifre alanlarını doldurun.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Güvenlik', 'Şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.register(
        fullName.trim(),
        email.trim().toLowerCase(),
        password,
        phone.trim() || undefined
      );
      await signIn(res.token, res.user);
    } catch (err: any) {
      Alert.alert('Kayıt Başarısız', err.message || 'Kayıt sırasında bir hata oluştu.');
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
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
        <Text style={styles.formTitle}>Yeni Hesap Oluştur</Text>
        <Text style={styles.formSub}>Eşyalarını komşularınla güvenle paylaşmaya başla</Text>

        <Text style={styles.label}>Ad Soyad *</Text>
        <TextInput
          style={styles.input}
          placeholder="Mehmet Yılmaz"
          placeholderTextColor="#94a3b8"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>E-Posta *</Text>
        <TextInput
          style={styles.input}
          placeholder="ornek@eposta.com"
          placeholderTextColor="#94a3b8"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Telefon Numarası</Text>
        <TextInput
          style={styles.input}
          placeholder="05xxxxxxxxx"
          placeholderTextColor="#94a3b8"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>Şifre *</Text>
        <TextInput
          style={styles.input}
          placeholder="En az 6 karakter"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.registerBtn, loading && styles.disabledBtn]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.registerBtnText}>Hesap Oluştur</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Zaten hesabın var mı? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingTop: 40, paddingBottom: 40, alignItems: 'center' },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 480,
    width: '100%',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.05)',
      },
    }),
  },
  formTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  formSub: { fontSize: 13, color: '#64748b', marginBottom: 20 },
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
  registerBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledBtn: { backgroundColor: '#93c5fd' },
  registerBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#64748b', fontSize: 14 },
  loginLink: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
});