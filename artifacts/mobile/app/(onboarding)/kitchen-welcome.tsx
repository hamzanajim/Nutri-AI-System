import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export default function KitchenWelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
      {/* Illustration */}
      <View style={styles.illustrationArea}>
        <View style={[styles.iconRing, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
          <Text style={{ fontSize: 64 }}>🍳</Text>
        </View>

        {/* Floating food bubbles */}
        <View style={[styles.bubble, styles.bubbleTopLeft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 24 }}>🥩</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleTopRight, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 24 }}>🥦</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleBottomLeft, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 24 }}>🍚</Text>
        </View>
        <View style={[styles.bubble, styles.bubbleBottomRight, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 24 }}>🥛</Text>
        </View>
      </View>

      {/* Text */}
      <View style={styles.textArea}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Let's Set Up{'\n'}Your Kitchen
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          To create personalised meal plans, I need to know what food you already have and what you usually keep at home.
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, marginTop: 12 }]}>
          Add everything you currently have. Don't worry, you can edit it later.
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(onboarding)/inventory-setup')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Start Inventory Setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 240,
  },
  iconRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleTopLeft: { top: 20, left: 20 },
  bubbleTopRight: { top: 20, right: 20 },
  bubbleBottomLeft: { bottom: 20, left: 40 },
  bubbleBottomRight: { bottom: 20, right: 40 },
  textArea: {
    marginBottom: 36,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttons: {
    gap: 12,
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  secondaryBtn: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});
