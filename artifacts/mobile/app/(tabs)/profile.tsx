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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import {
  useGetMyProfile,
  useUpdateMyProfile,
  useGetNutritionTargets,
  getGetMyProfileQueryKey,
  getGetNutritionTargetsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Lose Weight',
  maintain: 'Maintain',
  gain_muscle: 'Build Muscle',
  improve_endurance: 'Endurance',
  improve_health: 'General Health',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extremely_active: 'Extremely Active',
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', heightCm: '', weightKg: '' });

  const { data: profile, isLoading } = useGetMyProfile();
  const { data: targets } = useGetNutritionTargets();

  const updateProfile = useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        qc.invalidateQueries({ queryKey: getGetNutritionTargetsQueryKey() });
        setShowEdit(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const openEdit = () => {
    setForm({
      name: profile?.name ?? '',
      age: profile?.age ? String(profile.age) : '',
      heightCm: profile?.heightCm ? String(profile.heightCm) : '',
      weightKg: profile?.weightKg ? String(profile.weightKg) : '',
    });
    setShowEdit(true);
  };

  const handleSave = () => {
    const data: Record<string, unknown> = {};
    if (form.name) data.name = form.name;
    if (form.age) data.age = parseInt(form.age, 10);
    if (form.heightCm) data.heightCm = parseFloat(form.heightCm);
    if (form.weightKg) data.weightKg = parseFloat(form.weightKg);
    updateProfile.mutate({ data });
  };

  const styles = makeStyles(colors, insets);
  const tabBarHeight = Platform.OS === 'ios' ? 80 : 72;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
          <Feather name="edit-2" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + tabBarHeight + 24 }}>
        {/* Avatar + email */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>
              {(profile?.name ?? user?.email ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.name ?? 'No name set'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* Stats row */}
            {(profile?.heightCm || profile?.weightKg || profile?.age) ? (
              <View style={styles.statsRow}>
                {profile?.age ? <StatCard label="Age" value={`${profile.age} yrs`} icon="calendar" color={colors.protein} /> : null}
                {profile?.heightCm ? <StatCard label="Height" value={`${profile.heightCm} cm`} icon="arrow-up" color={colors.carbs} /> : null}
                {profile?.weightKg ? <StatCard label="Weight" value={`${profile.weightKg} kg`} icon="activity" color={colors.fat} /> : null}
              </View>
            ) : null}

            {/* Goal & Activity */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Fitness Profile</Text>
              <InfoRow label="Goal" value={profile?.fitnessGoal ? GOAL_LABELS[profile.fitnessGoal] ?? profile.fitnessGoal : '—'} />
              <InfoRow label="Activity" value={profile?.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel : '—'} />
              <InfoRow label="Workout Frequency" value={profile?.workoutFrequency !== null && profile?.workoutFrequency !== undefined ? `${profile.workoutFrequency} days/week` : '—'} />
            </View>

            {/* Targets */}
            {targets ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Daily Targets</Text>
                <InfoRow label="Calories" value={`${targets.dailyCalories} kcal`} />
                <InfoRow label="Protein" value={`${targets.proteinG}g`} />
                <InfoRow label="Carbs" value={`${targets.carbsG}g`} />
                <InfoRow label="Fat" value={`${targets.fatG}g`} />
                <InfoRow label="BMR" value={`${targets.bmr} kcal`} />
                <InfoRow label="TDEE" value={`${targets.tdee} kcal`} last />
              </View>
            ) : null}

            {/* Diet preferences */}
            {profile?.dietPreferences && profile.dietPreferences.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Diet Preferences</Text>
                <View style={styles.chipRow}>
                  {profile.dietPreferences.map((d) => (
                    <View key={d} style={styles.chip}>
                      <Text style={styles.chipText}>{d}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Allergies */}
            {profile?.allergies && profile.allergies.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Allergies</Text>
                <View style={styles.chipRow}>
                  {profile.allergies.map((a) => (
                    <View key={a} style={[styles.chip, { backgroundColor: colors.destructive + '18', borderColor: colors.destructive + '30' }]}>
                      <Text style={[styles.chipText, { color: colors.destructive }]}>{a}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => { await logout(); }}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <FormField label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Your name" colors={colors} />
            <FormField label="Age" value={form.age} onChangeText={(v) => setForm((f) => ({ ...f, age: v }))} placeholder="Years" keyboardType="numeric" colors={colors} />
            <FormField label="Height (cm)" value={form.heightCm} onChangeText={(v) => setForm((f) => ({ ...f, heightCm: v }))} placeholder="e.g. 175" keyboardType="numeric" colors={colors} />
            <FormField label="Weight (kg)" value={form.weightKg} onChangeText={(v) => setForm((f) => ({ ...f, weightKg: v }))} placeholder="e.g. 72" keyboardType="numeric" colors={colors} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, updateProfile.isPending && { opacity: 0.7 }]} onPress={handleSave} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: keyof typeof Feather.glyphMap; color: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
      <Feather name={icon} size={18} color={color} />
      <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground }}>{value}</Text>
      <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: colors.foreground }}>{value}</Text>
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, colors }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: 'numeric'; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.foreground, marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.background, paddingHorizontal: 14, height: 48, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.foreground }}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 24, fontFamily: 'Inter_700Bold', color: colors.foreground },
    editBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
    avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
    profileName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 2 },
    profileEmail: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.primary + '30' },
    chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.primary },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.destructive + '40', backgroundColor: colors.destructive + '0a' },
    logoutText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.destructive },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: 20 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, height: 50, borderRadius: 12, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    saveBtn: { flex: 2, height: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  });
}
