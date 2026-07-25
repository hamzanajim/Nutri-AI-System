import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import {
  useGetDashboardToday,
  useCompleteMealPlanMeal,
  getGetDashboardTodayQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import MealPrepModal from '@/components/MealPrepModal';

const TODAY = new Date().toISOString().split('T')[0];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function MacroBar({ label, consumed, target, color }: { label: string; consumed: number; target: number; color: string }) {
  const colors = useColors();
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const remaining = Math.max(target - consumed, 0);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>{label}</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color }}>{Math.round(remaining)}g left</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' }}>
        <View style={{ height: 5, width: `${Math.round(pct * 100)}%`, borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}

function AlertCard({ icon, message, color, onAction, actionLabel }: {
  icon: keyof typeof Feather.glyphMap;
  message: string;
  color: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
      backgroundColor: color + '18', borderRadius: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: color }}>
      <Feather name={icon} size={16} color={color} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.foreground, lineHeight: 18 }}>
        {message}
      </Text>
      {onAction && actionLabel && (
        <TouchableOpacity onPress={onAction} style={{ marginLeft: 8 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [prepMeal, setPrepMeal] = useState<null | { id: number; name: string; planId: number; mealType: string; prepInstructions: string | null; cookingTimeMinutes: number | null; ingredients: { name: string; quantityG: number; unit: string }[] }>(null);

  const { data: dashboard, isRefetching, refetch, isLoading } = useGetDashboardToday(
    { date: TODAY },
    { query: { queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) } }
  );

  const completeMeal = useCompleteMealPlanMeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: TODAY }) });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const styles = makeStyles(colors, insets);
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;

  const nutrition = dashboard?.nutrition;
  const mealPlan = dashboard?.mealPlan;
  const supplements = dashboard?.supplements ?? [];
  const inventoryAlerts = dashboard?.inventoryAlerts ?? [];
  const freezerAlerts = dashboard?.freezerAlerts ?? [];

  const calPct = nutrition ? Math.min(nutrition.consumed / Math.max(nutrition.target, 1), 1) : 0;
  const calRemaining = nutrition ? Math.max(nutrition.target - nutrition.consumed, 0) : 0;

  const RING_SIZE = 120;
  const STROKE = 9;
  const R = (RING_SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + tabBarHeight + 20 }]}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {user?.email.split('@')[0] ?? 'there'} 👋</Text>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
      </View>

      {/* Nutrition Card */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          {/* Calorie Ring */}
          <View style={{ alignItems: 'center', justifyContent: 'center', width: RING_SIZE, height: RING_SIZE }}>
            <View style={{ width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              borderWidth: STROKE, borderColor: colors.muted, position: 'absolute' }} />
            <View style={{ width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
              borderWidth: STROKE, borderColor: 'transparent', borderTopColor: colors.primary, position: 'absolute',
              transform: [{ rotate: `${-90 + calPct * 360}deg` }],
              ...(calPct > 0.25 ? { borderRightColor: colors.primary } : {}),
              ...(calPct > 0.5 ? { borderBottomColor: colors.primary } : {}),
              ...(calPct > 0.75 ? { borderLeftColor: colors.primary } : {}),
            }} />
            <Text style={{ fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{Math.round(calRemaining)}</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>kcal left</Text>
          </View>

          {/* Macro bars */}
          <View style={{ flex: 1, gap: 8 }}>
            <MacroBar label="Protein" consumed={nutrition?.proteinConsumed ?? 0} target={nutrition?.proteinTarget ?? 150} color={colors.protein} />
            <MacroBar label="Carbs" consumed={nutrition?.carbsConsumed ?? 0} target={nutrition?.carbsTarget ?? 200} color={colors.carbs} />
            <MacroBar label="Fat" consumed={nutrition?.fatConsumed ?? 0} target={nutrition?.fatTarget ?? 65} color={colors.fat} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 14, gap: 0 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{Math.round(nutrition?.consumed ?? 0)}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>consumed</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{Math.round(nutrition?.target ?? 0)}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>target</Text>
          </View>
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: calRemaining === 0 ? colors.destructive : colors.primary }}>{Math.round(calRemaining)}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>remaining</Text>
          </View>
        </View>
      </View>

      {/* Freezer alerts */}
      {freezerAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>❄️ Freezer Prep</Text>
          {freezerAlerts.map((alert) => (
            <AlertCard key={alert.id} icon="alert-triangle" message={alert.message} color="#3B82F6" />
          ))}
        </View>
      )}

      {/* Today's Meal Plan */}
      {mealPlan ? (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>Today's Plan</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/meals')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary }}>Meals tab</Text>
              <Feather name="arrow-right" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {mealPlan.meals.map((meal) => (
            <View key={meal.id} style={[styles.mealCard, meal.completed && { opacity: 0.55 }]}>
              <View style={styles.mealCardHeader}>
                <View style={[styles.mealIcon, { backgroundColor: getMealColor(meal.mealType, colors) + '22' }]}>
                  <Feather name={getMealIcon(meal.mealType)} size={16} color={getMealColor(meal.mealType, colors)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                  <Text style={styles.mealMeta}>
                    {meal.mealType} {meal.scheduledTime ? `· ${meal.scheduledTime}` : ''} · {Math.round(meal.calories ?? 0)} kcal
                  </Text>
                </View>
                {meal.completed ? (
                  <View style={[styles.doneBtn, { backgroundColor: '#22C55E22' }]}>
                    <Feather name="check" size={14} color="#22C55E" />
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#22C55E', marginLeft: 4 }}>Done</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.prepBtn}
                      onPress={() => setPrepMeal({
                        id: meal.id,
                        name: meal.name,
                        planId: mealPlan.id,
                        mealType: meal.mealType,
                        prepInstructions: meal.prepInstructions ?? null,
                        cookingTimeMinutes: meal.cookingTimeMinutes ?? null,
                        ingredients: meal.ingredients,
                      })}
                    >
                      <Text style={{ fontSize: 12 }}>👨‍🍳</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.completeBtn}
                      disabled={completeMeal.isPending}
                      onPress={() =>
                        Alert.alert(
                          'Mark as Eaten?',
                          `This will deduct ingredients from your inventory and log the meal.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Yes, I ate this',
                              onPress: () => completeMeal.mutate({ id: mealPlan.id, mealId: meal.id }),
                            },
                          ]
                        )
                      }
                    >
                      <Feather name="check" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Ingredient availability warnings */}
              {meal.ingredients.filter((i) => !i.available).length > 0 && !meal.completed && (
                <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                  {meal.ingredients.filter((i) => !i.available).map((ing) => (
                    <View key={ing.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                      <Feather name="alert-circle" size={12} color={colors.destructive} />
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.destructive }}>
                        {ing.name} not available in inventory
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Plan</Text>
          <TouchableOpacity
            style={styles.generateCard}
            onPress={() => router.push('/(tabs)/meals')}
            activeOpacity={0.85}
          >
            <Feather name="cpu" size={28} color={colors.primary} />
            <Text style={styles.generateTitle}>No meal plan for today</Text>
            <Text style={styles.generateText}>Go to the Meals tab to generate an AI meal plan</Text>
            <View style={styles.generateBtn}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Generate My Meal Plan →</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Supplements today */}
      {supplements.filter((s) => s.reminderEnabled).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💊 Supplements Today</Text>
          {supplements.filter((s) => s.reminderEnabled).map((supp) => (
            <View key={supp.id} style={styles.supplementRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.supplementName}>{supp.name}</Text>
                <Text style={styles.supplementMeta}>
                  {supp.dose}{supp.unit} · {supp.frequency}
                  {supp.scheduleTimes.length > 0 ? ` · ${supp.scheduleTimes.join(', ')}` : ''}
                </Text>
              </View>
              {supp.daysRemaining != null && supp.daysRemaining <= 7 && (
                <View style={[styles.lowBadge, { backgroundColor: (supp.daysRemaining ?? 99) <= 3 ? colors.destructive + '22' : '#F59E0B22' }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: (supp.daysRemaining ?? 99) <= 3 ? colors.destructive : '#F59E0B' }}>
                    {supp.daysRemaining}d left
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Inventory Alerts */}
      {inventoryAlerts.length > 0 && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>⚠️ Alerts</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary }}>Inventory →</Text>
            </TouchableOpacity>
          </View>
          {inventoryAlerts.slice(0, 4).map((alert) => (
            <AlertCard
              key={`${alert.alertType}-${alert.id}`}
              icon={alert.alertType === 'expiring' ? 'clock' : alert.alertType === 'low' ? 'alert-triangle' : 'info'}
              message={alert.message}
              color={alert.alertType === 'expiring' ? '#F59E0B' : colors.destructive}
            />
          ))}
          {inventoryAlerts.length > 4 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/inventory')}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary, textAlign: 'center', paddingTop: 4 }}>
                +{inventoryAlerts.length - 4} more alerts →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Logged meals today */}
      {(dashboard?.loggedMeals ?? []).length > 0 && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>Logged Today</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/meals')}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary }}>All meals →</Text>
            </TouchableOpacity>
          </View>
          {dashboard!.loggedMeals.map((meal) => (
            <View key={meal.id} style={styles.loggedMealRow}>
              <Feather name={getMealIcon(meal.mealType)} size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }} numberOfLines={1}>{meal.name}</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.calories }}>{Math.round(meal.totalCalories)} kcal</Text>
            </View>
          ))}
        </View>
      )}

      {/* Meal Prep Modal */}
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
            setPrepMeal(null);
            router.push('/(tabs)/meals');
          }}
        />
      )}
    </ScrollView>
  );
}

function getMealIcon(mealType: string): keyof typeof Feather.glyphMap {
  switch (mealType) {
    case 'breakfast': return 'sunrise';
    case 'lunch': return 'sun';
    case 'dinner': return 'moon';
    default: return 'package';
  }
}

function getMealColor(mealType: string, colors: ReturnType<typeof useColors>) {
  switch (mealType) {
    case 'breakfast': return '#F59E0B';
    case 'lunch': return '#3B82F6';
    case 'dinner': return '#8B5CF6';
    default: return colors.primary;
  }
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20 },
    header: { paddingBottom: 16 },
    greeting: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground },
    dateText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 10 },
    mealCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mealCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    mealIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    mealName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    mealMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 },
    completeBtn: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    prepBtn: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: colors.muted,
      alignItems: 'center', justifyContent: 'center',
    },
    doneBtn: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    },
    generateCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      gap: 8,
    },
    generateTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginTop: 4 },
    generateText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' },
    generateBtn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },
    supplementRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10, paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 10, marginBottom: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    supplementName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    supplementMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    lowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    loggedMealRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10, paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 10, marginBottom: 6,
      borderWidth: 1, borderColor: colors.border,
    },
  });
}
