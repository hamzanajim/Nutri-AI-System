import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import {
  useListInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useSearchFoods,
  getSearchFoodsQueryKey,
  useSuggestNutrition,
  getListInventoryQueryKey,
  getGetDashboardTodayQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

type Category = 'protein' | 'carbs' | 'vegetables' | 'fruits' | 'dairy' | 'fats' | 'pantry' | 'drinks' | 'supplements';
type StorageLocation = 'fridge' | 'freezer' | 'pantry';

interface CategoryMeta {
  key: Category;
  emoji: string;
  label: string;
  color: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'protein', emoji: '🥩', label: 'Protein', color: '#ef4444' },
  { key: 'carbs', emoji: '🥔', label: 'Carbohydrates', color: '#f59e0b' },
  { key: 'vegetables', emoji: '🥦', label: 'Vegetables', color: '#22c55e' },
  { key: 'fruits', emoji: '🍎', label: 'Fruits', color: '#f97316' },
  { key: 'dairy', emoji: '🥛', label: 'Dairy', color: '#60a5fa' },
  { key: 'fats', emoji: '🥜', label: 'Healthy Fats', color: '#a78bfa' },
  { key: 'pantry', emoji: '🧂', label: 'Pantry', color: '#8b5cf6' },
  { key: 'drinks', emoji: '🥤', label: 'Drinks', color: '#06b6d4' },
  { key: 'supplements', emoji: '💊', label: 'Supplements', color: '#ec4899' },
];

const STORAGE_LOCATIONS: { key: StorageLocation; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'fridge', icon: 'thermometer', label: 'Fridge' },
  { key: 'freezer', icon: 'wind', label: 'Freezer' },
  { key: 'pantry', icon: 'archive', label: 'Pantry' },
];

const UNITS = ['g', 'kg', 'ml', 'L', 'pieces', 'servings', 'oz', 'lbs', 'cups', 'tbsp', 'tsp', 'cans', 'slices', 'cloves', 'scoops'];

const getCategoryMeta = (key: string | null | undefined): CategoryMeta =>
  CATEGORIES.find((c) => c.key === key) ?? { key: 'pantry' as Category, emoji: '📦', label: 'Other', color: '#6b7280' };

// ─── Expiry helpers ────────────────────────────────────────────────────────────

function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryColor(days: number | null, colors: ReturnType<typeof useColors>): string {
  if (days === null) return 'transparent';
  if (days <= 0) return '#ef4444';
  if (days <= 3) return '#f97316';
  if (days <= 7) return '#f59e0b';
  return colors.mutedForeground;
}

