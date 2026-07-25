import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MealPrepModalProps {
  visible: boolean;
  meal: {
    id: number;
    name: string;
    mealType: string;
    planId: number;
    prepInstructions: string | null;
    cookingTimeMinutes: number | null;
    ingredients: { name: string; quantityG: number; unit: string; available?: boolean }[];
  };
  onClose: () => void;
  onComplete: () => void;
  onReplace: () => void;
}

export default function MealPrepModal({ visible, meal, onClose, onComplete, onReplace }: MealPrepModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets);

  const steps = meal.prepInstructions
    ? meal.prepInstructions.split('\n').filter((s) => s.trim().length > 0)
    : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>👨‍🍳 Prepare Meal</Text>
            <Text style={styles.subtitle}>{meal.name}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {/* Cooking time */}
          {meal.cookingTimeMinutes && (
            <View style={styles.timeRow}>
              <Feather name="clock" size={16} color={colors.primary} />
              <Text style={styles.timeText}>{meal.cookingTimeMinutes} minutes prep time</Text>
            </View>
          )}

          {/* Ingredients */}
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {meal.ingredients.map((ing, i) => (
            <View key={i} style={styles.ingredientRow}>
              <View style={[styles.ingredientDot, { backgroundColor: ing.available === false ? colors.destructive : '#22C55E' }]} />
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientQty}>{ing.quantityG}{ing.unit}</Text>
              {ing.available === false && (
                <Feather name="alert-circle" size={14} color={colors.destructive} style={{ marginLeft: 4 }} />
              )}
            </View>
          ))}

          {/* Instructions */}
          {steps.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Preparation Steps</Text>
              {steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step.replace(/^\d+\.\s*/, '')}</Text>
                </View>
              ))}
            </>
          )}

          {steps.length === 0 && (
            <View style={styles.noInstructions}>
              <Feather name="info" size={20} color={colors.mutedForeground} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>
                No preparation instructions available for this meal.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action buttons */}
        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.replaceBtn} onPress={onReplace}>
            <Feather name="refresh-cw" size={16} color={colors.foreground} />
            <Text style={styles.replaceBtnText}>Replace Meal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.completeBtn} onPress={onComplete}>
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.completeBtnText}>Meal Prepared ✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: insets.top + 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground },
    subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    closeBtn: { padding: 4 },
    timeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 10, marginBottom: 20,
    },
    timeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 10 },
    ingredientRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 8, paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 8, marginBottom: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    ingredientDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    ingredientName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground },
    ingredientQty: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground },
    stepRow: {
      flexDirection: 'row', gap: 12, marginBottom: 12,
    },
    stepNumber: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: colors.primary + '20',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, marginTop: 1,
    },
    stepNumberText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: colors.primary },
    stepText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 22 },
    noInstructions: { alignItems: 'center', paddingVertical: 24 },
    actions: {
      flexDirection: 'row', gap: 12,
      paddingHorizontal: 20, paddingTop: 16,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    replaceBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 13, borderRadius: 12,
      backgroundColor: colors.muted,
    },
    replaceBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    completeBtn: {
      flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 13, borderRadius: 12,
      backgroundColor: '#22C55E',
    },
    completeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  });
}
