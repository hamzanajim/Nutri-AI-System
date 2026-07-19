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

  const { data: lists, isLoading, isRefetching, refetch } = useListGroceryLists();
  const { data: selectedList } = useGetGroceryList(selectedListId ?? 0, {
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

  if (selectedListId && selectedList) {
    const unchecked = selectedList.items.filter((i) => !i.checked);
    const checked = selectedList.items.filter((i) => i.checked);

    return (
      <View style={styles.container}>
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

        {/* Add item input */}
        <View style={styles.addItemRow}>
          <TextInput
            style={styles.addItemInput}
            placeholder="Add item..."
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
          {unchecked.length === 0 && checked.length === 0 && (
            <View style={styles.emptyCard}>
              <Feather name="shopping-bag" size={32} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>List is empty</Text>
              <Text style={styles.emptyText}>Add items using the field above</Text>
            </View>
          )}

          {unchecked.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <TouchableOpacity onPress={() => handleToggleItem(selectedListId, item.id, item.checked)} style={styles.checkbox}>
                <View style={[styles.checkboxInner, { borderColor: colors.border }]} />
              </TouchableOpacity>
              <Text style={styles.itemName}>{item.name}</Text>
              <TouchableOpacity onPress={() => deleteItem.mutate({ listId: selectedListId, itemId: item.id })}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}

          {checked.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Checked ({checked.length})</Text>
              {checked.map((item) => (
                <View key={item.id} style={[styles.listItem, { opacity: 0.5 }]}>
                  <TouchableOpacity onPress={() => handleToggleItem(selectedListId, item.id, item.checked)} style={styles.checkbox}>
                    <View style={[styles.checkboxInner, { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.itemName, { textDecorationLine: 'line-through' }]}>{item.name}</Text>
                  <TouchableOpacity onPress={() => deleteItem.mutate({ listId: selectedListId, itemId: item.id })}>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Grocery Lists</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateList(true)} activeOpacity={0.85}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + tabBarHeight + 16 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : !lists || lists.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="shopping-cart" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>No grocery lists</Text>
            <Text style={styles.emptyText}>Create a list to start shopping</Text>
          </View>
        ) : (
          lists.map((list) => (
            <TouchableOpacity
              key={list.id}
              style={styles.listCard}
              onPress={() => setSelectedListId(list.id)}
              activeOpacity={0.8}
            >
              <View style={styles.listIconWrap}>
                <Feather name="shopping-cart" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listName}>{list.name}</Text>
                <Text style={styles.listDate}>
                  {new Date(list.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreateList} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Grocery List</Text>
            <TextInput
              style={styles.input}
              placeholder="List name (e.g. Weekly Shop)"
              placeholderTextColor={colors.mutedForeground}
              value={listName}
              onChangeText={setListName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateList(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, createList.isPending && { opacity: 0.7 }]}
                onPress={() => { if (listName.trim()) createList.mutate({ data: { name: listName.trim() } }); }}
                disabled={createList.isPending}
              >
                {createList.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    title: { flex: 1, fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground },
    addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addItemRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12 },
    addItemInput: { flex: 1, height: 48, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.foreground, backgroundColor: colors.card },
    addItemBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    center: { alignItems: 'center', paddingTop: 60 },
    emptyCard: { alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 16, padding: 40, marginTop: 16 },
    emptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    listCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    listIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    listName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground, marginBottom: 2 },
    listDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    checkbox: { padding: 2 },
    checkboxInner: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    itemName: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: colors.foreground },
    sectionLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginTop: 16, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 20 },
    input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, paddingHorizontal: 14, height: 50, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.foreground, marginBottom: 20 },
    modalActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    saveBtn: { flex: 2, height: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  });
}