function expiryLabel(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days}d`;
}

// ─── Item Card ────────────────────────────────────────────────────────────────

interface InventoryItemData {
  id: number;
  name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  storageLocation?: string | null;
  expirationDate?: string | null;
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  notes?: string | null;
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  onMarkFinished,
  colors,
}: {
  item: InventoryItemData;
  onEdit: () => void;
  onDelete: () => void;
  onMarkFinished: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const meta = getCategoryMeta(item.category);
  const days = daysUntilExpiry(item.expirationDate);
  const expColor = expiryColor(days, colors);
  const hasNutrition = item.caloriesPer100g != null;
  const [showActions, setShowActions] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handleLongPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    setShowActions(true);
  }

  return (
    <>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onEdit}
          onLongPress={handleLongPress}
          activeOpacity={0.85}
          style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {/* Left: category emoji */}
          <View style={[styles.itemEmoji, { backgroundColor: meta.color + '18' }]}>
            <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
          </View>

          {/* Center: name + meta */}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {item.storageLocation && (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Feather
                    name={STORAGE_LOCATIONS.find((s) => s.key === item.storageLocation)?.icon ?? 'archive'}
                    size={10}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                    {item.storageLocation.charAt(0).toUpperCase() + item.storageLocation.slice(1)}
                  </Text>
                </View>
              )}
              {days !== null && (
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: expColor }}>
                  {expiryLabel(days)}
                </Text>
              )}
            </View>
            {hasNutrition && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={[styles.macroText, { color: colors.mutedForeground }]}>
                  {Math.round(item.caloriesPer100g!)} kcal
                </Text>
                <Text style={[styles.macroText, { color: '#ef4444' }]}>
                  P {item.proteinPer100g?.toFixed(1)}g
                </Text>
                <Text style={[styles.macroText, { color: '#f59e0b' }]}>
                  C {item.carbsPer100g?.toFixed(1)}g
                </Text>
                <Text style={[styles.macroText, { color: '#a78bfa' }]}>
                  F {item.fatPer100g?.toFixed(1)}g
                </Text>
              </View>
            )}
          </View>

          {/* Right: quantity */}
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[styles.quantity, { color: meta.color }]}>
              {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)}
            </Text>
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>{item.unit}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Actions overlay */}
      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.actionsOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={[styles.actionsMenu, { backgroundColor: colors.card, shadowColor: '#000' }]}>
            <Text style={[styles.actionsTitle, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            {[
              { icon: 'edit-2' as const, label: 'Edit Item', color: colors.foreground, action: () => { setShowActions(false); onEdit(); } },
              { icon: 'check-circle' as const, label: 'Mark as Finished', color: '#22c55e', action: () => { setShowActions(false); onMarkFinished(); } },
              { icon: 'trash-2' as const, label: 'Delete', color: '#ef4444', action: () => { setShowActions(false); onDelete(); } },
            ].map((opt) => (
              <TouchableOpacity key={opt.label} onPress={opt.action} style={styles.actionRow}>
                <Feather name={opt.icon} size={18} color={opt.color} />
                <Text style={[styles.actionLabel, { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Food Autocomplete ────────────────────────────────────────────────────────

function FoodAutocomplete({
  value,
  onChange,
  onSelect,
  colors,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (name: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: foods = [], isLoading } = useSearchFoods(
    { q: debouncedQ, limit: 8 },
    { query: { queryKey: getSearchFoodsQueryKey({ q: debouncedQ, limit: 8 }), enabled: debouncedQ.length >= 2 } },
  );

  function handleChange(text: string) {
    onChange(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length >= 2) {
      timerRef.current = setTimeout(() => {
        setDebouncedQ(text);
        setShowDropdown(true);
      }, 250);
    } else {
      setShowDropdown(false);
      setDebouncedQ('');
    }
  }

  return (
    <View>
      <View style={[inputRow(colors), { flexDirection: 'row', alignItems: 'center' }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground }}
          placeholder="e.g. Chicken Breast"
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={handleChange}
          autoCapitalize="words"
          returnKeyType="done"
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onFocus={() => { if (debouncedQ.length >= 2) setShowDropdown(true); }}
        />
        {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {showDropdown && foods.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: '#000' }]}>
          {foods.map((food, i) => (
            <TouchableOpacity
              key={`${food.name}-${i}`}
              onPress={() => {
                onSelect(food.name);
                setShowDropdown(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[styles.dropdownItem, i < foods.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{food.name}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                {food.caloriesPer100g} kcal · {food.proteinPer100g}g P
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

interface ItemForm {
  name: string;
  category: Category | '';
  quantity: string;
  unit: string;
  storageLocation: StorageLocation | '';
  expirationDate: string;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  notes: string;
}

const emptyForm = (): ItemForm => ({
  name: '', category: '', quantity: '', unit: 'g',
  storageLocation: '', expirationDate: '',
  caloriesPer100g: '', proteinPer100g: '', carbsPer100g: '', fatPer100g: '',
  notes: '',
});

function itemToForm(item: InventoryItemData): ItemForm {
  return {
    name: item.name,
    category: (item.category as Category) ?? '',
    quantity: String(item.quantity),
    unit: item.unit,
    storageLocation: (item.storageLocation as StorageLocation) ?? '',
    expirationDate: item.expirationDate ?? '',
    caloriesPer100g: item.caloriesPer100g != null ? String(item.caloriesPer100g) : '',
    proteinPer100g: item.proteinPer100g != null ? String(item.proteinPer100g) : '',
    carbsPer100g: item.carbsPer100g != null ? String(item.carbsPer100g) : '',
    fatPer100g: item.fatPer100g != null ? String(item.fatPer100g) : '',
    notes: item.notes ?? '',
  };
}

function AddEditModal({
  visible,
  item,
  onClose,
  onSave,
  onDelete,
  colors,
  insets,
}: {
  visible: boolean;
  item: InventoryItemData | null;
  onClose: () => void;
  onSave: (form: ItemForm) => void;
  onDelete?: () => void;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const isEdit = item !== null;
  const [form, setForm] = useState<ItemForm>(emptyForm());
  const [isSuggestingNutrition, setIsSuggestingNutrition] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const suggestMutation = useSuggestNutrition({ mutation: {} });

  React.useEffect(() => {
    if (visible) {
      setForm(item ? itemToForm(item) : emptyForm());
    }
  }, [visible, item]);

  const set = (key: keyof ItemForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSuggestNutrition() {
    if (!form.name.trim()) return;
    setIsSuggestingNutrition(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await suggestMutation.mutateAsync({ data: { name: form.name.trim() } });
      if (result.found) {
        setForm((f) => ({
          ...f,
          caloriesPer100g: result.caloriesPer100g != null ? String(result.caloriesPer100g) : f.caloriesPer100g,
          proteinPer100g: result.proteinPer100g != null ? String(result.proteinPer100g) : f.proteinPer100g,
          carbsPer100g: result.carbsPer100g != null ? String(result.carbsPer100g) : f.carbsPer100g,
          fatPer100g: result.fatPer100g != null ? String(result.fatPer100g) : f.fatPer100g,
          category: (result.category as Category) ?? f.category,
          unit: result.defaultUnit ?? f.unit,
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Not Found', 'No nutritional data found for this food. Please fill in manually.');
      }
    } catch {
      Alert.alert('Error', 'Could not suggest nutrition. Please fill in manually.');
    } finally {
      setIsSuggestingNutrition(false);
    }
  }

  function handleSelectFood(name: string) {
    set('name', name);
    // Auto-suggest nutrition when food is selected from autocomplete
    setForm((f) => {
      setTimeout(() => {
        suggestMutation.mutateAsync({ data: { name } }).then((result) => {
          if (result.found) {
            setForm((prev) => ({
              ...prev,
              caloriesPer100g: result.caloriesPer100g != null ? String(result.caloriesPer100g) : prev.caloriesPer100g,
              proteinPer100g: result.proteinPer100g != null ? String(result.proteinPer100g) : prev.proteinPer100g,
              carbsPer100g: result.carbsPer100g != null ? String(result.carbsPer100g) : prev.carbsPer100g,
              fatPer100g: result.fatPer100g != null ? String(result.fatPer100g) : prev.fatPer100g,
              category: (result.category as Category) ?? prev.category,
              unit: result.defaultUnit ?? prev.unit,
            }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }).catch(() => {});
      }, 0);
      return f;
    });
  }

  const isValid = form.name.trim() && form.quantity && parseFloat(form.quantity) > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>

          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalHeaderBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {isEdit ? 'Edit Item' : 'Add Item'}
            </Text>
            <TouchableOpacity
              onPress={() => isValid && onSave(form)}
              disabled={!isValid}
              style={[styles.modalSaveBtn, { backgroundColor: colors.primary, opacity: isValid ? 1 : 0.4 }]}
            >
              <Text style={styles.modalSaveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Name with autocomplete */}
            <SectionLabel label="Food Name" colors={colors} />
            <FoodAutocomplete
              value={form.name}
              onChange={(v) => set('name', v)}
              onSelect={handleSelectFood}
              colors={colors}
            />

            {/* Suggest nutrition button */}
            <TouchableOpacity
              onPress={handleSuggestNutrition}
              disabled={!form.name.trim() || isSuggestingNutrition}
              style={[styles.suggestBtn, { borderColor: colors.primary, opacity: form.name.trim() ? 1 : 0.4 }]}
            >
              {isSuggestingNutrition ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="zap" size={14} color={colors.primary} />
              )}
              <Text style={[styles.suggestBtnText, { color: colors.primary }]}>
                {isSuggestingNutrition ? 'Suggesting...' : 'Auto-suggest nutrition'}
              </Text>
            </TouchableOpacity>

            {/* Category */}
            <SectionLabel label="Category" colors={colors} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => { set('category', cat.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[
                      styles.categoryChip,
                      { borderColor: form.category === cat.key ? cat.color : colors.border, backgroundColor: form.category === cat.key ? cat.color + '18' : colors.card },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                    <Text style={{ fontSize: 12, fontFamily: form.category === cat.key ? 'Inter_700Bold' : 'Inter_400Regular', color: form.category === cat.key ? cat.color : colors.mutedForeground }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Quantity + Unit */}
            <SectionLabel label="Quantity & Unit" colors={colors} />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TextInput
                style={[inputRow(colors), { flex: 1, fontSize: 16, fontFamily: 'Inter_500Medium', color: colors.foreground }]}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                value={form.quantity}
                onChangeText={(v) => set('quantity', v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                onPress={() => setShowUnitPicker(true)}
                style={[inputRow(colors), { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
              >
                <Text style={{ fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{form.unit}</Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Storage Location */}
            <SectionLabel label="Storage Location" colors={colors} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {STORAGE_LOCATIONS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => { set('storageLocation', s.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[
                    styles.storageChip,
                    { borderColor: form.storageLocation === s.key ? colors.primary : colors.border, backgroundColor: form.storageLocation === s.key ? colors.accent : colors.card },
                  ]}
                >
                  <Feather name={s.icon} size={16} color={form.storageLocation === s.key ? colors.primary : colors.mutedForeground} />
                  <Text style={{ fontSize: 13, fontFamily: form.storageLocation === s.key ? 'Inter_600SemiBold' : 'Inter_400Regular', color: form.storageLocation === s.key ? colors.primary : colors.mutedForeground }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Expiration date */}
            <SectionLabel label="Expiration Date (optional)" colors={colors} />
            <TextInput
              style={[inputRow(colors), { marginBottom: 16, color: colors.foreground }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              value={form.expirationDate}
              onChangeText={(v) => set('expirationDate', v)}
              keyboardType="numbers-and-punctuation"
            />

            {/* Nutrition per 100g */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionLabel label="Nutrition per 100g" colors={colors} />
            </View>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {[
                { key: 'caloriesPer100g' as const, label: 'Calories (kcal)', color: '#6b7280' },
                { key: 'proteinPer100g' as const, label: 'Protein (g)', color: '#ef4444' },
                { key: 'carbsPer100g' as const, label: 'Carbohydrates (g)', color: '#f59e0b' },
                { key: 'fatPer100g' as const, label: 'Fat (g)', color: '#a78bfa' },
              ].map((field) => (
                <View key={field.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: field.color }} />
                  <TextInput
                    style={[inputRow(colors), { flex: 1, color: colors.foreground }]}
                    placeholder={field.label}
                    placeholderTextColor={colors.mutedForeground}
                    value={form[field.key]}
                    onChangeText={(v) => set(field.key, v.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>

            {/* Delete button (edit mode) */}
            {isEdit && onDelete && (
              <TouchableOpacity
                onPress={onDelete}
                style={[styles.deleteBtn, { borderColor: '#ef444440' }]}
              >
                <Feather name="trash-2" size={16} color="#ef4444" />
                <Text style={[styles.deleteBtnText]}>Remove from Inventory</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Unit Picker Modal */}
      <Modal visible={showUnitPicker} transparent animationType="fade" onRequestClose={() => setShowUnitPicker(false)}>
        <TouchableOpacity style={styles.actionsOverlay} activeOpacity={1} onPress={() => setShowUnitPicker(false)}>
          <View style={[styles.unitPickerMenu, { backgroundColor: colors.card }]}>
            <Text style={[styles.actionsTitle, { color: colors.foreground }]}>Select Unit</Text>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <ScrollView style={{ maxHeight: 300 }}>
              {UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => { set('unit', u); setShowUnitPicker(false); }}
                  style={[styles.actionRow, form.unit === u && { backgroundColor: colors.accent }]}
                >
                  <Text style={{ fontSize: 15, fontFamily: form.unit === u ? 'Inter_700Bold' : 'Inter_400Regular', color: form.unit === u ? colors.primary : colors.foreground }}>
                    {u}
                  </Text>
                  {form.unit === u && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
      {label}
    </Text>
  );
}

function inputRow(colors: ReturnType<typeof useColors>) {
  return {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    fontFamily: 'Inter_400Regular' as const,
    fontSize: 15,
    justifyContent: 'center' as const,
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemData | null>(null);

  const { data: rawItems = [], isLoading, refetch } = useListInventory();
  // Broadcast inventory changes to every dependent query (meal plans, dashboard)
  const invalidateAll = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
    // Meal plan ingredients availability depends on inventory — force re-check
    qc.invalidateQueries({ queryKey: ['meal-plans'] });
    qc.invalidateQueries({ queryKey: getGetDashboardTodayQueryKey({ date: today }) });
  }, [qc]);

  const createMutation = useCreateInventoryItem({ mutation: { onSuccess: invalidateAll } });
  const updateMutation = useUpdateInventoryItem({ mutation: { onSuccess: invalidateAll } });
  const deleteMutation = useDeleteInventoryItem({ mutation: { onSuccess: invalidateAll } });

  const items = rawItems as InventoryItemData[];

  // Filter items
  const filtered = useMemo(() => {
    let result = items;
    if (activeCategory !== 'all') {
      result = result.filter((i) => i.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeCategory, searchQuery]);

  // Group by category for sectioned display
  const sections = useMemo(() => {
    if (activeCategory !== 'all' || searchQuery.trim()) {
      return [{ category: activeCategory === 'all' ? null : activeCategory, items: filtered }];
    }
    const groups: { category: Category | null; items: InventoryItemData[] }[] = [];
    for (const cat of CATEGORIES) {
      const catItems = items.filter((i) => i.category === cat.key);
      if (catItems.length > 0) groups.push({ category: cat.key, items: catItems });
    }
    const uncategorized = items.filter((i) => !i.category || !CATEGORIES.find((c) => c.key === i.category));
    if (uncategorized.length > 0) groups.push({ category: null, items: uncategorized });
    return groups;
  }, [items, activeCategory, searchQuery, filtered]);

  // Counts per category for badges
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => { if (i.category) map[i.category] = (map[i.category] ?? 0) + 1; });
    return map;
  }, [items]);

  function openAdd() {
    setEditingItem(null);
    setModalVisible(true);
  }

  function openEdit(item: InventoryItemData) {
    setEditingItem(item);
    setModalVisible(true);
  }

  async function handleSave(form: ItemForm) {
    const payload = {
      name: form.name.trim(),
      category: form.category || undefined,
      quantity: parseFloat(form.quantity),
      unit: form.unit,
      storageLocation: (form.storageLocation || undefined) as StorageLocation | undefined,
      expirationDate: form.expirationDate || undefined,
      caloriesPer100g: form.caloriesPer100g ? parseFloat(form.caloriesPer100g) : undefined,
      proteinPer100g: form.proteinPer100g ? parseFloat(form.proteinPer100g) : undefined,
      carbsPer100g: form.carbsPer100g ? parseFloat(form.carbsPer100g) : undefined,
      fatPer100g: form.fatPer100g ? parseFloat(form.fatPer100g) : undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: payload });
      } else {
        await createMutation.mutateAsync({ data: payload });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Could not save item. Please try again.');
    }
  }

  async function handleDelete(id: number) {
    Alert.alert('Remove Item', 'Remove this item from your inventory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setModalVisible(false);
          } catch {
            Alert.alert('Error', 'Could not delete item.');
          }
        },
      },
    ]);
  }

  async function handleMarkFinished(item: InventoryItemData) {
    Alert.alert('Mark as Finished', `Remove "${item.name}" — quantity used up?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Finished', style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ id: item.id });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Error', 'Could not update item.');
          }
        },
      },
    ]);
  }

  const tabBarHeight = Platform.OS === 'ios' ? 84 : 64;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>🧊 Inventory</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery(''); }}
              style={[styles.headerIconBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name={showSearch ? 'x' : 'search'} size={20} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openAdd} style={[styles.headerIconBtn, { backgroundColor: colors.primary }]}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        {showSearch && (
          <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground }}
              placeholder="Search inventory..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Category filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabsContent}
          style={styles.categoryTabs}
        >
          <TouchableOpacity
            onPress={() => setActiveCategory('all')}
            style={[styles.categoryTab, activeCategory === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={[styles.categoryTabText, { color: activeCategory === 'all' ? '#fff' : colors.mutedForeground }]}>
              All {items.length > 0 ? `(${items.length})` : ''}
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.key] ?? 0;
            const active = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[
                  styles.categoryTab,
                  active && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
              >
                <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                <Text style={[styles.categoryTabText, { color: active ? '#fff' : colors.mutedForeground }]}>
                  {cat.label}
                  {count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>🧊</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your inventory is empty</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Add your food items to get personalized meal plans and grocery lists
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Add First Item</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No items found</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Try a different search or category
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: tabBarHeight + insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: section }) => {
            const meta = section.category ? getCategoryMeta(section.category) : null;
            return (
              <View>
                {/* Section header */}
                {(activeCategory === 'all' && !searchQuery.trim()) && (
                  <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                    <Text style={{ fontSize: 20 }}>{meta?.emoji ?? '📦'}</Text>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      {meta?.label ?? 'Other'}
                    </Text>
                    <View style={[styles.sectionCount, { backgroundColor: (meta?.color ?? '#6b7280') + '20' }]}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_700Bold', color: meta?.color ?? colors.mutedForeground }}>
                        {section.items.length}
                      </Text>
                    </View>
                  </View>
                )}
                {/* Items */}
                {section.items.map((item) => (
                  <View key={item.id} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                    <ItemCard
                      item={item}
                      colors={colors}
                      onEdit={() => openEdit(item)}
                      onDelete={() => handleDelete(item.id)}
                      onMarkFinished={() => handleMarkFinished(item)}
                    />
                  </View>
                ))}
              </View>
            );
          }}
        />
      )}

      {/* ── Add/Edit Modal ────────────────────────────────────────────── */}
      <AddEditModal
        visible={modalVisible}
        item={editingItem}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        onDelete={editingItem ? () => handleDelete(editingItem.id) : undefined}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { borderBottomWidth: 1, paddingBottom: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 16, marginBottom: 12 },
  categoryTabs: { flexGrow: 0 },
  categoryTabsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, borderWidth: 1.5, borderColor: '#e5e7eb' },
  categoryTabText: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', flex: 1 },
  sectionCount: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },

  // Item card
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  itemEmoji: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  macroText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  quantity: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  unit: { fontSize: 12, fontFamily: 'Inter_500Medium' },

  // Actions overlay
  actionsOverlay: { flex: 1, backgroundColor: '#00000050', alignItems: 'center', justifyContent: 'center', padding: 24 },
  actionsMenu: { width: '100%', borderRadius: 20, padding: 8, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  actionsTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', padding: 12, paddingBottom: 0 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, justifyContent: 'space-between' },
  actionLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1 },

  // Dropdown
  dropdown: { position: 'absolute', top: 54, left: 0, right: 0, borderRadius: 12, borderWidth: 1.5, zIndex: 100, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
  dropdownItem: { padding: 14, gap: 2 },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  modalHeaderBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  modalSaveBtn: { paddingHorizontal: 16, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalSaveBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  modalContent: { padding: 20 },

  // Category chip (in modal)
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5 },

  // Storage chip
  storageChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },

  // Suggest button
  suggestBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, alignSelf: 'flex-start', marginVertical: 8 },
  suggestBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Delete
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, marginTop: 8 },
  deleteBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#ef4444' },

  // Unit picker
  unitPickerMenu: { width: '90%', borderRadius: 20, padding: 8, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, alignSelf: 'center' },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
