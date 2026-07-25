/**
 * useMealNotifications — schedule and cancel local push notifications
 * for AI meal plan meals.
 *
 * Notification identifier: `meal-plan-meal-${mealId}` (stable, cancel-by-ID).
 * Notification data payload: { mealId: number, mealName: string }
 *
 * Web: expo-notifications has partial web support — scheduling works on
 * modern browsers; we still guard the Android channel setup with a Platform
 * check. On web, triggers must be null (immediate) or date-based.
 */
import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Default handler so foreground notifications show an alert + badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL_ID = 'meal-reminders';

/** Call once (idempotent) to set up the Android notification channel. */
async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22C55E',
    });
  }
}

/**
 * Request notification permissions. Returns true if granted.
 * Safe to call multiple times — returns cached status if already decided.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // expo-notifications on web uses the browser Notification API
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    return newStatus === 'granted';
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  if (status === 'denied') return false; // user already denied — don't ask again

  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === 'granted';
}

/** Stable notification identifier for a plan meal. */
export function mealNotificationId(mealId: number): string {
  return `meal-plan-meal-${mealId}`;
}

export interface MealToSchedule {
  id: number;
  name: string;
  mealType: string;
  scheduledTime?: string | null; // "HH:MM"
}

/**
 * Schedule notifications for a list of meals on a given date.
 * Skips meals whose scheduledTime has already passed.
 * Silently no-ops if permissions are not granted or scheduledTime is missing.
 */
export async function scheduleMealNotifications(
  meals: MealToSchedule[],
  date: string // YYYY-MM-DD
): Promise<void> {
  await ensureChannel();
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  for (const meal of meals) {
    if (!meal.scheduledTime) continue;

    const [hourStr, minStr] = meal.scheduledTime.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);
    if (isNaN(hour) || isNaN(minute)) continue;

    // Build trigger time from the plan date
    const [year, month, day] = date.split('-').map(Number);
    const triggerDate = new Date(year, month - 1, day, hour, minute, 0, 0);

    // Don't schedule if already in the past
    if (triggerDate.getTime() <= Date.now()) continue;

    const body = mealTypePrompt(meal.mealType, meal.name);

    await Notifications.scheduleNotificationAsync({
      identifier: mealNotificationId(meal.id),
      content: {
        title: '🍽️ Meal Reminder',
        body,
        data: { mealId: meal.id, mealName: meal.name },
        ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
  }
}

/** Cancel the notification for a single plan meal. */
export async function cancelMealNotification(mealId: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(mealNotificationId(mealId));
}

/** Cancel notifications for a list of plan meals (e.g. whole plan deletion). */
export async function cancelPlanNotifications(mealIds: number[]): Promise<void> {
  await Promise.all(mealIds.map(cancelMealNotification));
}

function mealTypePrompt(mealType: string, mealName: string): string {
  switch (mealType) {
    case 'breakfast':
      return `Time for breakfast! Your ${mealName} is scheduled now.`;
    case 'lunch':
      return `Lunch time! Don't forget your ${mealName}.`;
    case 'dinner':
      return `Dinner time! Your ${mealName} is up — ready to cook?`;
    case 'snack':
      return `Snack time! ${mealName} is on your plan.`;
    default:
      return `Time for your planned meal: ${mealName}`;
  }
}

/**
 * Hook that sets up the Android channel on mount (idempotent).
 * Import and call in the root layout so it runs once.
 */
export function useMealNotificationSetup() {
  useEffect(() => {
    ensureChannel().catch(() => {
      // Channel setup failure is non-fatal
    });
  }, []);
}

/**
 * Hook that listens for notification taps and invokes a callback
 * with the mealId embedded in the notification data.
 */
export function useNotificationTapHandler(
  onMealTap: (mealId: number, mealName: string) => void
) {
  const handler = useCallback(
    (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as {
        mealId?: number;
        mealName?: string;
      };
      if (data?.mealId) {
        onMealTap(data.mealId, data.mealName ?? '');
      }
    },
    [onMealTap]
  );

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handler);
    return () => sub.remove();
  }, [handler]);
}
