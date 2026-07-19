import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  useListMeals,
  useCreateMeal,
  useDeleteMeal,
  useAddMealItem,
  getListMealsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

const TODAY = new Date().toISOString().split('T')[0];
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: { value: MealType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunrise' },
  { value: 'lunch', label: 'Lunch', icon: 'sun' },
  { value: 'dinner', label: 'Dinner', icon: 'moon' },
  { value: 'snack', label: 'Snack', icon: 'package' },
];

export default function MealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);

  const { data: meals, isLoading, isRefetching, refetch } = useListMeals({ date: selectedDate });

  const createMeal = useCreateMeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMealsQueryKey({ date: selectedDate }) });
        setShowAddMeal(false);
        setMealName('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const deleteMeal = useDeleteMeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMealsQueryKey({ date: selectedDate }) });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const handleAddMeal = () => {
    if (!mealName.trim()) return;
    createMeal.mutate({ data: { name: mealName.trim(), mealType, date: selectedDate } });
  };

  const handleDeleteMeal = (id: number) => {
    Alert.alert('Delete Meal', 'Remove this meal and all its items?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMeal.mutate({ id }) },
    ]);
  };

  const styles = makeStyles(colors, insets);
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Meals</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddMeal(true)}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date selector */}
      <View style={styles.dateRow}>
        {[-1, 0, 1].map((offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          const ds = d.toISOString().split('T')[0];
          const label = offset === -1 ? 'Yesterday' : offset === 0 ? 'Today' : 'Tomorrow';
          return (
            <TouchableOpacity
              key={ds}
              style={[styles.dateChip, selectedDate === ds && styles.dateChipActive]}
              onPress={() => setSelectedDate(ds)}
            >
              <Text style={[styles.dateChipText, selectedDate === ds && styles.dateChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + tabBarHeight + 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !meals || meals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="coffee" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No meals for this day</Text>
            <Text style={styles.emptyText}>Tap the + button to log a meal</Text>
          </View>
        ) : (
          meals.map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <TouchableOpacity
                style={styles.mealHeader}
                onPress={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                activeOpacity={0.8}
              >
                <View style={styles.mealIconWrap}>
                  <Feather name={MEAL_TYPES.find((t) => t.value === meal.mealType)?.icon ?? 'coffee'} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <Text style={styles.mealMeta}>
                    {meal.mealType} · {meal.items.length} items
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.mealCal}>{Math.round(meal.totalCalories)} kcal</Text>
                  <Feather name={expandedMeal === meal.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>

              {expandedMeal === meal.id && (
                <View style={styles.itemsList}>
                  {/* Macro summary */}
                  <View style={styles.macroRow}>
                    <MacroChip label="P" value={Math.round(meal.totalProteinG)} color={colors.protein} />
                    <MacroChip label="C" value={Math.round(meal.totalCarbsG)} color={colors.carbs} />
                    <MacroChip label="F" value={Math.round(meal.totalFatG)} color={colors.fat} />
                  </View>

                  {meal.items.length === 0 ? (
                    <Text style={styles.emptyItems}>No items yet</Text>
                  ) : (
                    meal.items.map((item) => (
                      <View key={item.id} style={styles.item}>
                        <Text style={styles.itemName}>{item.foodName}</Text>
                        <Text style={styles.itemDetail}>{item.quantityG}g · {Math.round(item.calories)} kcal</Text>
                      </View>
                    ))
                  )}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteMeal(meal.id)}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                    <Text style={styles.deleteBtnText}>Delete meal</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Meal Modal */}
      <Modal visible={showAddMeal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Log a Meal</Text>

            <Text style={styles.inputLabel}>Meal Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Oatmeal with berries"
              placeholderTextColor={colors.mutedForeground}
              value={mealName}
              onChangeText={setMealName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Meal Type</Text>
            <View style={styles.typeRow}>
              {MEAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, mealType === t.value && styles.typeChipActive]}
                  onPress={() => setMealType(t.value)}
                >
                  <Feather name={t.icon} size={14} color={mealType === t.value ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.typeChipText, mealType === t.value && { color: colors.primary }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddMeal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, createMeal.isPending && { opacity: 0.7 }]}
                onPress={handleAddMeal}
                disabled={createMeal.isPending}
              >
                {createMeal.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Meal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useColors();
  return (
    <View style={{ backgroundColor: color + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color }}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{value}g</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    title: { fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground },
    addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    dateRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
    dateChip: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center' },
    dateChipActive: { backgroundColor: colors.accent },
    dateChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    dateChipTextActive: { color: colors.primary, fontFamily: 'Inter_700Bold' },
    center: { alignItems: 'center', paddingTop: 60 },
    emptyCard: { alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 16, padding: 40, marginTop: 16 },
    emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    mealCard: { backgroundColor: colors.card, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1, overflow: 'hidden' },
    mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
    mealIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    mealName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 2 },
    mealMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    mealCal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.calories, marginBottom: 4 },
    itemsList: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16 },
    macroRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
    itemName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    itemDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    emptyItems: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', paddingVertical: 8 },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    deleteBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.destructive },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 20 },
    inputLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 6 },
    input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, paddingHorizontal: 14, height: 50, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.foreground, marginBottom: 16 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border },
    typeChipActive: { borderColor: colors.primary, backgroundColor: colors.accent },
    typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    saveBtn: { flex: 2, height: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  });
}
