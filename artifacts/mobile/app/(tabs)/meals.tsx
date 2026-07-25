import React, { useState, useCallback } from 'react';
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
import { useAuth } from '@/context/AuthContext';
import {
  useListMeals,
  useCreateMeal,
  useDeleteMeal,
  useListMealPlans,
  useGetMealPlan,
  useGenerateMealPlan,
  useDeleteMealPlan,
  useDeleteMealPlanMeal,
  useRegenerateMealPlanMeal,
  useCompleteMealPlanMeal,
  useReplaceMealIngredient,
  useListGroceryLists,
  useCreateGroceryList,
  useAddGroceryListItem,
  getListMealsQueryKey,
  getListMealPlansQueryKey,
  getGetMealPlanQueryKey,
  getGetDashboardTodayQueryKey,
} from '@workspace/api-client-react';
import type { MealPlanMealDetail, MealPlanIngredient } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import MealPrepModal from '@/components/MealPrepModal';

const TODAY = new Date().toISOString().split('T')[0];
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPES: { value: MealType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunrise' },
  { value: 'lunch',     label: 'Lunch',     icon: 'sun' },
  { value: 'dinner',    label: 'Dinner',    icon: 'moon' },
  { value: 'snack',     label: 'Snack',     icon: 'package' },
];

function getMealTypeColor(t: string) {
  switch (t) {
    case 'breakfast': return '#F59E0B';
    case 'lunch':     return '#3B82F6';
    case 'dinner':    return '#8B5CF6';
    default:          return '#6B7280';
  }
}
function getMealTypeIcon(t: string): keyof typeof Feather.glyphMap {
  switch (t) {
    case 'breakfast': return 'sunrise';
    case 'lunch':     return 'sun';
    case 'dinner':    return 'moon';
    default:          return 'package';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: color + '18' }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color }}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color }}>{Math.round(value)}g</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MealsScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const qc        = useQueryClient();
  const { token } = useAuth();

  const [selectedDate,    setSelectedDate]    = useState(TODAY);
  const [showAddMeal,     setShowAddMeal]      = useState(false);
  const [mealName,        setMealName]         = useState('');
  const [mealType,        setMealType]         = useState<MealType>('breakfast');
  const [expandedMeal,    setExpandedMeal]     = useState<number | null>(null);   // logged meals
  const [expandedPlan,    setExpandedPlan]     = useState<number | null>(null);   // AI plan meals
  const [generatingPlan,  setGeneratingPlan]   = useState(false);
  const [addedToGrocery,  setAddedToGrocery]   = useState<Set<number>>(new Set());
  const [replacingIngId,  setReplacingIngId]   = useState<number | null>(null);
  const [prepMeal,        setPrepMeal]         = useState<null | {
    id: number; name: string; planId: number; mealType: string;
    prepInstructions: string | null; cookingTimeMinutes: number | null;
    ingredients: { name: string; quantityG: number; unit: string; available?: boolean }[];
  }>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: meals, isLoading: loadingMeals, isRefetching, refetch } =
    useListMeals({ date: selectedDate });

  const { data: mealPlans, isLoading: loadingPlans, refetch: refetchPlans } =
    useListMealPlans(
      { date: selectedDate },
      { query: { queryKey: getListMealPlansQueryKey({ date: selectedDate }) } }
    );
  const todayPlan = mealPlans?.[0] ?? null;

  const { data: planDetail, isLoading: loadingPlanDetail } = useGetMealPlan(
    todayPlan?.id ?? 0,
    { query: { enabled: !!todayPlan?.id, queryKey: getGetMealPlanQueryKey(todayPlan?.id ?? 0) } }
  );

  const { data: groceryLists } = useListGroceryLists();

  // ── Mutations ────────────────────────────────────────────────────────────────

  const generatePlan = useGenerateMealPlan({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
        qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(data.id) });
        qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        setGeneratingPlan(false);
        setExpandedPlan(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: () => {
        setGeneratingPlan(false);
        Alert.alert('Generation Failed', 'Could not generate meal plan. Please check your connection and try again.');
      },
    },
  });

  const deletePlan = useDeleteMealPlan({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
        qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        setExpandedPlan(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    },
  });

  const deletePlanMeal = useDeleteMealPlanMeal({
    mutation: {
      onSuccess: () => {
        if (todayPlan?.id) {
          qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(todayPlan.id) });
          qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
          qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        }
        setExpandedPlan(null);
      },
    },
  });

  const regenerateMeal = useRegenerateMealPlanMeal({
    mutation: {
      onSuccess: (data) => {
        if (todayPlan?.id) {
          qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(todayPlan.id) });
          qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
          qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        }
        setExpandedPlan(data.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const completeMeal = useCompleteMealPlanMeal({
    mutation: {
      onSuccess: () => {
        if (todayPlan?.id) {
          qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(todayPlan.id) });
          qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
        }
        qc.invalidateQueries({ queryKey: getListMealsQueryKey({ date: selectedDate }) });
        qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        setExpandedPlan(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const replaceMealIngredient = useReplaceMealIngredient();

  const createGroceryList = useCreateGroceryList();
  const addGroceryItem    = useAddGroceryListItem();

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
        setExpandedMeal(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleGeneratePlan = () => {
    setGeneratingPlan(true);
    generatePlan.mutate({ data: { date: selectedDate, mealCount: 3 } });
  };

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

  const handleLogMeal = (planId: number, mealId: number, mealName: string) => {
    Alert.alert(
      'Log Meal',
      `Log "${mealName}" as eaten? This will deduct the ingredients from your inventory and add the nutrition to today's totals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Meal',
          onPress: () => completeMeal.mutate({ id: planId, mealId }),
        },
      ]
    );
  };

  const handleAddToGrocery = useCallback(async (ing: MealPlanIngredient) => {
    try {
      let listId = groceryLists?.[0]?.id;
      if (!listId) {
        const newList = await createGroceryList.mutateAsync({ data: { name: 'Shopping List' } });
        listId = newList.id;
      }
      await addGroceryItem.mutateAsync({
        listId,
        data: { name: ing.name, quantity: Math.ceil(ing.quantityG / 100), unit: ing.unit, notes: 'From meal plan' },
      });
      setAddedToGrocery((prev) => new Set([...prev, ing.id]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Could not add to grocery list. Please try again.');
    }
  }, [groceryLists, createGroceryList, addGroceryItem]);

  const handleReplaceIngredient = useCallback(
    (planId: number, mealId: number, ing: MealPlanIngredient) => {
      setReplacingIngId(ing.id);
      replaceMealIngredient.mutate(
        { data: { ingredientName: ing.name, mealPlanIngredientId: ing.id } },
        {
          onSuccess: async (result) => {
            setReplacingIngId(null);
            if (!result.found || !result.replacementName) {
              Alert.alert('No Replacement Found', result.reason || 'No suitable replacement found in your inventory.');
              return;
            }
            Alert.alert(
              'Replace Ingredient?',
              `Replace "${ing.name}" with "${result.replacementName}"?\n\n${result.reason}`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Replace',
                  onPress: async () => {
                    try {
                      const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
                      await fetch(
                        `${baseUrl}/api/meal-plans/${planId}/meals/${mealId}/ingredients/${ing.id}`,
                        {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            name: result.replacementName,
                            inventoryItemId: result.replacementInventoryItemId ?? null,
                            available: true,
                          }),
                        }
                      );
                      qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(planId) });
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch {
                      Alert.alert('Error', 'Could not update ingredient. Please try again.');
                    }
                  },
                },
              ]
            );
          },
          onError: () => {
            setReplacingIngId(null);
            Alert.alert('Error', 'Could not find a replacement. Please try again.');
          },
        }
      );
    },
    [replaceMealIngredient, token, qc]
  );

  const planMeals = planDetail?.meals ?? [];
  const styles = makeStyles(colors);
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Meals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddMeal(true)} activeOpacity={0.85}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date selector */}
      <View style={styles.dateRow}>
        {[-1, 0, 1].map((offset) => {
          const d = new Date(); d.setDate(d.getDate() + offset);
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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { refetch(); refetchPlans(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── AI Meal Plan ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🤖 AI Meal Plan</Text>
            {todayPlan && (
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Delete Plan', 'This will delete the entire AI plan for this day.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deletePlan.mutate({ id: todayPlan.id }) },
                  ])
                }
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            )}
          </View>

          {(loadingPlans || loadingPlanDetail) && (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 28 }} />
          )}

          {!loadingPlans && !todayPlan && (
            <TouchableOpacity
              style={styles.generateCard}
              onPress={handleGeneratePlan}
              disabled={generatingPlan}
              activeOpacity={0.88}
            >
              {generatingPlan ? (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.generateTitle}>Building your meal plan…</Text>
                  <Text style={styles.generateSubtext}>This takes about 15–30 seconds</Text>
                </>
              ) : (
                <>
                  <Feather name="cpu" size={30} color={colors.primary} />
                  <Text style={styles.generateTitle}>Generate My Meal Plan</Text>
                  <Text style={styles.generateSubtext}>AI plans meals around your goals, inventory and nutrition targets</Text>
                  <View style={styles.generateBtn}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Generate →</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}

          {todayPlan && !loadingPlanDetail && (
            <>
              {/* Totals row */}
              <View style={styles.planTotals}>
                {[
                  { label: 'kcal',    value: todayPlan.totalCalories, color: colors.foreground },
                  { label: 'protein', value: todayPlan.totalProteinG,  color: '#ef4444' },
                  { label: 'carbs',   value: todayPlan.totalCarbsG,    color: '#f59e0b' },
                  { label: 'fat',     value: todayPlan.totalFatG,      color: '#a78bfa' },
                ].map((item, i, arr) => (
                  <React.Fragment key={item.label}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={[styles.planTotalNum, { color: item.color }]}>{Math.round(item.value)}</Text>
                      <Text style={styles.planTotalLabel}>{item.label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={{ width: 1, backgroundColor: colors.border }} />}
                  </React.Fragment>
                ))}
              </View>

              {/* Meal cards */}
              {planMeals.map((meal: MealPlanMealDetail) => {
                const isExpanded = expandedPlan === meal.id;
                const mealColor = getMealTypeColor(meal.mealType);
                const missing = meal.ingredients.filter((i) => !i.available);
                const hasMissing = missing.length > 0;

                return (
                  <View key={meal.id} style={[styles.planMealCard, meal.completed && { opacity: 0.6 }]}>
                    {/* ── Card header (always visible, tappable) ── */}
                    <TouchableOpacity
                      style={styles.planMealHeader}
                      onPress={() => !meal.completed && setExpandedPlan(isExpanded ? null : meal.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.planMealIcon, { backgroundColor: mealColor + '1A' }]}>
                        <Feather name={getMealTypeIcon(meal.mealType)} size={17} color={mealColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planMealName} numberOfLines={1}>{meal.name}</Text>
                        <Text style={styles.planMealMeta}>
                          {meal.mealType}
                          {meal.scheduledTime ? ` · ${meal.scheduledTime}` : ''}
                          {meal.calories ? ` · ${Math.round(meal.calories)} kcal` : ''}
                          {hasMissing && !meal.completed ? ` · ⚠️ ${missing.length} missing` : ''}
                        </Text>
                      </View>
                      {meal.completed ? (
                        <View style={styles.completedBadge}>
                          <Feather name="check-circle" size={14} color="#22C55E" />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#22C55E', marginLeft: 3 }}>Logged</Text>
                        </View>
                      ) : (
                        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                      )}
                    </TouchableOpacity>

                    {/* ── Expanded detail ── */}
                    {isExpanded && !meal.completed && (
                      <View style={styles.planMealBody}>
                        {/* Ingredients */}
                        {meal.ingredients.length > 0 && (
                          <View style={styles.ingSection}>
                            <Text style={styles.ingSectionLabel}>INGREDIENTS</Text>
                            {meal.ingredients.map((ing) => (
                              <View key={ing.id} style={styles.ingRow}>
                                <View style={[styles.ingDot, { backgroundColor: ing.available ? '#22C55E' : '#EF4444' }]} />
                                <Text style={[styles.ingName, !ing.available && { color: colors.mutedForeground }]}>
                                  {ing.quantityG}{ing.unit} {ing.name}
                                </Text>
                                {!ing.available && (
                                  <View style={styles.missingTag}>
                                    <Text style={styles.missingTagText}>missing</Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Macros row */}
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                          {meal.proteinG != null && <MacroChip label="P" value={meal.proteinG} color="#ef4444" />}
                          {meal.carbsG   != null && <MacroChip label="C" value={meal.carbsG}   color="#f59e0b" />}
                          {meal.fatG     != null && <MacroChip label="F" value={meal.fatG}     color="#a78bfa" />}
                          {meal.cookingTimeMinutes != null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                              <Feather name="clock" size={12} color={colors.mutedForeground} />
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                                {meal.cookingTimeMinutes} min
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Notes */}
                        {meal.notes && (
                          <Text style={styles.mealNotes}>{meal.notes}</Text>
                        )}

                        {/* Action buttons */}
                        <View style={styles.actionRow}>
                          {/* Prep */}
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                              setPrepMeal({
                                id: meal.id,
                                name: meal.name,
                                planId: todayPlan.id,
                                mealType: meal.mealType,
                                prepInstructions: meal.prepInstructions ?? null,
                                cookingTimeMinutes: meal.cookingTimeMinutes ?? null,
                                ingredients: meal.ingredients.map((i) => ({
                                  name: i.name, quantityG: i.quantityG, unit: i.unit, available: i.available,
                                })),
                              })
                            }
                          >
                            <Text style={{ fontSize: 14 }}>🍳</Text>
                            <Text style={styles.actionBtnText}>Prep</Text>
                          </TouchableOpacity>

                          {/* Replace */}
                          <TouchableOpacity
                            style={styles.actionBtn}
                            disabled={regenerateMeal.isPending}
                            onPress={() =>
                              Alert.alert('Replace Meal?', 'AI will suggest a different meal for this slot.', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Replace', onPress: () => regenerateMeal.mutate({ id: todayPlan.id, mealId: meal.id }) },
                              ])
                            }
                          >
                            {regenerateMeal.isPending ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                              <>
                                <Feather name="refresh-cw" size={14} color={colors.primary} />
                                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Replace</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          {/* Delete */}
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() =>
                              Alert.alert('Remove Meal?', `Remove "${meal.name}" from today's plan?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Remove', style: 'destructive', onPress: () => deletePlanMeal.mutate({ id: todayPlan.id, mealId: meal.id }) },
                              ])
                            }
                          >
                            <Feather name="trash-2" size={14} color={colors.destructive} />
                            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
                          </TouchableOpacity>

                          {/* Log Meal */}
                          <TouchableOpacity
                            style={styles.logMealBtn}
                            disabled={completeMeal.isPending}
                            onPress={() => handleLogMeal(todayPlan.id, meal.id, meal.name)}
                          >
                            {completeMeal.isPending ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Feather name="check" size={14} color="#fff" />
                                <Text style={styles.logMealBtnText}>Log Meal</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* Missing Ingredients section */}
                        {hasMissing && (
                          <View style={styles.missingSection}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <Feather name="alert-triangle" size={13} color="#F59E0B" />
                              <Text style={styles.missingSectionTitle}>Missing Ingredients</Text>
                            </View>
                            {missing.map((ing) => {
                              const wasAdded = addedToGrocery.has(ing.id);
                              const isReplacing = replacingIngId === ing.id;
                              return (
                                <View key={ing.id} style={styles.missingIngRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.missingIngName}>{ing.name}</Text>
                                    <Text style={styles.missingIngQty}>{ing.quantityG}{ing.unit} needed</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', gap: 6 }}>
                                    <TouchableOpacity
                                      style={[styles.missingAction, wasAdded && styles.missingActionDone]}
                                      disabled={wasAdded || addGroceryItem.isPending}
                                      onPress={() => handleAddToGrocery(ing)}
                                    >
                                      <Feather name={wasAdded ? 'check' : 'shopping-cart'} size={12} color={wasAdded ? '#22C55E' : colors.primary} />
                                      <Text style={[styles.missingActionText, wasAdded && { color: '#22C55E' }]}>
                                        {wasAdded ? 'Added' : 'Grocery'}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.missingAction}
                                      disabled={isReplacing}
                                      onPress={() => handleReplaceIngredient(todayPlan.id, meal.id, ing)}
                                    >
                                      {isReplacing ? (
                                        <ActivityIndicator size="small" color={colors.primary} />
                                      ) : (
                                        <>
                                          <Feather name="refresh-cw" size={12} color={colors.primary} />
                                          <Text style={styles.missingActionText}>Replace</Text>
                                        </>
                                      )}
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Regenerate whole plan */}
              {planMeals.length > 0 && (
                <TouchableOpacity
                  style={styles.regeneratePlanBtn}
                  onPress={handleGeneratePlan}
                  disabled={generatingPlan}
                >
                  {generatingPlan ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="refresh-cw" size={14} color={colors.primary} />
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary, marginLeft: 6 }}>
                        Regenerate Entire Plan
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Edge case: plan exists but no meals */}
              {planMeals.length === 0 && (
                <TouchableOpacity style={styles.regeneratePlanBtn} onPress={handleGeneratePlan} disabled={generatingPlan}>
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary, marginLeft: 6 }}>
                    Regenerate Plan
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* ── Logged Meals ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Logged Meals</Text>
          </View>

          {loadingMeals ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : !meals || meals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="coffee" size={30} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No meals logged</Text>
              <Text style={styles.emptyText}>Tap + to log a meal, or complete meals from your plan above</Text>
            </View>
          ) : (
            meals.map((meal) => (
              <View key={meal.id} style={styles.mealCard}>
                <TouchableOpacity
                  style={styles.mealHeader}
                  onPress={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.mealIconWrap, { backgroundColor: getMealTypeColor(meal.mealType) + '22' }]}>
                    <Feather name={MEAL_TYPES.find((t) => t.value === meal.mealType)?.icon ?? 'coffee'} size={18} color={getMealTypeColor(meal.mealType)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealMeta}>{meal.mealType} · {meal.items.length} item{meal.items.length !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.mealCal}>{Math.round(meal.totalCalories)} kcal</Text>
                    <Feather name={expandedMeal === meal.id ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>

                {expandedMeal === meal.id && (
                  <View style={styles.expandedBody}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                      <MacroChip label="P" value={meal.totalProteinG} color="#ef4444" />
                      <MacroChip label="C" value={meal.totalCarbsG}   color="#f59e0b" />
                      <MacroChip label="F" value={meal.totalFatG}     color="#a78bfa" />
                    </View>
                    {meal.items.length === 0 ? (
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>No items recorded</Text>
                    ) : (
                      meal.items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                          <Text style={styles.itemName}>{item.foodName}</Text>
                          <Text style={styles.itemDetail}>{item.quantityG}g · {Math.round(item.calories)} kcal</Text>
                        </View>
                      ))
                    )}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteMeal(meal.id)}
                      disabled={deleteMeal.isPending}
                    >
                      {deleteMeal.isPending ? (
                        <ActivityIndicator size="small" color={colors.destructive} />
                      ) : (
                        <>
                          <Feather name="trash-2" size={14} color={colors.destructive} />
                          <Text style={styles.deleteBtnText}>Delete Meal</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Add Meal Modal ── */}
      <Modal visible={showAddMeal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMeal(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log a Meal</Text>
            <TouchableOpacity onPress={() => setShowAddMeal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>Meal Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Chicken and rice"
              placeholderTextColor={colors.mutedForeground}
              value={mealName}
              onChangeText={setMealName}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Meal Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {MEAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, mealType === t.value && styles.typeChipActive]}
                  onPress={() => setMealType(t.value)}
                >
                  <Feather name={t.icon} size={14} color={mealType === t.value ? '#fff' : colors.foreground} />
                  <Text style={[styles.typeChipText, mealType === t.value && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, { marginTop: 24 }]}
              onPress={handleAddMeal}
              disabled={createMeal.isPending || !mealName.trim()}
            >
              {createMeal.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Add Meal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Prep Modal ── */}
      {prepMeal && (
        <MealPrepModal
          visible={!!prepMeal}
          meal={prepMeal}
          onClose={() => setPrepMeal(null)}
          onComplete={() => {
            completeMeal.mutate({ id: prepMeal.planId, mealId: prepMeal.id });
            setPrepMeal(null);
          }}
          onReplace={() => {
            Alert.alert('Replace Meal?', 'AI will suggest a different meal for this slot.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Replace',
                onPress: () => {
                  regenerateMeal.mutate({ id: prepMeal.planId, mealId: prepMeal.id });
                  setPrepMeal(null);
                },
              },
            ]);
          }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground },
    addBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    dateRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
    dateChip: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.muted, alignItems: 'center' },
    dateChipActive: { backgroundColor: colors.primary },
    dateChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    dateChipTextActive: { color: '#fff' },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground },
    generateCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 24,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 10,
    },
    generateTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    generateSubtext: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
    generateBtn: { backgroundColor: colors.primary, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
    planTotals: {
      flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
      justifyContent: 'space-around', alignItems: 'center',
    },
    planTotalNum: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    planTotalLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    // Plan meal cards
    planMealCard: {
      backgroundColor: colors.card, borderRadius: 14, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    planMealHeader: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10 },
    planMealIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    planMealName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    planMealMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 },
    completedBadge: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#22C55E18',
    },
    // Expanded body
    planMealBody: {
      paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2,
      borderTopWidth: 1, borderTopColor: colors.border,
    },
    ingSection: { marginBottom: 10, marginTop: 8 },
    ingSectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, letterSpacing: 0.8, marginBottom: 6 },
    ingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
    ingDot: { width: 7, height: 7, borderRadius: 4 },
    ingName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    missingTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: '#EF444415' },
    missingTagText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#EF4444' },
    mealNotes: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 10, marginTop: 4, lineHeight: 18 },
    // Action row
    actionRow: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 4 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
      backgroundColor: colors.muted, flex: 1, justifyContent: 'center',
    },
    actionBtnText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.foreground },
    logMealBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
      backgroundColor: colors.primary, flex: 1.3, justifyContent: 'center',
    },
    logMealBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' },
    // Missing ingredients section
    missingSection: {
      marginTop: 12, backgroundColor: '#F59E0B08',
      borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: '#F59E0B30',
    },
    missingSectionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#B45309' },
    missingIngRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
      borderBottomWidth: 1, borderBottomColor: '#F59E0B20',
    },
    missingIngName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    missingIngQty: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 },
    missingAction: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
      backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30',
    },
    missingActionDone: { backgroundColor: '#22C55E15', borderColor: '#22C55E30' },
    missingActionText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.primary },
    // Regenerate plan button
    regeneratePlanBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, marginTop: 4,
      borderWidth: 1, borderColor: colors.primary + '60', backgroundColor: colors.primary + '10',
    },
    // Empty / logged meals
    emptyCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 28,
      alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    },
    emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' },
    mealCard: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    mealHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    mealIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    mealName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    mealMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 },
    mealCal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.primary, marginBottom: 2 },
    expandedBody: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    itemName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    itemDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
    deleteBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.destructive },
    // Modals
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 6 },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12,
      fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground, backgroundColor: colors.card,
    },
    typeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted,
    },
    typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    submitBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    submitBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  });
}
