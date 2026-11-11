import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button, LinkButton } from '@/components/controls';
import { Colors, Fonts } from '@/constants/theme';
import { requestNotificationPermission } from '@/lib/notifications';

const REASONS = [
  {
    icon: require('../../assets/images/icons/icon-locate.png'),
    title: 'Localização',
    text: 'Marca o ponto exato do carro e mostra a distância e o caminho a pé na volta. Só é usada com o app aberto.',
  },
  {
    icon: require('../../assets/images/icons/notification-icon.png'),
    title: 'Avisos',
    text: 'Avisa 10 minutos antes de o parquímetro ou a Zona Azul vencer, para você não levar multa.',
  },
];

/**
 * Explica, antes do pedido do sistema, para que servem a localização e os avisos, e então pede
 * as duas permissões em sequência. "Agora não" leva ao app do mesmo jeito: sem localização,
 * ainda dá para salvar a vaga pelo CEP ou escolhendo no mapa.
 */
export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  /** Pede localização e depois avisos; qualquer resposta segue para a home. */
  async function handleAllow() {
    setBusy(true);
    await Location.requestForegroundPermissionsAsync().catch(() => null);
    await requestNotificationPermission().catch(() => false);
    router.replace('/');
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={s.content}>
        <Image source={require('../../assets/images/icon.png')} style={s.logo} accessibilityLabel="Onde Estacionei?" />
        <Text style={s.title} accessibilityRole="header">Para achar seu carro depois</Text>
        <Text style={s.lead}>O app precisa de duas permissões. Você pode mudar isso quando quiser nas configurações.</Text>
        {REASONS.map((r) => (
          <View key={r.title} style={s.reason}>
            <View style={s.reasonIcon}>
              <Image source={r.icon} style={s.reasonGlyph} />
            </View>
            <View style={s.reasonBody}>
              <Text style={s.reasonTitle}>{r.title}</Text>
              <Text style={s.reasonText}>{r.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={s.footer}>
        <Button label={busy ? 'Aguardando sua resposta…' : 'Continuar'} onPress={handleAllow} disabled={busy} />
        <LinkButton label="Agora não" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.concrete, paddingHorizontal: 20 },
  content: { gap: 16 },
  logo: { width: 88, height: 88, borderRadius: 20 },
  title: { color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 40, lineHeight: 44 },
  lead: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  reason: {
    flexDirection: 'row', gap: 14, backgroundColor: Colors.white, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#D6DAE0',
  },
  reasonIcon: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.sign, alignItems: 'center', justifyContent: 'center',
  },
  reasonGlyph: { width: 28, height: 28, tintColor: Colors.white, resizeMode: 'contain' },
  reasonBody: { flex: 1, gap: 4 },
  reasonTitle: { color: Colors.asphalt, fontFamily: Fonts.semi, fontSize: 22 },
  reasonText: { color: Colors.muted, fontSize: 15, lineHeight: 22 },
  footer: { gap: 4, paddingTop: 12 },
});
