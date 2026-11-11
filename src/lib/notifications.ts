import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { warnAt } from './geo';

const CHANNEL_ID = 'parking-meter';

/** Define como os avisos aparecem e cria o canal do Android, sem pedir permissão à pessoa. */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Tempo do parquímetro',
      importance: AndroidImportance.HIGH,
    });
  }
}

/** Pede permissão para avisos; no Android 13+ o pedido só aparece depois que o canal existe. */
export async function requestNotificationPermission(): Promise<boolean> {
  await configureNotifications();
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

/** Cancela um aviso agendado; ignora ids que já dispararam ou não existem. */
export async function cancelWarning(notificationId: string | null): Promise<void> {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

/** Agenda o aviso local para 10 minutos antes de o parquímetro vencer e devolve o id dele. */
export function scheduleWarning(expiresAt: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Faltam 10 minutos no parquímetro',
      body: 'Volte ao carro ou renove o tempo para evitar multa.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: warnAt(expiresAt),
      channelId: CHANNEL_ID,
    },
  });
}
