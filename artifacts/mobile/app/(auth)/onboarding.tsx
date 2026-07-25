import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCreateMyProfile } from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';

// ─── Types ────────────────────────────────────────────────────────────────────

type Gender = 'male' | 'female' | 'other';
type Goal = 'lose_fat' | 'maintain' | 'gain_muscle' | 'improve_health';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
type ShoppingFrequency = 'weekly' | 'biweekly' | 'monthly' | 'custom';

interface FormState {
  // Step 1 — Personal
  name: string;
  age: string;
  gender: Gender | null;
  heightUnit: 'cm' | 'ft';
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weightUnit: 'kg' | 'lbs';
  weightKg: string;
  weightLbs: string;

  // Step 2 — Goals
  goal: Goal | null;
  goalWeightKg: string;
  goalWeightLbs: string;

  // Step 3 — Activity
  activityLevel: ActivityLevel | null;
  gymSessions: number;
  workoutTypes: string[];

  // Step 4 — Health
  allergies: string[];
  foodIntolerances: string[];
  digestiveIssues: string[];
  healthConditions: string[];

  // Step 5 — Food Preferences
  dietStyle: string[];
  favoriteFoods: string[];
  foodsToAvoid: string[];
  favInput: string;
  avoidInput: string;
  mealsPerDay: number;
  shoppingFrequency: ShoppingFrequency | null;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const GOALS: { value: Goal; label: string; icon: keyof typeof Feather.glyphMap; desc: string; emoji: string }[] = [
  { value: 'lose_fat', label: 'Lose Fat', icon: 'trending-down', desc: 'Reduce body fat & get leaner', emoji: '🔥' },
  { value: 'gain_muscle', label: 'Build Muscle', icon: 'trending-up', desc: 'Increase lean mass & strength', emoji: '💪' },
  { value: 'maintain', label: 'Maintain Weight', icon: 'minus', desc: 'Stay at your current weight', emoji: '⚖️' },
  { value: 'improve_health', label: 'Improve Health', icon: 'heart', desc: 'Eat better, feel better', emoji: '❤️' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; desc: string; sessions: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little movement', sessions: '< 1×/week' },
  { value: 'lightly_active', label: 'Light', desc: 'Occasional walks or light activity', sessions: '1–3×/week' },
  { value: 'moderately_active', label: 'Moderate', desc: 'Regular gym or sport sessions', sessions: '3–5×/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Daily training or physical job', sessions: '6–7×/week' },
  { value: 'extremely_active', label: 'Elite', desc: 'Twice-daily training or athlete', sessions: '2×/day' },
];

const WORKOUT_TYPES = ['Weights', 'Cardio', 'Running', 'Cycling', 'Swimming', 'HIIT', 'Yoga', 'Sports', 'Martial Arts', 'Other'];

const ALLERGIES = ['Peanuts', 'Tree Nuts', 'Shellfish', 'Fish', 'Eggs', 'Milk', 'Wheat', 'Soy', 'Sesame', 'Mustard', 'Lupin', 'Molluscs', 'Other'];
const INTOLERANCES = ['Lactose', 'Gluten', 'Fructose', 'FODMAPs', 'Caffeine', 'Alcohol', 'Soy', 'Sulfites', 'Histamine', 'Other'];
const DIGESTIVE_ISSUES = ['Gas', 'Bloating', 'Acid Reflux', 'Constipation', 'Diarrhea', 'IBS', 'Cramps', 'Nausea', 'Other'];
const HEALTH_CONDITIONS = ['Type 1 Diabetes', 'Type 2 Diabetes', 'High Blood Pressure', 'High Cholesterol', 'Heart Disease', 'IBS', 'PCOS', 'Celiac Disease', 'Thyroid Issues', 'Other'];

const DIET_STYLES = ['No Restrictions', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Paleo', 'Mediterranean', 'Low-Carb', 'Low-Fat', 'Gluten-Free', 'Dairy-Free', 'Halal', 'Kosher'];

const SHOPPING_FREQ: { value: ShoppingFrequency; label: string; icon: keyof typeof Feather.glyphMap; desc: string }[] = [
  { value: 'weekly', label: 'Weekly', icon: 'calendar', desc: 'Once a week' },
  { value: 'biweekly', label: 'Every 2 Weeks', icon: 'clock', desc: 'Twice a month' },
  { value: 'monthly', label: 'Monthly', icon: 'archive', desc: 'Once a month' },
  { value: 'custom', label: 'Custom', icon: 'sliders', desc: 'It varies' },
];

const TOTAL_STEPS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ftInToCm(ft: string, inches: string): number {
  return (parseFloat(ft || '0') * 30.48) + (parseFloat(inches || '0') * 2.54);
}

function lbsToKg(lbs: string): number {
  return parseFloat(lbs || '0') * 0.453592;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 }}>
      {children}
    </Text>
  );
}

