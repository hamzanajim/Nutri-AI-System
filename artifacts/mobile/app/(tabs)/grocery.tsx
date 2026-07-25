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
  useListGroceryLists,
  useCreateGroceryList,
  useDeleteGroceryList,
  useGetGroceryList,
  useAddGroceryListItem,
  useUpdateGroceryListItem,
  useDeleteGroceryListItem,
  useOptimizeGroceryList,
  getListGroceryListsQueryKey,
  getGetGroceryListQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export default function GroceryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showCreateList, setShowCreateList] = useState(false);
  const [listName, setListName] = useState('');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [viewMode, setViewMode] = useState<'simple' | 'smart'>('simple');

  const { data: lists, isLoading, isRefetching, refetch } = useListGroceryLists();
  const { data: selectedList, refetch: refetchList } = useGetGroceryList(selectedListId ?? 0, {
    query: { enabled: !!selectedListId, queryKey: getGetGroceryListQueryKey(selectedListId ?? 0) },
  });

  const createList = useCreateGroceryList({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getListGroceryListsQueryKey() });
        setShowCreateList(false);
        setListName('');
        setSelectedListId(data.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const deleteList = useDeleteGroceryList({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListGroceryListsQueryKey() });
        setSelectedListId(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
    },
  });

  const addItem = useAddGroceryListItem({
    mutation: {
      onSuccess: () => {
        if (selectedListId) qc.invalidateQueries({ queryKey: getGetGroceryListQueryKey(selectedListId) });
        setNewItemName('');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    },
  });

  const updateItem = useUpdateGroceryListItem({
    mutation: {
      onSuccess: () => {
        if (selectedListId) qc.invalidateQueries({ queryKey: getGetGroceryListQueryKey(selectedListId) });
      },
    },
  });

  const deleteItem = useDeleteGroceryListItem({
    mutation: {
      onSuccess: () => {
        if (selectedListId) qc.invalidateQueries({ queryKey: getGetGroceryListQueryKey(selectedListId) });
      },
    },
  });

  const optimizeList = useOptimizeGroceryList({
    mutation: {
      onSuccess: () => {
        if (selectedListId) qc.invalidateQueries({ queryKey: getGetGroceryListQueryKey(selectedListId) });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('✅ Optimized!', 'AI has analyzed your meal plan and updated your grocery list with what you need to buy.');
      },
      onError: () => {
        Alert.alert('Error', 'Failed to optimize grocery list. Please ensure you have a meal plan set up first.');
      },
    },
  });

  const handleAddItem = () => {
    if (!newItemName.trim() || !selectedListId) return;
    addItem.mutate({ listId: selectedListId, data: { name: newItemName.trim() } });
  };

  const handleToggleItem = (listId: number, itemId: number, checked: boolean) => {
    updateItem.mutate({ listId, itemId, data: { checked: !checked } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const styles = makeStyles(colors, insets);
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;

  // ── Detail view ────────────────────────────────────────────────────────────
  if (selectedListId && selectedList) {
    const items = selectedList.items ?? [];
    const unchecked = items.filter((i) => !i.checked);
    const checked = items.filter((i) => i.checked);
    const aiItems = items.filter((i) => i.aiGenerated);
    const manualItems = items.filter((i) => !i.aiGenerated);

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setSelectedListId(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{selectedList.name}</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Delete List', 'Delete this grocery list?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteList.mutate({ id: selectedListId }) },
              ])
            }
          >
            <Feather name="trash-2" size={20} color={colors.destructive} />
          </TouchableOpacity>
        </View>

        {/* AI Optimize button */}
        <View style={styles.optimizeRow}>
          <TouchableOpacity
            style={styles.optimizeBtn}
            disabled={optimizeList.isPending}
            onPress={() =>
              Alert.alert(
                'Optimize Grocery List',
                'AI will analyze your meal plan for the next 7 days and update this list with exactly what you need to buy based on your current inventory.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Optimize', onPress: () => optimizeList.mutate({ id: selectedListId }) },
                ]
              )
            }
          >
            {optimizeList.isPending ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.optimizeBtnText}>Analyzing…</Text>
              </>
            ) : (
              <>
                <Feather name="cpu" size={15} color={colors.primary} />
                <Text style={styles.optimizeBtnText}>Optimize Shopping List</Text>
              </>
            )}
          </TouchableOpacity>

          {aiItems.length > 0 && (
            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setViewMode(viewMode === 'simple' ? 'smart' : 'simple')}
            >
              <Feather name={viewMode === 'smart' ? 'list' : 'bar-chart-2'} size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Add item input */}
        <View style={styles.addItemRow}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Add item…"
            placeholderTextColor={colors.mutedForeground}
            value={newItemName}
            onChangeText={setNewItemName}
            returnKeyType="done"
            onSubmitEditing={handleAddItem}
          />
          <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem} disabled={addItem.isPending}>
            {addItem.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="plus" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + tabBarHeight + 16 }}>

          {/* Smart view: AI-generated items with quantities */}
          {viewMode === 'smart' && aiItems.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={styles.smartHeader}>
                <Feather name="cpu" size={14} color={colors.primary} />
                <Text style={styles.smartHeaderText}>Smart Shopping List</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                  {aiItems.length} items
                </Text>
              </View>

              {/* Table header */}
              <View style={styles.smartTableHeader}>
                <Text style={[styles.smartCol, { flex: 3 }]}>Item</Text>
                <Text style={[styles.smartCol, { flex: 1.5, textAlign: 'center' }]}>Have</Text>
                <Text style={[styles.smartCol, { flex: 1.5, textAlign: 'center' }]}>Need</Text>
                <Text style={[styles.smartCol, { flex: 1.5, textAlign: 'center', color: colors.primary }]}>Buy</Text>
              </View>

              {aiItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.smartRow, item.checked && { opacity: 0.5 }]}
                  onPress={() => handleToggleItem(selectedListId, item.id, item.checked)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 3 }}>
                    <Text style={[styles.smartItemName, item.checked && { textDecorationLine: 'line-through' }]}>
                      {item.name}
                    </Text>
                    {item.reason && (
                      <Text style={styles.smartItemReason} numberOfLines={1}>{item.reason}</Text>
                    )}
                  </View>
                  <Text style={[styles.smartCell, { flex: 1.5 }]}>{item.currentQty ?? 0}{item.unit ?? 'g'}</Text>
                  <Text style={[styles.smartCell, { flex: 1.5 }]}>{item.requiredQty ?? 0}{item.unit ?? 'g'}</Text>
                  <Text style={[styles.smartCell, { flex: 1.5, color: colors.primary, fontFamily: 'Inter_700Bold' }]}>
                    {Math.ceil(item.toBuyQty ?? 0)}{item.unit ?? 'g'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Simple view: standard checklist */}
          {(viewMode === 'simple' || aiItems.length === 0) && (
            <>
              {/* Unchecked items */}
              {unchecked.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.item}
                  onPress={() => handleToggleItem(selectedListId, item.id, item.checked)}
                  onLongPress={() =>
                    Alert.alert(item.name, 'Remove this item?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => deleteItem.mutate({ listId: selectedListId, itemId: item.id }) },
                    ])
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.checkbox}>
                    {item.checked && <Feather name="check" size={14} color={colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.aiGenerated && item.reason && (
                      <Text style={styles.itemReason}>{item.reason}</Text>
                    )}
                  </View>
                  {item.quantity !== null && (
                    <Text style={styles.itemQty}>{item.quantity}{item.unit ?? ''}</Text>
                  )}
                </TouchableOpacity>
              ))}

              {/* Checked items */}
              {checked.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.checkedHeader}>Checked ({checked.length})</Text>
                  {checked.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.item, { opacity: 0.5 }]}
                      onPress={() => handleToggleItem(selectedListId, item.id, item.checked)}
                      onLongPress={() =>
                        Alert.alert(item.name, 'Remove this item?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => deleteItem.mutate({ listId: selectedListId, itemId: item.id }) },
                        ])
                      }
                    >
                      <View style={[styles.checkbox, styles.checkboxChecked]}>
                        <Feather name="check" size={14} color="#fff" />
                      </View>
                      <Text style={[styles.itemName, { textDecorationLine: 'line-through' }]}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {items.length === 0 && (
                <View style={styles.emptyCard}>
                  <Feather name="shopping-cart" size={32} color={colors.mutedForeground} />
                  <Text style={styles.emptyTitle}>List is empty</Text>
                  <Text style={styles.emptyText}>Add items manually or use Optimize to auto-fill from your meal plan</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Lists view ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Grocery</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateList(true)} activeOpacity={0.85}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + tabBarHeight + 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingTop: 40 }} />
        ) : !lists || lists.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="shopping-cart" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No grocery lists</Text>
            <Text style={styles.emptyText}>Create a list and use AI optimization to auto-fill it from your meal plan</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateList(true)}>
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Create First List</Text>
            </TouchableOpacity>
          </View>
        ) : (
          lists.map((list) => (
            <TouchableOpacity
              key={list.id}
              style={styles.listCard}
              onPress={() => setSelectedListId(list.id)}
              activeOpacity={0.8}
            >
              <View style={styles.listIcon}>
                <Feather name="shopping-cart" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listName}>{list.name}</Text>
                <Text style={styles.listMeta}>
                  {new Date(list.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create List Modal */}
      <Modal visible={showCreateList} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateList(false)}>
        <View style={[styles.modalContainer, { paddingTop: insets.top + 16 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Grocery List</Text>
            <TouchableOpacity onPress={() => setShowCreateList(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <TextInput
              style={styles.input}
              placeholder="List name (e.g. Weekly Shop)"
              placeholderTextColor={colors.mutedForeground}
              value={listName}
              onChangeText={setListName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                if (!listName.trim()) return;
                createList.mutate({ data: { name: listName.trim() } });
              }}
            />
            <TouchableOpacity
              style={[styles.createBtn, { marginTop: 16 }]}
              onPress={() => {
                if (!listName.trim()) return;
                createList.mutate({ data: { name: listName.trim() } });
              }}
              disabled={createList.isPending}
            >
              {createList.isPending ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Create List</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    title: { flex: 1, fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground },
    addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    backBtn: { padding: 4, marginRight: 8 },
    optimizeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    optimizeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '60', backgroundColor: colors.primary + '10' },
    optimizeBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.primary },
    viewToggle: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
    addItemRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    addItemInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.foreground, backgroundColor: colors.card },
    addItemBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    smartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    smartHeaderText: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground },
    smartTableHeader: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.muted, borderRadius: 8, marginBottom: 4 },
    smartCol: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground },
    smartRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    smartItemName: { fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground },
    smartItemReason: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 1 },
    smartCell: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.foreground },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    itemName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground },
    itemReason: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    itemQty: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground },
    checkedHeader: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 8 },
    emptyCard: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: colors.foreground },
    emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
    listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    listIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    listName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    listMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    createBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground, backgroundColor: colors.card },
  });
}
