import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useCreateInventoryItem, getListInventoryQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

// ─── Pantry presets ────────────────────────────────────────────────────────────

interface PantryItem {
  name: string;
  unit: string;
  defaultQty: number;
}

interface PantryCategory {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  items: PantryItem[];
}

const PANTRY_CATEGORIES: PantryCategory[] = [
  {
    label: 'Proteins',
    icon: 'zap',
    color: '#3b82f6',
    items: [
      { name: 'Chicken Breast', unit: 'g', defaultQty: 500 },
      { name: 'Salmon Fillet', unit: 'g', defaultQty: 300 },
      { name: 'Ground Beef', unit: 'g', defaultQty: 500 },
      { name: 'Eggs', unit: 'pieces', defaultQty: 12 },
      { name: 'Tuna (canned)', unit: 'cans', defaultQty: 3 },
      { name: 'Greek Yogurt', unit: 'g', defaultQty: 500 },
      { name: 'Cottage Cheese', unit: 'g', defaultQty: 400 },
      { name: 'Tofu', unit: 'g', defaultQty: 400 },
    ],
  },
  {
    label: 'Grains & Carbs',
    icon: 'box',
    color: '#f59e0b',
    items: [
      { name: 'Brown Rice', unit: 'g', defaultQty: 1000 },
      { name: 'Oats', unit: 'g', defaultQty: 500 },
      { name: 'Whole Wheat Pasta', unit: 'g', defaultQty: 500 },
      { name: 'Quinoa', unit: 'g', defaultQty: 500 },
      { name: 'Bread (whole grain)', unit: 'slices', defaultQty: 10 },
      { name: 'Sweet Potatoes', unit: 'g', defaultQty: 500 },
      { name: 'Lentils', unit: 'g', defaultQty: 500 },
      { name: 'Chickpeas (canned)', unit: 'cans', defaultQty: 2 },
    ],
  },
  {
    label: 'Fruits & Vegetables',
    icon: 'sun',
    color: '#22c55e',
    items: [
      { name: 'Spinach', unit: 'g', defaultQty: 200 },
      { name: 'Broccoli', unit: 'g', defaultQty: 300 },
      { name: 'Bananas', unit: 'pieces', defaultQty: 5 },
      { name: 'Blueberries', unit: 'g', defaultQty: 200 },
      { name: 'Tomatoes', unit: 'pieces', defaultQty: 6 },
      { name: 'Avocado', unit: 'pieces', defaultQty: 2 },
      { name: 'Bell Peppers', unit: 'pieces', defaultQty: 3 },
      { name: 'Apples', unit: 'pieces', defaultQty: 4 },
    ],
  },
  {
    label: 'Dairy & Fats',
    icon: 'droplet',
    color: '#ec4899',
    items: [
      { name: 'Milk', unit: 'ml', defaultQty: 1000 },
      { name: 'Butter', unit: 'g', defaultQty: 250 },
      { name: 'Olive Oil', unit: 'ml', defaultQty: 500 },
      { name: 'Cheddar Cheese', unit: 'g', defaultQty: 200 },
      { name: 'Almond Milk', unit: 'ml', defaultQty: 1000 },
      { name: 'Mixed Nuts', unit: 'g', defaultQty: 200 },
      { name: 'Peanut Butter', unit: 'g', defaultQty: 300 },
      { name: 'Coconut Oil', unit: 'ml', defaultQty: 300 },
    ],
  },
  {
    label: 'Pantry Staples',
    icon: 'archive',
    color: '#8b5cf6',
    items: [
      { name: 'Olive Oil', unit: 'ml', defaultQty: 500 },
      { name: 'Garlic', unit: 'cloves', defaultQty: 10 },
      { name: 'Onions', unit: 'pieces', defaultQty: 4 },
      { name: 'Black Beans (canned)', unit: 'cans', defaultQty: 2 },
      { name: 'Diced Tomatoes (canned)', unit: 'cans', defaultQty: 3 },
      { name: 'Protein Powder', unit: 'g', defaultQty: 1000 },
      { name: 'Honey', unit: 'g', defaultQty: 250 },
      { name: 'Soy Sauce', unit: 'ml', defaultQty: 150 },
    ],
  },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventorySetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<Map<string, { qty: number; unit: string }>>(new Map());
  const [customItem, setCustomItem] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const createItem = useCreateInventoryItem({ mutation: {} });

  function toggleItem(item: PantryItem) {
    const key = item.name;
    const next = new Map(selectedItems);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.set(key, { qty: item.defaultQty, unit: item.unit });
    }
    setSelectedItems(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function addCustomItem() {
    const name = customItem.trim();
    if (!name) return;
    const next = new Map(selectedItems);
    next.set(name, { qty: 1, unit: 'pieces' });
    setSelectedItems(next);
    setCustomItem('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleSaveAndContinue() {
    if (selectedItems.size === 0) {
      router.replace('/(tabs)');
      return;
    }

    setIsSaving(true);
    try {
      const mutations = Array.from(selectedItems.entries()).map(([name, { qty, unit }]) =>
        createItem.mutateAsync({
          data: { name, quantity: qty, unit },
        }),
      );
      await Promise.allSettled(mutations);
      qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Best-effort — don't block navigation
    } finally {
      setIsSaving(false);
      router.replace('/(tabs)');
    }
  }

  const category = PANTRY_CATEGORIES[activeCategory];
  const selectedCount = selectedItems.size;
  const s = makeStyles(colors, insets);
  const tabBarHeight = Platform.OS === 'ios' ? 0 : 0;

  return (
    <View style={s.container}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerTitle}>
          <Text style={s.title}>Stock Your Kitchen</Text>
          <Text style={s.subtitle}>
            Tell us what you have at home so AI can plan meals with your ingredients
          </Text>
        </View>

        {selectedCount > 0 && (
          <View style={s.selectionBadge}>
            <Text style={s.selectionBadgeText}>{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</Text>
          </View>
        )}
      </View>

      {/* ── Category Tabs ─────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catTabsContent}
        style={s.catTabs}
      >
        {PANTRY_CATEGORIES.map((cat, i) => (
          <TouchableOpacity
            key={cat.label}
            onPress={() => setActiveCategory(i)}
            style={[s.catTab, activeCategory === i && { backgroundColor: cat.color, borderColor: cat.color }]}
            activeOpacity={0.8}
          >
            <Feather name={cat.icon} size={14} color={activeCategory === i ? '#fff' : colors.mutedForeground} />
            <Text style={[s.catTabText, activeCategory === i && { color: '#fff', fontFamily: 'Inter_700Bold' }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Items Grid ────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.itemsGrid}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.gridRow}>
          {category.items.map((item) => {
            const selected = selectedItems.has(item.name);
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => toggleItem(item)}
                activeOpacity={0.75}
                style={[
                  s.itemCard,
                  selected && { borderColor: category.color, backgroundColor: category.color + '12' },
                ]}
              >
                <View style={[s.itemCheck, selected && { backgroundColor: category.color, borderColor: category.color }]}>
                  {selected && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={[s.itemName, selected && { color: category.color, fontFamily: 'Inter_600SemiBold' }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={s.itemQty}>
                  {item.defaultQty} {item.unit}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom item input */}
        <View style={s.customSection}>
          <Text style={s.customLabel}>Add something else?</Text>
          <View style={s.customRow}>
            <TextInput
              style={s.customInput}
              placeholder="Item name..."
              placeholderTextColor={colors.mutedForeground}
              value={customItem}
              onChangeText={setCustomItem}
              onSubmitEditing={addCustomItem}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={addCustomItem}
              style={[s.customAddBtn, !customItem.trim() && { opacity: 0.4 }]}
              disabled={!customItem.trim()}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom items that were added */}
        {Array.from(selectedItems.entries())
          .filter(([name]) => !PANTRY_CATEGORIES.flatMap((c) => c.items).some((i) => i.name === name))
          .map(([name]) => (
            <View key={name} style={s.customItemRow}>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={s.customItemName}>{name}</Text>
              <TouchableOpacity onPress={() => {
                const next = new Map(selectedItems);
                next.delete(name);
                setSelectedItems(next);
              }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}
      </ScrollView>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.ctaBtn, isSaving && { opacity: 0.7 }]}
          onPress={handleSaveAndContinue}
          disabled={isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={selectedCount > 0 ? 'check' : 'arrow-right'} size={18} color="#fff" />
              <Text style={s.ctaBtnText}>
                {selectedCount > 0 ? `Save ${selectedCount} Item${selectedCount !== 1 ? 's' : ''} & Continue` : 'Skip for Now'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {selectedCount === 0 && (
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={s.skipBtn}>
            <Text style={s.skipText}>I'll add items later</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { marginBottom: 10 },
    title: { fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 6 },
    subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, lineHeight: 20 },
    selectionBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1.5, borderColor: colors.primary + '40' },
    selectionBadgeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: colors.primary },
    catTabs: { flexGrow: 0, marginBottom: 12 },
    catTabsContent: { paddingHorizontal: 20, gap: 8 },
    catTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
    catTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
    itemsGrid: { paddingHorizontal: 16, paddingBottom: 32 },
    gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    itemCard: {
      width: '47%',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      gap: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    itemCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
    itemName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground, lineHeight: 18 },
    itemQty: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    customSection: { marginTop: 20, marginHorizontal: 4, padding: 16, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border },
    customLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 10 },
    customRow: { flexDirection: 'row', gap: 8 },
    customInput: { flex: 1, height: 44, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.foreground, backgroundColor: colors.background },
    customAddBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    customItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, marginHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
    customItemName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground },
    bottomBar: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, gap: 10 },
    ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, height: 56, borderRadius: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
    ctaBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
    skipBtn: { alignItems: 'center', paddingVertical: 2 },
    skipText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
  });
}
