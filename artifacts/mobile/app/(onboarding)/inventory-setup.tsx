import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  useCreateInventoryItem,
  useSearchFoods,
  getSearchFoodsQueryKey,
  useSuggestNutrition,
  getListInventoryQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'protein' | 'carbs' | 'vegetables' | 'fruits' | 'dairy' | 'fats' | 'pantry' | 'supplements';
type StorageLocation = 'fridge' | 'freezer' | 'pantry';

interface SuggestedItem {
  name: string;
  defaultQty: number;
  unit: string;
  emoji: string;
  storageLocation: StorageLocation;
}

interface SelectedItem {
  name: string;
  qty: number;
  unit: string;
  storageLocation: StorageLocation;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
}

interface CategoryStep {
  key: Category;
  emoji: string;
  label: string;
  subtitle: string;
  color: string;
  suggestions: SuggestedItem[];
}

// ─── Category Definitions ─────────────────────────────────────────────────────

const CATEGORY_STEPS: CategoryStep[] = [
  {
    key: 'protein',
    emoji: '🥩',
    label: 'Protein',
    subtitle: 'Meat, fish, eggs & plant proteins for muscle and satiety',
    color: '#ef4444',
    suggestions: [
      { name: 'Chicken Breast', defaultQty: 500, unit: 'g', emoji: '🍗', storageLocation: 'fridge' },
      { name: 'Salmon Fillet', defaultQty: 300, unit: 'g', emoji: '🐟', storageLocation: 'freezer' },
      { name: 'Ground Beef', defaultQty: 500, unit: 'g', emoji: '🥩', storageLocation: 'fridge' },
      { name: 'Eggs', defaultQty: 12, unit: 'pieces', emoji: '🥚', storageLocation: 'fridge' },
      { name: 'Tuna', defaultQty: 3, unit: 'cans', emoji: '🐟', storageLocation: 'pantry' },
      { name: 'Greek Yogurt', defaultQty: 500, unit: 'g', emoji: '🥛', storageLocation: 'fridge' },
      { name: 'Tofu', defaultQty: 400, unit: 'g', emoji: '🧀', storageLocation: 'fridge' },
      { name: 'Turkey Breast', defaultQty: 400, unit: 'g', emoji: '🦃', storageLocation: 'freezer' },
    ],
  },
  {
    key: 'carbs',
    emoji: '🥔',
    label: 'Carbohydrates',
    subtitle: 'Grains, starches & legumes for sustained energy',
    color: '#f59e0b',
    suggestions: [
      { name: 'Brown Rice', defaultQty: 1000, unit: 'g', emoji: '🍚', storageLocation: 'pantry' },
      { name: 'Oats', defaultQty: 500, unit: 'g', emoji: '🌾', storageLocation: 'pantry' },
      { name: 'Sweet Potato', defaultQty: 500, unit: 'g', emoji: '🍠', storageLocation: 'pantry' },
      { name: 'Whole Wheat Pasta', defaultQty: 500, unit: 'g', emoji: '🍝', storageLocation: 'pantry' },
      { name: 'Quinoa', defaultQty: 500, unit: 'g', emoji: '🌱', storageLocation: 'pantry' },
      { name: 'Whole Grain Bread', defaultQty: 1, unit: 'loaf', emoji: '🍞', storageLocation: 'pantry' },
      { name: 'Lentils', defaultQty: 500, unit: 'g', emoji: '🫘', storageLocation: 'pantry' },
      { name: 'Chickpeas', defaultQty: 2, unit: 'cans', emoji: '🫘', storageLocation: 'pantry' },
    ],
  },
  {
    key: 'vegetables',
    emoji: '🥦',
    label: 'Vegetables',
    subtitle: 'Fresh and frozen vegetables for vitamins and fiber',
    color: '#22c55e',
    suggestions: [
      { name: 'Spinach', defaultQty: 200, unit: 'g', emoji: '🥬', storageLocation: 'fridge' },
      { name: 'Broccoli', defaultQty: 300, unit: 'g', emoji: '🥦', storageLocation: 'fridge' },
      { name: 'Bell Pepper', defaultQty: 3, unit: 'pieces', emoji: '🫑', storageLocation: 'fridge' },
      { name: 'Tomato', defaultQty: 6, unit: 'pieces', emoji: '🍅', storageLocation: 'fridge' },
      { name: 'Zucchini', defaultQty: 3, unit: 'pieces', emoji: '🥒', storageLocation: 'fridge' },
      { name: 'Carrots', defaultQty: 500, unit: 'g', emoji: '🥕', storageLocation: 'fridge' },
      { name: 'Mushrooms', defaultQty: 200, unit: 'g', emoji: '🍄', storageLocation: 'fridge' },
      { name: 'Cauliflower', defaultQty: 1, unit: 'pieces', emoji: '🥦', storageLocation: 'fridge' },
    ],
  },
  {
    key: 'fruits',
    emoji: '🍎',
    label: 'Fruits',
    subtitle: 'Fresh fruits for natural sugars, vitamins & antioxidants',
    color: '#f97316',
    suggestions: [
      { name: 'Banana', defaultQty: 6, unit: 'pieces', emoji: '🍌', storageLocation: 'pantry' },
      { name: 'Apple', defaultQty: 5, unit: 'pieces', emoji: '🍎', storageLocation: 'fridge' },
      { name: 'Blueberries', defaultQty: 250, unit: 'g', emoji: '🫐', storageLocation: 'fridge' },
      { name: 'Strawberries', defaultQty: 300, unit: 'g', emoji: '🍓', storageLocation: 'fridge' },
      { name: 'Orange', defaultQty: 4, unit: 'pieces', emoji: '🍊', storageLocation: 'fridge' },
      { name: 'Mango', defaultQty: 2, unit: 'pieces', emoji: '🥭', storageLocation: 'fridge' },
      { name: 'Avocado', defaultQty: 2, unit: 'pieces', emoji: '🥑', storageLocation: 'fridge' },
      { name: 'Raspberries', defaultQty: 200, unit: 'g', emoji: '🍓', storageLocation: 'fridge' },
    ],
  },
  {
    key: 'fats',
    emoji: '🥜',
    label: 'Healthy Fats',
    subtitle: 'Nuts, oils and seeds for hormones and brain health',
    color: '#a78bfa',
    suggestions: [
      { name: 'Olive Oil', defaultQty: 500, unit: 'ml', emoji: '🫒', storageLocation: 'pantry' },
      { name: 'Peanut Butter', defaultQty: 300, unit: 'g', emoji: '🥜', storageLocation: 'pantry' },
      { name: 'Almonds', defaultQty: 200, unit: 'g', emoji: '🌰', storageLocation: 'pantry' },
      { name: 'Walnuts', defaultQty: 200, unit: 'g', emoji: '🌰', storageLocation: 'pantry' },
      { name: 'Chia Seeds', defaultQty: 200, unit: 'g', emoji: '🌱', storageLocation: 'pantry' },
      { name: 'Almond Butter', defaultQty: 300, unit: 'g', emoji: '🥜', storageLocation: 'pantry' },
      { name: 'Coconut Oil', defaultQty: 300, unit: 'ml', emoji: '🥥', storageLocation: 'pantry' },
      { name: 'Flaxseeds', defaultQty: 200, unit: 'g', emoji: '🌱', storageLocation: 'pantry' },
    ],
  },
  {
    key: 'pantry',
    emoji: '🧂',
    label: 'Pantry & Condiments',
    subtitle: 'Staples, sauces and seasonings that complete meals',
    color: '#8b5cf6',
    suggestions: [
      { name: 'Soy Sauce', defaultQty: 250, unit: 'ml', emoji: '🧴', storageLocation: 'fridge' },
      { name: 'Honey', defaultQty: 340, unit: 'g', emoji: '🍯', storageLocation: 'pantry' },
      { name: 'Tomato Sauce', defaultQty: 3, unit: 'cans', emoji: '🥫', storageLocation: 'pantry' },
      { name: 'Diced Tomatoes', defaultQty: 3, unit: 'cans', emoji: '🥫', storageLocation: 'pantry' },
      { name: 'Coconut Milk', defaultQty: 2, unit: 'cans', emoji: '🥥', storageLocation: 'pantry' },
      { name: 'Apple Cider Vinegar', defaultQty: 500, unit: 'ml', emoji: '🍶', storageLocation: 'pantry' },
      { name: 'Bone Broth', defaultQty: 1, unit: 'L', emoji: '🍵', storageLocation: 'pantry' },
      { name: 'Garlic', defaultQty: 10, unit: 'cloves', emoji: '🧄', storageLocation: 'pantry' },
    ],
  },
  {
    key: 'supplements',
    emoji: '💊',
    label: 'Supplements',
    subtitle: 'Vitamins, minerals and performance supplements',
    color: '#ec4899',
    suggestions: [
      { name: 'Protein Powder', defaultQty: 1000, unit: 'g', emoji: '💪', storageLocation: 'pantry' },
      { name: 'Creatine', defaultQty: 300, unit: 'g', emoji: '⚡', storageLocation: 'pantry' },
      { name: 'Vitamin D', defaultQty: 90, unit: 'pieces', emoji: '☀️', storageLocation: 'pantry' },
      { name: 'Omega-3 Fish Oil', defaultQty: 90, unit: 'pieces', emoji: '🐟', storageLocation: 'pantry' },
      { name: 'Magnesium', defaultQty: 60, unit: 'pieces', emoji: '💊', storageLocation: 'pantry' },
      { name: 'Multivitamin', defaultQty: 30, unit: 'pieces', emoji: '💊', storageLocation: 'pantry' },
      { name: 'Collagen Peptides', defaultQty: 300, unit: 'g', emoji: '✨', storageLocation: 'pantry' },
      { name: 'BCAAs', defaultQty: 300, unit: 'g', emoji: '💪', storageLocation: 'pantry' },
    ],
  },
];

