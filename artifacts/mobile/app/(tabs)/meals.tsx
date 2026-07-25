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
  useListGroceryLists,
  useCreateGroceryList,
  useAddGroceryListItem,
  getListMealsQueryKey,
  getListMealPlansQueryKey,
  getGetMealPlanQueryKey,
  getGetDashboardTodayQueryKey,
  getListGroceryListsQueryKey,
} from '@workspace/api-client-react';
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

function getMealTypeColor(mealType: string): string {
  switch (mealType) {
    case 'breakfast': return '#F59E0B';
    case 'lunch': return '#3B82F6';
    case 'dinner': return '#8B5CF6';
    default: return '#6B7280';
  }
}

function getMealTypeIcon(mealType: string): keyof typeof Feather.glyphMap {
  switch (mealType) {
    case 'breakfast': return 'sunrise';
    case 'lunch': return 'sun';
    case 'dinner': return 'moon';
    default: return 'package';
  }
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: color + '20' }}>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color }}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color }}>{Math.round(value)}g</Text>
    </View>
  );
}

type PlanMeal = {
  id: number; name: string; mealType: string; scheduledTime?: string | null;
  calories?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null;
  prepInstructions?: string | null; cookingTimeMinutes?: number | null;
  completed: boolean; notes?: string | null;
  ingredients: { id: number; name: string; quantityG: number; unit: string; available: boolean; inventoryItemId?: number | null }[];
};

