import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useGetDailyNutrition,
  useGetNutritionTargets,
  useListMeals,
} from '@workspace/api-client-react';

const TODAY = new Date().toISOString().split('T')[0];

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(value / Math.max(target, 1), 1);
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>{label}</Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color }}>{Math.round(value)}g</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.round(pct * 100)}%`, borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const colors = useColors();
  const pct = Math.min(consumed / Math.max(target, 1), 1);
  const remaining = Math.max(target - consumed, 0);
  const SIZE = 140;
  const STROKE = 10;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dash = pct * CIRC;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: SIZE, height: SIZE }}>
      {/* SVG-like ring using absolute positioned views */}
      <View style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderWidth: STROKE, borderColor: colors.muted,
        position: 'absolute',
      }} />
      <View style={{
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        borderWidth: STROKE,
        borderColor: 'transparent',
        borderTopColor: colors.primary,
        position: 'absolute',
        transform: [{ rotate: `${-90 + pct * 360}deg` }],
        ...(pct > 0.25 ? { borderRightColor: colors.primary } : {}),
        ...(pct > 0.5 ? { borderBottomColor: colors.primary } : {}),
        ...(pct > 0.75 ? { borderLeftColor: colors.primary } : {}),
      }} />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.foreground }}>
          {Math.round(remaining)}
        </Text>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>
          kcal left
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: nutrition, refetch: refetchNutrition, isLoading: loadingNutrition } =
    useGetDailyNutrition({ date: TODAY });
  const { data: targets } = useGetNutritionTargets();
  const { data: meals, refetch: refetchMeals, isRefetching } = useListMeals({ date: TODAY });

  const isRefreshing = isRefetching;
  const onRefresh = () => { refetchNutrition(); refetchMeals(); };

  const consumed = nutrition?.totalCalories ?? 0;
  const target = targets?.dailyCalories ?? 2000;
  const styles = makeStyles(colors, insets);

  const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Good {getTimeOfDay()}, {user?.email.split('@')[0] ?? 'there'} 👋
          </Text>
          <Text style={styles.dateText}>{formatDate(new Date())}</Text>
        </View>
        <View style={styles.streakBadge}>
          <Feather name="zap" size={14} color={colors.primary} />
          <Text style={styles.streakText}>Today</Text>
        </View>
      </View>

      {/* Calorie Ring Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Calories</Text>
        <View style={styles.ringRow}>
          <CalorieRing consumed={consumed} target={target} />
          <View style={{ flex: 1, gap: 14, marginLeft: 24 }}>
            <StatItem label="Consumed" value={Math.round(consumed)} unit="kcal" color={colors.calories} />
            <StatItem label="Target" value={Math.round(target)} unit="kcal" color={colors.primary} />
            <StatItem
              label="BMR"
              value={targets?.bmr ? Math.round(targets.bmr) : 0}
              unit="kcal"
              color={colors.mutedForeground}
            />
          </View>
        </View>

        {/* Macro bars */}
        {nutrition && targets ? (
          <View style={{ marginTop: 20, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <MacroBar
                label="Protein"
                value={nutrition.totalProteinG}
                target={targets.proteinG}
                color={colors.protein}
              />
              <MacroBar
                label="Carbs"
                value={nutrition.totalCarbsG}
                target={targets.carbsG}
                color={colors.carbs}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <MacroBar
                label="Fat"
                value={nutrition.totalFatG}
                target={targets.fatG}
                color={colors.fat}
              />
              <MacroBar
                label="Fiber"
                value={nutrition.totalFiberG}
                target={targets.fiberG}
                color={colors.fiber}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Today's Meals */}
      <Text style={styles.sectionTitle}>Today's Meals</Text>
      {loadingNutrition ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : !meals || meals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="coffee" size={32} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>No meals logged yet</Text>
          <Text style={styles.emptyText}>Go to the Meals tab to log your first meal</Text>
        </View>
      ) : (
        [...meals]
          .sort((a, b) => (mealTypeOrder[a.mealType] ?? 99) - (mealTypeOrder[b.mealType] ?? 99))
          .map((meal) => (
            <View key={meal.id} style={styles.mealCard}>
              <View style={styles.mealIconWrap}>
                <Feather name={mealIcon(meal.mealType)} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealSub}>
                  {meal.items.length} item{meal.items.length !== 1 ? 's' : ''} · {meal.mealType}
                </Text>
              </View>
              <Text style={styles.mealCal}>{Math.round(meal.totalCalories)} kcal</Text>
            </View>
          ))
      )}
    </ScrollView>
  );
}

function StatItem({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color }}>
        {value} <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{unit}</Text>
      </Text>
    </View>
  );
}

function mealIcon(type: string): keyof typeof Feather.glyphMap {
  const map: Record<string, keyof typeof Feather.glyphMap> = {
    breakfast: 'sunrise',
    lunch: 'sun',
    dinner: 'moon',
    snack: 'package',
  };
  return map[type] ?? 'coffee';
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: insets.bottom + tabBarHeight + 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    greeting: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground },
    dateText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
    streakText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    cardTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 16 },
    ringRow: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 12 },
    emptyCard: { alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 16, padding: 32 },
    emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center' },
    mealCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    mealIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    mealName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 2 },
    mealSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    mealCal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.calories },
  });
}