const TOTAL_STEPS = CATEGORY_STEPS.length;

// ─── Edit Item Modal ──────────────────────────────────────────────────────────

function EditItemModal({
  visible,
  item,
  onSave,
  onClose,
  colors,
}: {
  visible: boolean;
  item: SelectedItem | null;
  onSave: (updated: SelectedItem) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('g');
  const [storage, setStorage] = useState<StorageLocation>('fridge');

  React.useEffect(() => {
    if (item) {
      setQty(String(item.qty));
      setUnit(item.unit);
      setStorage(item.storageLocation);
    }
  }, [item]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: '#00000040' }} activeOpacity={1} onPress={onClose} />
        <View style={[{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }]}>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 20 }}>
            Edit — {item?.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', marginBottom: 6 }}>Quantity</Text>
              <TextInput
                style={{ height: 46, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground, backgroundColor: colors.background }}
                value={qty}
                onChangeText={(v) => setQty(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', marginBottom: 6 }}>Unit</Text>
              <TextInput
                style={{ height: 46, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground, backgroundColor: colors.background }}
                value={unit}
                onChangeText={setUnit}
              />
            </View>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', marginBottom: 8 }}>Storage</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {(['fridge', 'freezer', 'pantry'] as StorageLocation[]).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStorage(s)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', borderColor: storage === s ? colors.primary : colors.border, backgroundColor: storage === s ? colors.accent : colors.card }}
              >
                <Text style={{ fontSize: 12, fontFamily: storage === s ? 'Inter_700Bold' : 'Inter_400Regular', color: storage === s ? colors.primary : colors.mutedForeground }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              if (item) {
                onSave({ ...item, qty: parseFloat(qty) || item.qty, unit, storageLocation: storage });
                onClose();
              }
            }}
            style={{ height: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' }}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Custom Item Input ────────────────────────────────────────────────────────

const STORAGE_OPTIONS: { key: StorageLocation; label: string; emoji: string }[] = [
  { key: 'fridge', label: 'Fridge', emoji: '❄️' },
  { key: 'freezer', label: 'Freezer', emoji: '🧊' },
  { key: 'pantry', label: 'Pantry', emoji: '🗄️' },
];

function CustomItemInput({
  onAdd,
  colors,
}: {
  onAdd: (item: SelectedItem) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('g');
  const [storage, setStorage] = useState<StorageLocation>('pantry');
  const [showDropdown, setShowDropdown] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestMutation = useSuggestNutrition({ mutation: {} });

  const { data: foods = [] } = useSearchFoods(
    { q: debouncedQ, limit: 6 },
    { query: { queryKey: getSearchFoodsQueryKey({ q: debouncedQ, limit: 6 }), enabled: debouncedQ.length >= 2 } },
  );

  function handleNameChange(text: string) {
    setName(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length >= 2) {
      timerRef.current = setTimeout(() => {
        setDebouncedQ(text);
        setShowDropdown(true);
      }, 250);
    } else {
      setShowDropdown(false);
    }
  }

  async function handleSelectFood(foodName: string) {
    setName(foodName);
    setShowDropdown(false);
    try {
      const result = await suggestMutation.mutateAsync({ data: { name: foodName } });
      if (result.found && result.defaultUnit) setUnit(result.defaultUnit);
    } catch {}
  }

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      qty: parseFloat(qty) || 100,
      unit: unit || 'g',
      storageLocation: storage,
    });
    setName('');
    setQty('');
    setUnit('g');
    setStorage('pantry');
    setShowDropdown(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  return (
    <View style={{ marginTop: 8, gap: 10 }}>
      {/* Name + Qty + Unit row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, position: 'relative' }}>
          <TextInput
            style={{ height: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, backgroundColor: colors.card }}
            placeholder="Custom item name..."
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={handleNameChange}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {showDropdown && foods.length > 0 && (
            <View style={{ position: 'absolute', top: 50, left: 0, right: 0, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, zIndex: 99 }}>
              {foods.slice(0, 4).map((f, i) => (
                <TouchableOpacity
                  key={`${f.name}-${i}`}
                  onPress={() => handleSelectFood(f.name)}
                  style={{ padding: 12, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: colors.border }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <TextInput
          style={{ height: 44, width: 65, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 8, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, backgroundColor: colors.card, textAlign: 'center' }}
          placeholder="Qty"
          placeholderTextColor={colors.mutedForeground}
          value={qty}
          onChangeText={(v) => setQty(v.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={{ height: 44, width: 54, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 8, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, backgroundColor: colors.card, textAlign: 'center' }}
          placeholder="g"
          placeholderTextColor={colors.mutedForeground}
          value={unit}
          onChangeText={setUnit}
        />
      </View>

      {/* Storage location row */}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', marginRight: 2 }}>Store:</Text>
        {STORAGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setStorage(opt.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              paddingVertical: 8,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: storage === opt.key ? colors.primary : colors.border,
              backgroundColor: storage === opt.key ? colors.primary + '15' : colors.card,
            }}
          >
            <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
            <Text style={{ fontSize: 12, fontFamily: storage === opt.key ? 'Inter_700Bold' : 'Inter_400Regular', color: storage === opt.key ? colors.primary : colors.mutedForeground }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={handleAdd}
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: name.trim() ? 1 : 0.4 }}
          disabled={!name.trim()}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventorySetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  // Map of step index → selected items for that step
  const [stepSelections, setStepSelections] = useState<Map<number, Map<string, SelectedItem>>>(new Map());
  const [editingItem, setEditingItem] = useState<{ stepIdx: number; item: SelectedItem } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const createItem = useCreateInventoryItem({ mutation: {} });

  const currentStep = CATEGORY_STEPS[step];
  const currentSelections = stepSelections.get(step) ?? new Map<string, SelectedItem>();

  function getOrCreateMap(stepIdx: number): Map<string, SelectedItem> {
    return stepSelections.get(stepIdx) ?? new Map();
  }

  function setSelection(stepIdx: number, name: string, item: SelectedItem | null) {
    setStepSelections((prev) => {
      const next = new Map(prev);
      const stepMap = new Map(next.get(stepIdx) ?? new Map());
      if (item === null) {
        stepMap.delete(name);
      } else {
        stepMap.set(name, item);
      }
      next.set(stepIdx, stepMap);
      return next;
    });
  }

  function toggleSuggested(suggestion: SuggestedItem) {
    const name = suggestion.name;
    const existing = currentSelections.get(name);
    if (existing) {
      setSelection(step, name, null);
    } else {
      setSelection(step, name, {
        name: suggestion.name,
        qty: suggestion.defaultQty,
        unit: suggestion.unit,
        storageLocation: suggestion.storageLocation,
      });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function addCustom(item: SelectedItem) {
    setSelection(step, item.name, item);
  }

  function removeItem(name: string) {
    setSelection(step, name, null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function openEdit(item: SelectedItem) {
    setEditingItem({ stepIdx: step, item });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function saveEdit(updated: SelectedItem) {
    if (editingItem) {
      // Remove old key if name changed
      if (editingItem.item.name !== updated.name) {
        setSelection(editingItem.stepIdx, editingItem.item.name, null);
      }
      setSelection(editingItem.stepIdx, updated.name, updated);
    }
    setEditingItem(null);
  }

  function goNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      handleFinish();
    }
  }

  function goBack() {
    if (step > 0) {
      setStep((s) => s - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  async function handleFinish() {
    // Collect all items from all steps
    const allItems: Array<{ category: string; item: SelectedItem }> = [];
    stepSelections.forEach((itemMap, stepIdx) => {
      const cat = CATEGORY_STEPS[stepIdx];
      itemMap.forEach((item) => {
        allItems.push({ category: cat.key, item });
      });
    });

    if (allItems.length === 0) {
      router.replace('/(tabs)/inventory');
      return;
    }

    setIsSaving(true);
    try {
      const mutations = allItems.map(({ category, item }) =>
        createItem.mutateAsync({
          data: {
            name: item.name,
            category: category as 'protein' | 'carbs' | 'vegetables' | 'fruits' | 'dairy' | 'fats' | 'pantry' | 'drinks' | 'supplements',
            quantity: item.qty,
            unit: item.unit,
            storageLocation: item.storageLocation as 'fridge' | 'freezer' | 'pantry',
            caloriesPer100g: item.caloriesPer100g,
            proteinPer100g: item.proteinPer100g,
            carbsPer100g: item.carbsPer100g,
            fatPer100g: item.fatPer100g,
          },
        }),
      );
      await Promise.allSettled(mutations);
      qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Best-effort
    } finally {
      setIsSaving(false);
      router.replace('/(tabs)/inventory');
    }
  }

  const totalSelected = Array.from(stepSelections.values()).reduce((acc, m) => acc + m.size, 0);
  const stepSelected = currentSelections.size;
  const progress = (step / (TOTAL_STEPS - 1));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          {step > 0 ? (
            <TouchableOpacity onPress={goBack} style={[styles.navBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          ) : <View style={styles.navBtn} />}

          <Text style={[styles.stepCounter, { color: colors.mutedForeground }]}>{step + 1} of {TOTAL_STEPS}</Text>

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/inventory')}
            style={[styles.skipTextBtn]}
          >
            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground }}>Skip all</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: currentStep.color, width: `${Math.round(((step + 1) / TOTAL_STEPS) * 100)}%` }]} />
        </View>

        {/* Category info */}
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryEmojiBg, { backgroundColor: currentStep.color + '18' }]}>
            <Text style={{ fontSize: 32 }}>{currentStep.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.categoryTitle, { color: colors.foreground }]}>{currentStep.label}</Text>
            <Text style={[styles.categorySubtitle, { color: colors.mutedForeground }]}>{currentStep.subtitle}</Text>
          </View>
        </View>
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Selected items (shown at top if any) */}
        {stepSelected > 0 && (
          <View style={[styles.selectedSection, { backgroundColor: currentStep.color + '10', borderColor: currentStep.color + '30' }]}>
            <Text style={[styles.selectedLabel, { color: currentStep.color }]}>
              {stepSelected} item{stepSelected !== 1 ? 's' : ''} selected
            </Text>
            {Array.from(currentSelections.values()).map((item) => (
              <View key={item.name} style={[styles.selectedRow, { borderBottomColor: currentStep.color + '20' }]}>
                <Text style={[styles.selectedName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.selectedQty, { color: currentStep.color }]}>{item.qty} {item.unit}</Text>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.selectedAction}>
                  <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeItem(item.name)} style={styles.selectedAction}>
                  <Feather name="x" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Suggested items grid */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SUGGESTED FOR YOU</Text>
        <View style={styles.suggestionsGrid}>
          {currentStep.suggestions.map((suggestion) => {
            const selected = currentSelections.has(suggestion.name);
            return (
              <TouchableOpacity
                key={suggestion.name}
                onPress={() => toggleSuggested(suggestion)}
                activeOpacity={0.8}
                style={[
                  styles.suggestionCard,
                  { backgroundColor: colors.card, borderColor: selected ? currentStep.color : colors.border },
                  selected && { backgroundColor: currentStep.color + '10' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 24 }}>{suggestion.emoji}</Text>
                  <View style={[
                    styles.checkCircle,
                    { borderColor: selected ? currentStep.color : colors.border, backgroundColor: selected ? currentStep.color : 'transparent' },
                  ]}>
                    {selected && <Feather name="check" size={12} color="#fff" />}
                  </View>
                </View>
                <Text style={[styles.suggestionName, { color: selected ? currentStep.color : colors.foreground }]} numberOfLines={2}>
                  {suggestion.name}
                </Text>
                <Text style={[styles.suggestionQty, { color: colors.mutedForeground }]}>
                  {suggestion.defaultQty} {suggestion.unit} · {suggestion.storageLocation}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom item input */}
        <View style={[styles.customSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Feather name="plus-circle" size={16} color={colors.primary} />
            <Text style={[styles.sectionLabel, { color: colors.primary, marginBottom: 0 }]}>ADD CUSTOM ITEM</Text>
          </View>
          <CustomItemInput onAdd={addCustom} colors={colors} />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom Nav ────────────────────────────────────────────────── */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        {totalSelected > 0 && (
          <Text style={[styles.totalBadge, { color: colors.primary }]}>
            {totalSelected} item{totalSelected !== 1 ? 's' : ''} in total
          </Text>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: currentStep.color, opacity: isSaving ? 0.7 : 1 }]}
          onPress={goNext}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : step === TOTAL_STEPS - 1 ? (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.nextBtnText}>Save & Open Inventory</Text>
            </>
          ) : (
            <>
              <Text style={styles.nextBtnText}>
                {stepSelected > 0 ? `Continue with ${stepSelected} item${stepSelected !== 1 ? 's' : ''}` : 'Skip this category'}
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Edit modal */}
      <EditItemModal
        visible={editingItem !== null}
        item={editingItem?.item ?? null}
        onSave={saveEdit}
        onClose={() => setEditingItem(null)}
        colors={colors}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  skipTextBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  stepCounter: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  progressTrack: { height: 4, borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },

  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  categoryEmojiBg: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  categoryTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  categorySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  selectedSection: { borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 20 },
  selectedLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  selectedName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  selectedQty: { fontSize: 13, fontFamily: 'Inter_700Bold', marginRight: 8 },
  selectedAction: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  suggestionCard: {
    width: '47.5%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  suggestionName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  suggestionQty: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  customSection: { borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 8 },

  bottomNav: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, gap: 8 },
  totalBadge: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 16 },
  nextBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
