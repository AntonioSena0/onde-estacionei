import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { Colors } from '@/constants/theme';
import { configureNotifications } from '@/lib/notifications';
import { init, startRealtime, stopRealtime } from '@/lib/store';
import { refreshWidget } from '@/widget/parking-widget';

export const unstable_settings = { initialRouteName: 'index' };

/**
 * Layout raiz: carrega a fonte das placas, a vaga salva e a sincronização uma única vez para
 * o app todo, e mostra as telas sem cabeçalho nativo. Se a fonte falhar, usa a do sistema.
 * Ao sair do app, redesenha o widget com a posição mais recente. Aberto por um link do widget,
 * a home fica por baixo da tela do link (`initialRouteName`), para o "Voltar" funcionar.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold });

  useEffect(() => {
    init().then(startRealtime);
    configureNotifications().catch(() => {});
    const sub = AppState.addEventListener('change', (st) => st === 'background' && refreshWidget());
    return () => {
      sub.remove();
      stopRealtime();
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.concrete } }} />
    </>
  );
}