function ChipGrid({
  options,
  selected,
  onToggle,
  single = false,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggle(opt);
            }}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 100,
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.accent : colors.card,
            }}
          >
            <Text style={{ fontSize: 13, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular', color: active ? colors.primary : colors.mutedForeground }}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Stepper({ value, onChange, min = 0, max = 10, label }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.foreground, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <TouchableOpacity
          onPress={() => { if (value > min) { onChange(value - 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', opacity: value <= min ? 0.4 : 1 }}
        >
          <Feather name="minus" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.primary, minWidth: 28, textAlign: 'center' }}>{value}</Text>
        <TouchableOpacity
          onPress={() => { if (value < max) { onChange(value + 1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', opacity: value >= max ? 0.4 : 1 }}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TagInput({
  tags,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 4 }}>
      {tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {tags.map((tag) => (
            <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.primary + '40' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.primary }}>{tag}</Text>
              <TouchableOpacity onPress={() => onRemove(tag)}>
                <Feather name="x" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TextInput
          style={{ flex: 1, height: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.foreground, backgroundColor: colors.card }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={inputValue}
          onChangeText={onInputChange}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          onPress={onAdd}
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: inputValue.trim() ? 1 : 0.4 }}
          disabled={!inputValue.trim()}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UnitToggle({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 0, borderRadius: 8, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden', alignSelf: 'flex-start' }}>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt}
          onPress={() => { onChange(opt); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: value === opt ? colors.primary : colors.card, borderRightWidth: i < options.length - 1 ? 1 : 0, borderRightColor: colors.border }}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: value === opt ? '#fff' : colors.mutedForeground }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);

  const [form, setForm] = useState<FormState>({
    name: '', age: '', gender: null,
    heightUnit: 'cm', heightCm: '', heightFt: '', heightIn: '',
    weightUnit: 'kg', weightKg: '', weightLbs: '',
    goal: null, goalWeightKg: '', goalWeightLbs: '',
    activityLevel: null, gymSessions: 3, workoutTypes: [],
    allergies: [], foodIntolerances: [], digestiveIssues: [], healthConditions: [],
    dietStyle: [], favoriteFoods: [], foodsToAvoid: [],
    favInput: '', avoidInput: '',
    mealsPerDay: 3, shoppingFrequency: null,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle = (key: keyof FormState, item: string) => {
    const current = form[key] as string[];
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    setForm((f) => ({ ...f, [key]: next }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const createProfile = useCreateMyProfile({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(onboarding)/kitchen-welcome');
      },
    },
  });

  function animateTo(targetStep: number) {
    Animated.spring(progressAnim, {
      toValue: targetStep / (TOTAL_STEPS - 1),
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
  }

  function goNext() {
    if (step < TOTAL_STEPS - 1) {
      const next = step + 1;
      setStep(next);
      animateTo(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      handleSubmit();
    }
  }

  function goBack() {
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      animateTo(prev);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleSubmit() {
    const heightCmFinal =
      form.heightUnit === 'cm'
        ? parseFloat(form.heightCm) || null
        : ftInToCm(form.heightFt, form.heightIn) || null;

    const weightKgFinal =
      form.weightUnit === 'kg'
        ? parseFloat(form.weightKg) || null
        : lbsToKg(form.weightLbs) || null;

    const goalWeightFinal =
      form.goalWeightKg
        ? form.weightUnit === 'kg' ? parseFloat(form.goalWeightKg) : lbsToKg(form.goalWeightKg)
        : null;

    createProfile.mutate({
      data: {
        name: form.name || undefined,
        age: parseInt(form.age) || undefined,
        gender: form.gender ?? undefined,
        heightCm: heightCmFinal ?? undefined,
        weightKg: weightKgFinal ?? undefined,
        goalWeight: goalWeightFinal ?? undefined,
        fitnessGoal: form.goal ?? undefined,
        activityLevel: form.activityLevel ?? undefined,
        workoutFrequency: form.gymSessions,
        workoutTypes: form.workoutTypes,
        mealFrequency: form.mealsPerDay,
        shoppingFrequency: form.shoppingFrequency ?? undefined,
        dietPreferences: form.dietStyle,
        favoriteFoods: form.favoriteFoods,
        foodsToAvoid: form.foodsToAvoid,
        allergies: form.allergies,
        foodIntolerances: form.foodIntolerances,
        healthConditions: form.healthConditions,
        digestiveIssues: form.digestiveIssues,
      },
    });
  }

  const stepTitles = [
    'About You',
    'Your Goal',
    'Activity Level',
    'Health Profile',
    'Food Preferences',
  ];
  const stepSubtitles = [
    'Tell us about yourself so we can personalize your plan',
    'Choose what you want to achieve',
    'How active is your lifestyle?',
    'Help us work around any health considerations',
    'How and what do you like to eat?',
  ];

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const s = makeStyles(colors, insets);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.container}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerTop}>
            {step > 0 ? (
              <TouchableOpacity onPress={goBack} style={s.backBtn}>
                <Feather name="arrow-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
            ) : (
              <View style={s.backBtnPlaceholder} />
            )}
            <Text style={s.stepCounter}>{step + 1} of {TOTAL_STEPS}</Text>
            <View style={s.backBtnPlaceholder} />
          </View>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>

          <Text style={s.stepTitle}>{stepTitles[step]}</Text>
          <Text style={s.stepSub}>{stepSubtitles[step]}</Text>
        </View>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && <Step1Personal form={form} set={set} colors={colors} />}
          {step === 1 && <Step2Goals form={form} set={set} colors={colors} />}
          {step === 2 && <Step3Activity form={form} set={set} toggle={toggle} colors={colors} />}
          {step === 3 && <Step4Health form={form} toggle={toggle} />}
          {step === 4 && <Step5Food form={form} set={set} toggle={toggle} />}
        </ScrollView>

        {/* ── Bottom Nav ────────────────────────────────────────────────── */}
        <View style={[s.bottomNav, { paddingBottom: insets.bottom + 16 }]}>
          {step === TOTAL_STEPS - 1 ? (
            <TouchableOpacity
              style={[s.nextBtn, createProfile.isPending && { opacity: 0.7 }]}
              onPress={goNext}
              disabled={createProfile.isPending}
              activeOpacity={0.85}
            >
              {createProfile.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={s.nextBtnText}>Calculate My Plan</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={s.nextBtnText}>Continue</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          {step === 0 && (
            <TouchableOpacity onPress={() => { router.replace('/(tabs)'); }} style={s.skipBtn}>
              <Text style={s.skipText}>Skip setup for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Step 1: Personal Information ─────────────────────────────────────────────

function Step1Personal({ form, set, colors }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 20 }}>
      {/* Name */}
      <View>
        <SectionLabel>Full Name</SectionLabel>
        <TextInput
          style={inputStyle(colors)}
          placeholder="Your name"
          placeholderTextColor={colors.mutedForeground}
          value={form.name}
          onChangeText={(v) => set('name', v)}
          autoCapitalize="words"
        />
      </View>

      {/* Age */}
      <View>
        <SectionLabel>Age</SectionLabel>
        <TextInput
          style={[inputStyle(colors), { width: 100 }]}
          placeholder="Years"
          placeholderTextColor={colors.mutedForeground}
          value={form.age}
          onChangeText={(v) => set('age', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      {/* Gender */}
      <View>
        <SectionLabel>Gender</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {([['male', 'Male', '♂'], ['female', 'Female', '♀'], ['other', 'Other', '⚬']] as [Gender, string, string][]).map(([val, label, sym]) => (
            <TouchableOpacity
              key={val}
              onPress={() => { set('gender', val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={[genderCard(colors), form.gender === val && genderCardActive(colors)]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 22, marginBottom: 4 }}>{sym}</Text>
              <Text style={{ fontSize: 13, fontFamily: form.gender === val ? 'Inter_700Bold' : 'Inter_500Medium', color: form.gender === val ? colors.primary : colors.foreground }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Height */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionLabel>Height</SectionLabel>
          <UnitToggle value={form.heightUnit} options={['cm', 'ft']} onChange={(v) => set('heightUnit', v as 'cm' | 'ft')} />
        </View>
        {form.heightUnit === 'cm' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[inputStyle(colors), { width: 100 }]}
              placeholder="175"
              placeholderTextColor={colors.mutedForeground}
              value={form.heightCm}
              onChangeText={(v) => set('heightCm', v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
            />
            <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>cm</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[inputStyle(colors), { width: 70 }]}
              placeholder="5"
              placeholderTextColor={colors.mutedForeground}
              value={form.heightFt}
              onChangeText={(v) => set('heightFt', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
            <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>ft</Text>
            <TextInput
              style={[inputStyle(colors), { width: 70 }]}
              placeholder="9"
              placeholderTextColor={colors.mutedForeground}
              value={form.heightIn}
              onChangeText={(v) => set('heightIn', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>in</Text>
          </View>
        )}
      </View>

      {/* Weight */}
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionLabel>Weight</SectionLabel>
          <UnitToggle value={form.weightUnit} options={['kg', 'lbs']} onChange={(v) => set('weightUnit', v as 'kg' | 'lbs')} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={[inputStyle(colors), { width: 100 }]}
            placeholder={form.weightUnit === 'kg' ? '72' : '159'}
            placeholderTextColor={colors.mutedForeground}
            value={form.weightUnit === 'kg' ? form.weightKg : form.weightLbs}
            onChangeText={(v) => set(form.weightUnit === 'kg' ? 'weightKg' : 'weightLbs', v.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
          />
          <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>{form.weightUnit}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Step 2: Goals ────────────────────────────────────────────────────────────

function Step2Goals({ form, set, colors }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; colors: ReturnType<typeof useColors> }) {
  const showGoalWeight = form.goal === 'lose_fat' || form.goal === 'gain_muscle';

  return (
    <View style={{ gap: 12 }}>
      {GOALS.map((g) => (
        <TouchableOpacity
          key={g.value}
          onPress={() => { set('goal', g.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            padding: 18,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: form.goal === g.value ? colors.primary : colors.border,
            backgroundColor: form.goal === g.value ? colors.accent : colors.card,
          }}
        >
          <Text style={{ fontSize: 32 }}>{g.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: form.goal === g.value ? colors.primary : colors.foreground, marginBottom: 3 }}>
              {g.label}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
              {g.desc}
            </Text>
          </View>
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: form.goal === g.value ? colors.primary : colors.border, backgroundColor: form.goal === g.value ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {form.goal === g.value && <Feather name="check" size={14} color="#fff" />}
          </View>
        </TouchableOpacity>
      ))}

      {showGoalWeight && (
        <View style={{ marginTop: 8, padding: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border }}>
          <SectionLabel>Goal Weight (optional)</SectionLabel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={[inputStyle(colors), { width: 100 }]}
              placeholder={form.weightUnit === 'kg' ? 'e.g. 65' : 'e.g. 143'}
              placeholderTextColor={colors.mutedForeground}
              value={form.goalWeightKg}
              onChangeText={(v) => set('goalWeightKg', v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
            />
            <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>
              {form.weightUnit}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Step 3: Activity ─────────────────────────────────────────────────────────

function Step3Activity({ form, set, toggle, colors }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; toggle: (k: keyof FormState, v: string) => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: 24 }}>
      {/* Activity Level */}
      <View>
        <SectionLabel>Daily Activity Level</SectionLabel>
        <View style={{ gap: 8 }}>
          {ACTIVITY_LEVELS.map((a) => (
            <TouchableOpacity
              key={a.value}
              onPress={() => { set('activityLevel', a.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: form.activityLevel === a.value ? colors.primary : colors.border,
                backgroundColor: form.activityLevel === a.value ? colors.accent : colors.card,
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: form.activityLevel === a.value ? colors.primary : colors.foreground, marginBottom: 2 }}>
                  {a.label}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  {a.desc}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: form.activityLevel === a.value ? colors.primary + '20' : colors.secondary, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: form.activityLevel === a.value ? colors.primary : colors.mutedForeground }}>
                  {a.sessions}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Gym sessions stepper */}
      <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: colors.border }}>
        <SectionLabel>Gym Sessions Per Week</SectionLabel>
        <Stepper value={form.gymSessions} onChange={(v) => set('gymSessions', v)} min={0} max={14} label={`${form.gymSessions} session${form.gymSessions !== 1 ? 's' : ''}`} />
      </View>

      {/* Workout types */}
      <View>
        <SectionLabel>Workout Types (select all that apply)</SectionLabel>
        <ChipGrid
          options={WORKOUT_TYPES}
          selected={form.workoutTypes}
          onToggle={(v) => toggle('workoutTypes', v)}
        />
      </View>
    </View>
  );
}

// ─── Step 4: Health Profile ───────────────────────────────────────────────────

function Step4Health({ form, toggle }: { form: FormState; toggle: (k: keyof FormState, v: string) => void }) {
  const colors = useColors();
  return (
    <View style={{ gap: 24 }}>
      <View style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Feather name="shield" size={16} color={colors.primary} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.primary }}>
          This is optional but helps us keep your meal plans safe and personalized. All selections are private.
        </Text>
      </View>

      <View>
        <SectionLabel>Food Allergies</SectionLabel>
        <ChipGrid options={ALLERGIES} selected={form.allergies} onToggle={(v) => toggle('allergies', v)} />
      </View>

      <View>
        <SectionLabel>Food Intolerances</SectionLabel>
        <ChipGrid options={INTOLERANCES} selected={form.foodIntolerances} onToggle={(v) => toggle('foodIntolerances', v)} />
      </View>

      <View>
        <SectionLabel>Digestive Issues</SectionLabel>
        <ChipGrid options={DIGESTIVE_ISSUES} selected={form.digestiveIssues} onToggle={(v) => toggle('digestiveIssues', v)} />
      </View>

      <View>
        <SectionLabel>Medical Conditions</SectionLabel>
        <ChipGrid options={HEALTH_CONDITIONS} selected={form.healthConditions} onToggle={(v) => toggle('healthConditions', v)} />
      </View>
    </View>
  );
}

// ─── Step 5: Food Preferences ─────────────────────────────────────────────────

function Step5Food({ form, set, toggle }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void; toggle: (k: keyof FormState, v: string) => void }) {
  const colors = useColors();

  function addFavorite() {
    const val = form.favInput.trim();
    if (val && !form.favoriteFoods.includes(val)) {
      set('favoriteFoods', [...form.favoriteFoods, val]);
    }
    set('favInput', '');
  }

  function addAvoid() {
    const val = form.avoidInput.trim();
    if (val && !form.foodsToAvoid.includes(val)) {
      set('foodsToAvoid', [...form.foodsToAvoid, val]);
    }
    set('avoidInput', '');
  }

  return (
    <View style={{ gap: 24 }}>
      {/* Diet Style */}
      <View>
        <SectionLabel>Diet Style</SectionLabel>
        <ChipGrid
          options={DIET_STYLES}
          selected={form.dietStyle}
          onToggle={(v) => {
            // If selecting a specific diet and "No Restrictions" is present, remove it
            if (v !== 'No Restrictions' && form.dietStyle.includes('No Restrictions')) {
              set('dietStyle', [v]);
            } else if (v === 'No Restrictions') {
              set('dietStyle', ['No Restrictions']);
            } else {
              toggle('dietStyle', v);
            }
          }}
        />
      </View>

      {/* Favorite Foods */}
      <View>
        <SectionLabel>Favorite Foods (optional)</SectionLabel>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 8 }}>
          We'll try to include these in your meal plans
        </Text>
        <TagInput
          tags={form.favoriteFoods}
          inputValue={form.favInput}
          onInputChange={(v) => set('favInput', v)}
          onAdd={addFavorite}
          onRemove={(v) => set('favoriteFoods', form.favoriteFoods.filter((f) => f !== v))}
          placeholder="e.g. chicken, brown rice..."
        />
      </View>

      {/* Foods to Avoid */}
      <View>
        <SectionLabel>Foods to Avoid (optional)</SectionLabel>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 8 }}>
          Different from allergies — foods you simply dislike
        </Text>
        <TagInput
          tags={form.foodsToAvoid}
          inputValue={form.avoidInput}
          onInputChange={(v) => set('avoidInput', v)}
          onAdd={addAvoid}
          onRemove={(v) => set('foodsToAvoid', form.foodsToAvoid.filter((f) => f !== v))}
          placeholder="e.g. mushrooms, olives..."
        />
      </View>

      {/* Meals per day */}
      <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: colors.border }}>
        <SectionLabel>Meals Per Day</SectionLabel>
        <Stepper
          value={form.mealsPerDay}
          onChange={(v) => set('mealsPerDay', v)}
          min={1}
          max={8}
          label={`${form.mealsPerDay} meal${form.mealsPerDay !== 1 ? 's' : ''}`}
        />
      </View>

      {/* Shopping frequency */}
      <View>
        <SectionLabel>How Often Do You Shop?</SectionLabel>
        <View style={{ gap: 8 }}>
          {SHOPPING_FREQ.map((sf) => (
            <TouchableOpacity
              key={sf.value}
              onPress={() => { set('shoppingFrequency', sf.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: form.shoppingFrequency === sf.value ? colors.primary : colors.border,
                backgroundColor: form.shoppingFrequency === sf.value ? colors.accent : colors.card,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: form.shoppingFrequency === sf.value ? colors.primary : colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={sf.icon} size={16} color={form.shoppingFrequency === sf.value ? '#fff' : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: form.shoppingFrequency === sf.value ? colors.primary : colors.foreground }}>
                  {sf.label}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  {sf.desc}
                </Text>
              </View>
              {form.shoppingFrequency === sf.value && <Feather name="check-circle" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: 'Inter_400Regular' as const,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.card,
  };
}

function genderCard(colors: ReturnType<typeof useColors>) {
  return {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  };
}

function genderCardActive(colors: ReturnType<typeof useColors>) {
  return {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  };
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 24, paddingBottom: 16, backgroundColor: colors.background },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    backBtnPlaceholder: { width: 40 },
    stepCounter: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground },
    progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 20, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
    stepTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 6 },
    stepSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
    bottomNav: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
    nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, height: 56, borderRadius: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
    nextBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
    skipBtn: { alignItems: 'center', paddingVertical: 4 },
    skipText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
  });
}
