/**
 * Asks for notification permission once signed in and stores this device's Expo
 * push token on the backend, so a message that arrives while the user is offline
 * becomes a push notification.
 *
 * Where it can work (expo-notifications, SDK 54):
 *  - a physical device — simulators have no push token;
 *  - iOS in Expo Go, or any development build;
 *  - Android only in a development build: remote push was removed from Expo Go
 *    in SDK 53.
 *  - an EAS projectId (`expo.extra.eas.projectId` in app.json, from `eas init`).
 *    Without one Expo cannot issue a token.
 * Everywhere else this logs why and does nothing — push is an extra, not
 * something the app should fail over.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { API_BASE_URL, savePushToken } from '@/lib/api';

// What happens when a notification arrives while the app is open. Without this
// the notification is silently dropped in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function registerForPush(): Promise<void> {
  // The mock has no backend to store a token on.
  if (!API_BASE_URL) return;

  if (!Device.isDevice) return console.log('Push: simulators have no push token');

  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (inExpoGo && Platform.OS === 'android') {
    return console.log('Push: Android push needs a development build, not Expo Go (SDK 53+)');
  }

  // Android 8+ requires a channel before any notification can be shown, and the
  // permission prompt only appears once a channel exists.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!status.granted) return console.log('Push: permission denied');

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return console.log('Push: no EAS projectId in app.json (run `eas init`)');

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await savePushToken(token);
}

export function usePushRegistration(): void {
  useEffect(() => {
    registerForPush().catch((error) => console.log('Push registration failed', error));
  }, []);
}
