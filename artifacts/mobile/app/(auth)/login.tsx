import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLogin } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const loginMutation = useLogin({
    mutation: {
      onSuccess: async (data) => {
        await login(data.token, data.user as { id: number; email: string; createdAt: string });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      },
      onError: (err: unknown) => {
        const apiError = err as { data?: { error?: string } };
        setError(apiError?.data?.error ?? 'Login failed. Check your credentials.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    },
  });

  const handleLogin = () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    loginMutation.mutate({ data: { email: email.trim().toLowerCase(), password } });
  };

  const styles = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Feather name="activity" size={28} color="#fff" />
          </View>
          <Text style={styles.logoText}>NutriAI</Text>
        </View>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Track your nutrition, reach your goals</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <Feather name="mail" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrap}>
          <Feather name="lock" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loginMutation.isPending && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loginMutation.isPending}
          activeOpacity={0.85}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.footerLink}>Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: insets.top + 48,
      paddingBottom: insets.bottom + 24,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 40,
    },
    logoIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    logoText: {
      fontSize: 26,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
    },
    heading: {
      fontSize: 28,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      marginBottom: 8,
    },
    sub: {
      fontSize: 15,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginBottom: 32,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.destructive + '18',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      flex: 1,
      color: colors.destructive,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
    },
    label: {
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
      color: colors.foreground,
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      height: 52,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      color: colors.foreground,
    },
    eyeBtn: {
      padding: 4,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    btnText: {
      color: '#fff',
      fontSize: 16,
      fontFamily: 'Inter_600SemiBold',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 28,
    },
    footerText: {
      color: colors.mutedForeground,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
    },
    footerLink: {
      color: colors.primary,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
    },
  });
}