export default function MealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { token } = useAuth();

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  // expandedMeal tracks logged meal expansion; expandedPlanMealId tracks AI plan meal expansion
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [expandedPlanMealId, setExpandedPlanMealId] = useState<number | null>(null);
  const [loggedMealId, setLoggedMealId] = useState<number | null>(null); // brief "Logged ✓" state
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [replacingIngId, setReplacingIngId] = useState<number | null>(null); // tracks in-progress replace
  const [addingGroceryIngId, setAddingGroceryIngId] = useState<number | null>(null);
  const [showMissingFor, setShowMissingFor] = useState<number | null>(null); // which meal has missing section expanded

  const [prepMeal, setPrepMeal] = useState<null | {
    id: number; name: string; planId: number; mealType: string;
    prepInstructions: string | null; cookingTimeMinutes: number | null;
    ingredients: { name: string; quantityG: number; unit: string; available?: boolean }[];
  }>(null);

  const { data: meals, isLoading: loadingMeals, isRefetching, refetch } = useListMeals({ date: selectedDate });

  const { data: mealPlans, isLoading: loadingPlans, refetch: refetchPlans } = useListMealPlans(
    { date: selectedDate },
    { query: { queryKey: getListMealPlansQueryKey({ date: selectedDate }) } }
  );
  const todayPlanSummary = mealPlans?.[0] ?? null;

  // Fetch full plan detail (with meals + ingredients) when a plan exists
  const { data: planDetail, isLoading: loadingPlanDetail } = useGetMealPlan(
    todayPlanSummary?.id ?? 0,
    {
      query: {
        enabled: !!todayPlanSummary?.id,
        queryKey: getGetMealPlanQueryKey(todayPlanSummary?.id ?? 0),
      },
    }
  );

  // Grocery lists for "Add to Grocery" feature
  const { data: groceryLists } = useListGroceryLists();

  const generatePlan = useGenerateMealPlan({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
        qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(data.id) });
        qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        setGeneratingPlan(false);
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
        setExpandedPlanMealId(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    },
  });

  const deletePlanMeal = useDeleteMealPlanMeal({
    mutation: {
      onSuccess: () => {
        setExpandedPlanMealId(null);
        if (todayPlanSummary?.id) {
          qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(todayPlanSummary.id) });
          qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    },
  });

  const regenerateMeal = useRegenerateMealPlanMeal({
    mutation: {
      onSuccess: (data) => {
        if (todayPlanSummary?.id) {
          qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(todayPlanSummary.id) });
          qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
          qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        }
        // Re-open the expanded card for the newly regenerated meal
        if (data && typeof data === 'object' && 'id' in data) {
          setExpandedPlanMealId((data as { id: number }).id);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const completeMeal = useCompleteMealPlanMeal({
    mutation: {
      onSuccess: (_data, variables) => {
        if (todayPlanSummary?.id) {
          qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(todayPlanSummary.id) });
          qc.invalidateQueries({ queryKey: getListMealPlansQueryKey({ date: selectedDate }) });
        }
        qc.invalidateQueries({ queryKey: getListMealsQueryKey({ date: selectedDate }) });
        qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });

        // Show brief "Logged ✓" state then collapse
        setLoggedMealId(variables.mealId);
        setTimeout(() => {
          setLoggedMealId(null);
          setExpandedPlanMealId(null);
        }, 1500);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const createGroceryList = useCreateGroceryList();
  const addGroceryItem = useAddGroceryListItem();

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

  const handleAddToGrocery = useCallback(async (ing: { id: number; name: string; quantityG: number; unit: string }) => {
    setAddingGroceryIngId(ing.id);
    try {
      let listId: number;
      if (groceryLists && groceryLists.length > 0) {
        listId = groceryLists[0].id;
      } else {
        const newList = await createGroceryList.mutateAsync({ data: { name: 'Shopping List' } });
        qc.invalidateQueries({ queryKey: getListGroceryListsQueryKey() });
        listId = newList.id;
      }
      await addGroceryItem.mutateAsync({
        listId,
        data: { name: ing.name, quantity: ing.quantityG, unit: ing.unit },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Added to Grocery ✓', `${ing.name} has been added to your grocery list.`);
    } catch {
      Alert.alert('Error', 'Could not add to grocery list. Please try again.');
    } finally {
      setAddingGroceryIngId(null);
    }
  }, [groceryLists, createGroceryList, addGroceryItem, qc]);

  const handleReplaceIngredient = useCallback(async (
    planId: number,
    mealId: number,
    ing: { id: number; name: string; quantityG: number; unit: string }
  ) => {
    setReplacingIngId(ing.id);
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;

      // Step 1: Ask AI for a replacement suggestion
      const aiRes = await fetch(`https://${domain}/api/ai/replace-ingredient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ingredientName: ing.name, mealPlanIngredientId: ing.id }),
      });
      if (!aiRes.ok) {
        const errBody = await aiRes.json().catch(() => ({})) as { error?: string };
        Alert.alert('Error', errBody.error ?? 'Could not contact AI. Please try again.');
        return;
      }
      const aiData = await aiRes.json() as { found: boolean; replacementName?: string; replacementInventoryItemId?: number; reason?: string };

      if (!aiData.found || !aiData.replacementName) {
        Alert.alert('No Replacement Found', aiData.reason ?? 'Could not find a suitable replacement from your inventory.');
        return;
      }

      // Step 2: Persist the replacement in the database
      const patchRes = await fetch(`https://${domain}/api/meal-plans/${planId}/meals/${mealId}/ingredients/${ing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: aiData.replacementName,
          inventoryItemId: aiData.replacementInventoryItemId ?? null,
          available: !!aiData.replacementInventoryItemId,
        }),
      });
      if (!patchRes.ok) {
        const errBody = await patchRes.json().catch(() => ({})) as { error?: string };
        Alert.alert('Error', errBody.error ?? 'Could not save the replacement. Please try again.');
        return;
      }

      qc.invalidateQueries({ queryKey: getGetMealPlanQueryKey(planId) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Ingredient Replaced ✓', `"${ing.name}" replaced with "${aiData.replacementName}".\n\n${aiData.reason ?? ''}`);
    } catch {
      Alert.alert('Error', 'Could not replace ingredient. Please try again.');
    } finally {
      setReplacingIngId(null);
    }
  }, [qc, token]);

  const styles = makeStyles(colors);
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;

  const planMeals = (planDetail as unknown as { meals?: PlanMeal[] } | undefined)?.meals as PlanMeal[] | undefined;

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
        {/* ── AI Meal Plan Section ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🤖 AI Meal Plan</Text>
            {todayPlanSummary && (
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Delete Meal Plan',
                    'This will delete the entire AI-generated plan for this day.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete Plan',
                        style: 'destructive',
                        onPress: () => deletePlan.mutate({ id: todayPlanSummary.id }),
                      },
                    ]
                  )
                }
              >
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            )}
          </View>

          {/* Loading state */}
          {(loadingPlans || loadingPlanDetail) && (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: 28 }} />
          )}

          {/* No plan — generate CTA */}
          {!loadingPlans && !todayPlanSummary && (
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
                  <Text style={styles.generateSubtext}>
                    AI will plan meals based on your goals, inventory, and nutrition targets
                  </Text>
                  <View style={styles.generateBtn}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Generate →</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Plan exists — show meals */}
          {todayPlanSummary && !loadingPlanDetail && planMeals && (
            <>
              {/* Nutrition totals row */}
              <View style={styles.planTotals}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.planTotalNum}>{Math.round(todayPlanSummary.totalCalories)}</Text>
                  <Text style={styles.planTotalLabel}>kcal</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.planTotalNum, { color: '#ef4444' }]}>{Math.round(todayPlanSummary.totalProteinG)}g</Text>
                  <Text style={styles.planTotalLabel}>protein</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.planTotalNum, { color: '#f59e0b' }]}>{Math.round(todayPlanSummary.totalCarbsG)}g</Text>
                  <Text style={styles.planTotalLabel}>carbs</Text>
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.planTotalNum, { color: '#a78bfa' }]}>{Math.round(todayPlanSummary.totalFatG)}g</Text>
                  <Text style={styles.planTotalLabel}>fat</Text>
                </View>
              </View>

              {/* Individual meal cards — tap to expand */}
              {planMeals.map((meal) => {
                const mealColor = getMealTypeColor(meal.mealType);
                const isExpanded = expandedPlanMealId === meal.id;
                const isLogged = loggedMealId === meal.id;
                const missingIngredients = meal.ingredients.filter((i) => !i.available);
                const hasMissing = missingIngredients.length > 0 && !meal.completed;
                const isMissingExpanded = showMissingFor === meal.id;

                return (
                  <View key={meal.id} style={[styles.planMealCard, meal.completed && { opacity: 0.65 }]}>
                    {/* Card header — tappable to expand */}
                    <TouchableOpacity
                      style={styles.planMealHeader}
                      onPress={() => {
                        if (!meal.completed) {
                          setExpandedPlanMealId(isExpanded ? null : meal.id);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.planMealIcon, { backgroundColor: mealColor + '20' }]}>
                        <Feather name={getMealTypeIcon(meal.mealType)} size={17} color={mealColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planMealName} numberOfLines={1}>{meal.name}</Text>
                        <Text style={styles.planMealMeta}>
                          {meal.mealType}
                          {meal.scheduledTime ? ` · ${meal.scheduledTime}` : ''}
                          {meal.calories ? ` · ${Math.round(meal.calories)} kcal` : ''}
                        </Text>
                      </View>

                      {meal.completed ? (
                        <View style={styles.completedBadge}>
                          <Feather name="check" size={13} color="#22C55E" />
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#22C55E', marginLeft: 3 }}>Done</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {hasMissing && !isExpanded && (
                            <View style={[styles.missingBadge, { backgroundColor: colors.destructive + '20' }]}>
                              <Feather name="alert-circle" size={11} color={colors.destructive} />
                              <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.destructive, marginLeft: 2 }}>
                                {missingIngredients.length}
                              </Text>
                            </View>
                          )}
                          <Feather
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.mutedForeground}
                          />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Expanded body */}
                    {isExpanded && !meal.completed && (
                      <View style={styles.expandedBody}>
                        {/* Macro chips */}
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                          <MacroChip label="P" value={meal.proteinG ?? 0} color="#ef4444" />
                          <MacroChip label="C" value={meal.carbsG ?? 0} color="#f59e0b" />
                          <MacroChip label="F" value={meal.fatG ?? 0} color="#a78bfa" />
                          {meal.cookingTimeMinutes && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.muted }}>
                              <Feather name="clock" size={10} color={colors.mutedForeground} />
                              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{meal.cookingTimeMinutes}m</Text>
                            </View>
                          )}
                        </View>

                        {/* Ingredients list */}
                        {meal.ingredients.length > 0 && (
                          <View style={{ marginBottom: 12 }}>
                            <Text style={styles.subsectionLabel}>INGREDIENTS</Text>
                            {meal.ingredients.map((ing) => (
                              <View key={ing.id} style={styles.ingredientRow}>
                                <View style={[styles.ingredientDot, { backgroundColor: ing.available ? '#22C55E' : colors.destructive }]} />
                                <Text style={[styles.ingredientName, !ing.available && { color: colors.mutedForeground }]}>
                                  {ing.name}
                                </Text>
                                <Text style={styles.ingredientQty}>{ing.quantityG}{ing.unit}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Missing Ingredients section */}
                        {hasMissing && (
                          <View style={styles.missingCard}>
                            <TouchableOpacity
                              style={styles.missingCardHeader}
                              onPress={() => setShowMissingFor(isMissingExpanded ? null : meal.id)}
                              activeOpacity={0.8}
                            >
                              <Feather name="alert-triangle" size={14} color={colors.destructive} />
                              <Text style={styles.missingCardTitle}>
                                {missingIngredients.length} Missing Ingredient{missingIngredients.length !== 1 ? 's' : ''}
                              </Text>
                              <Feather
                                name={isMissingExpanded ? 'chevron-up' : 'chevron-down'}
                                size={13}
                                color={colors.destructive}
                                style={{ marginLeft: 'auto' }}
                              />
                            </TouchableOpacity>

                            {isMissingExpanded && missingIngredients.map((ing) => (
                              <View key={ing.id} style={styles.missingIngRow}>
                                <Text style={styles.missingIngName} numberOfLines={1}>{ing.name}</Text>
                                <Text style={styles.missingIngQty}>{ing.quantityG}{ing.unit}</Text>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  <TouchableOpacity
                                    style={[styles.missingIngBtn, { backgroundColor: colors.primary + '15' }]}
                                    disabled={addingGroceryIngId === ing.id}
                                    onPress={() => handleAddToGrocery(ing)}
                                  >
                                    {addingGroceryIngId === ing.id ? (
                                      <ActivityIndicator size="small" color={colors.primary} />
                                    ) : (
                                      <Text style={[styles.missingIngBtnText, { color: colors.primary }]}>+ Grocery</Text>
                                    )}
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.missingIngBtn, { backgroundColor: colors.muted }]}
                                    disabled={replacingIngId === ing.id}
                                    onPress={() => handleReplaceIngredient(todayPlanSummary.id, meal.id, ing)}
                                  >
                                    {replacingIngId === ing.id ? (
                                      <ActivityIndicator size="small" color={colors.foreground} />
                                    ) : (
                                      <Text style={[styles.missingIngBtnText, { color: colors.foreground }]}>Replace</Text>
                                    )}
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Action button row */}
                        {isLogged ? (
                          // Brief "Logged ✓" state
                          <View style={styles.loggedState}>
                            <Feather name="check-circle" size={18} color="#22C55E" />
                            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#22C55E', marginLeft: 6 }}>
                              Logged ✓
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.actionRow}>
                            {/* Prep */}
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={() =>
                                setPrepMeal({
                                  id: meal.id,
                                  name: meal.name,
                                  planId: todayPlanSummary.id,
                                  mealType: meal.mealType,
                                  prepInstructions: meal.prepInstructions ?? null,
                                  cookingTimeMinutes: meal.cookingTimeMinutes ?? null,
                                  ingredients: meal.ingredients.map((i) => ({
                                    name: i.name,
                                    quantityG: i.quantityG,
                                    unit: i.unit,
                                    available: i.available,
                                  })),
                                })
                              }
                            >
                              <Text style={{ fontSize: 13 }}>👨‍🍳</Text>
                              <Text style={styles.actionBtnText}>Prep</Text>
                            </TouchableOpacity>

                            {/* Replace meal */}
                            <TouchableOpacity
                              style={styles.actionBtn}
                              disabled={regenerateMeal.isPending}
                              onPress={() =>
                                Alert.alert('Replace Meal?', 'AI will suggest a different meal for this slot.', [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Replace',
                                    onPress: () => regenerateMeal.mutate({ id: todayPlanSummary.id, mealId: meal.id }),
                                  },
                                ])
                              }
                            >
                              {regenerateMeal.isPending ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : (
                                <Feather name="refresh-cw" size={14} color={colors.primary} />
                              )}
                              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Replace</Text>
                            </TouchableOpacity>

                            {/* Delete */}
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={() =>
                                Alert.alert('Remove Meal?', `Remove "${meal.name}" from today's plan?`, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Remove',
                                    style: 'destructive',
                                    onPress: () => deletePlanMeal.mutate({ id: todayPlanSummary.id, mealId: meal.id }),
                                  },
                                ])
                              }
                            >
                              <Feather name="trash-2" size={14} color={colors.destructive} />
                              <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
                            </TouchableOpacity>

                            {/* Log Meal — green pill */}
                            <TouchableOpacity
                              style={styles.logMealBtn}
                              disabled={completeMeal.isPending}
                              onPress={() =>
                                Alert.alert(
                                  'Log Meal',
                                  'Mark this meal as eaten? This will deduct ingredients from your inventory and update your nutrition totals.',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Log Meal',
                                      onPress: () => completeMeal.mutate({ id: todayPlanSummary.id, mealId: meal.id }),
                                    },
                                  ]
                                )
                              }
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
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Regenerate entire plan */}
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
            </>
          )}

          {/* Plan exists but no meals yet (edge case) */}
          {todayPlanSummary && !loadingPlanDetail && !planMeals && (
            <TouchableOpacity
              style={styles.regeneratePlanBtn}
              onPress={handleGeneratePlan}
              disabled={generatingPlan}
            >
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary, marginLeft: 6 }}>
                Regenerate Plan
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Logged Meals Section ── */}
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
                      <MacroChip label="C" value={meal.totalCarbsG} color="#f59e0b" />
                      <MacroChip label="F" value={meal.totalFatG} color="#a78bfa" />
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

      {/* ── Meal Prep Modal ── */}
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
    generateBtn: {
      backgroundColor: colors.primary, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 12, marginTop: 4,
    },
    planTotals: {
      flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 10,
      justifyContent: 'space-around', alignItems: 'center',
    },
    planTotalNum: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    planTotalLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    planMealCard: {
      backgroundColor: colors.card, borderRadius: 12, marginBottom: 8,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    planMealHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    planMealIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    planMealName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    planMealMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 },
    completedBadge: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
      backgroundColor: '#22C55E20',
    },
    missingBadge: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    },
    expandedBody: {
      paddingHorizontal: 14, paddingBottom: 14,
      borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12,
    },
    subsectionLabel: {
      fontSize: 10, fontFamily: 'Inter_700Bold', color: colors.mutedForeground,
      letterSpacing: 0.8, marginBottom: 6,
    },
    ingredientRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 5,
    },
    ingredientDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
    ingredientName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    ingredientQty: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    missingCard: {
      borderRadius: 10, marginBottom: 12,
      borderWidth: 1, borderColor: colors.destructive + '30',
      backgroundColor: colors.destructive + '08', overflow: 'hidden',
    },
    missingCardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 9,
    },
    missingCardTitle: {
      fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.destructive,
    },
    missingIngRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 7,
      borderTopWidth: 1, borderTopColor: colors.destructive + '15',
    },
    missingIngName: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.foreground },
    missingIngQty: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginRight: 2 },
    missingIngBtn: {
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 60, alignItems: 'center',
    },
    missingIngBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
    actionRow: {
      flexDirection: 'row', gap: 6, alignItems: 'center',
    },
    actionBtn: {
      flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      paddingVertical: 8, borderRadius: 10,
      backgroundColor: colors.muted,
    },
    actionBtnText: {
      fontSize: 10, fontFamily: 'Inter_600SemiBold', color: colors.foreground,
    },
    logMealBtn: {
      flex: 1.8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      paddingVertical: 10, borderRadius: 10,
      backgroundColor: '#22C55E',
    },
    logMealBtnText: {
      fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff',
    },
    loggedState: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 12, borderRadius: 10,
      backgroundColor: '#22C55E15',
    },
    regeneratePlanBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, marginTop: 4,
      borderWidth: 1, borderColor: colors.primary + '60',
      backgroundColor: colors.primary + '10',
    },
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
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    itemName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground },
    itemDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
    deleteBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.destructive },
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
