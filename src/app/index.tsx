import { useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, LinkButton, OutlineButton } from '@/components/controls';
import { MiniMap } from '@/components/mini-map';
import { Plate, plateText } from '@/components/plate';
import { WidgetCard } from '@/components/widget-card';
import { Colors, Fonts } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { usePosition } from '@/hooks/use-position';
import { usePressure } from '@/hooks/use-pressure';
import {
  altitudeFromPressure, distanceMeters, expiryFrom, floorDelta, formatClock,
  formatDistance, formatRemaining, WARN_BEFORE_MS,
} from '@/lib/geo';
import { setSpot, subscribe, type AppState, type Connection } from '@/lib/store';
import type { Spot } from '@/lib/validation';

const DURATIONS = [
  { label: '30 min', min: 30 },
  { label: '1 h', min: 60 },
  { label: '2 h', min: 120 },
];

const CONNECTION_TEXT: Record<Connection, string> = {
  off: 'Sincronizar',
  connecting: 'Conectando',
  online: 'Sincronizado',
  offline: 'Offline',
  rejected: 'Revisar',
};

const BENEFITS = [
  { icon: require('../../assets/images/icons/icon-locate.png'), text: 'Guarda o ponto exato do carro, pelo GPS, pelo mapa ou pelo CEP' },
  { icon: require('../../assets/images/icons/icon-route.png'), text: 'Mostra a distância e o caminho a pé na volta' },
  { icon: require('../../assets/images/icons/notification-icon.png'), text: 'Avisa 10 minutos antes de o parquímetro vencer' },
];

/** Descreve em palavras quantos andares separam a pessoa do carro. */
function floorText(delta: number) {
  if (delta === 0) return 'No seu andar';
  const n = Math.abs(delta);
  return `${n} ${n === 1 ? 'andar' : 'andares'} ${delta > 0 ? 'acima' : 'abaixo'} de você`;
}

/**
 * Home: sem vaga, convida a adicionar uma; com vaga, mostra a placa com a prévia do mapa,
 * distância, tempo do parquímetro, endereço e descrição. A prévia abre o mapa em tela cheia.
 * Na primeira abertura, encaminha para a tela que explica e pede as permissões.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const pressure = usePressure();
  const { position, access } = usePosition();
  const [app, setApp] = useState<AppState | null>(null);

  useEffect(() => subscribe(setApp), []);
  useEffect(() => {
    if (access === 'pending') router.replace('/permissions');
  }, [access]);

  /** Renova (ou remove, com null) o tempo do parquímetro a partir de agora. */
  function handleTimer(v: Spot, minutes: number | null) {
    setSpot({ ...v, expiresAt: minutes == null ? null : expiryFrom(minutes) });
  }

  /** Pede confirmação e libera a vaga, apagando o tempo do parquímetro e o aviso agendado. */
  function handleRelease() {
    Alert.alert('Liberar a vaga salva?', 'A posição do carro e o tempo do parquímetro serão apagados.', [
      { text: 'Manter vaga', style: 'cancel' },
      { text: 'Liberar vaga', style: 'destructive', onPress: () => setSpot(null) },
    ]);
  }

  const spot = app?.spot ?? null;
  const distance = spot && position ? distanceMeters(position, spot) : null;
  const remaining = spot?.expiresAt ? spot.expiresAt - now : null;
  const delta = spot?.altitude != null && pressure ? floorDelta(spot.altitude, altitudeFromPressure(pressure)) : null;
  const details = spot ? [spot.floor && `Andar ${spot.floor}`, spot.note].filter(Boolean).join(' · ') : '';

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
        <View style={s.header}>
          <Image source={require('../../assets/images/icon.png')} style={s.headerLogo} />
          <Text style={s.headerTitle} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            Onde Estacionei?
          </Text>
          {app && (
            <Pressable
              onPress={() => router.push('/sync')}
              accessibilityRole="button"
              accessibilityLabel={`Sincronização: ${CONNECTION_TEXT[app.connection]}`}
              style={s.syncPill}
            >
              <View style={[s.syncDot, app.connection === 'online' && s.syncDotOn]} />
              <Text style={s.syncText}>{CONNECTION_TEXT[app.connection]}</Text>
            </Pressable>
          )}
        </View>

        {access === 'denied' && (
          <View style={s.banner}>
            <Text style={s.bannerText}>
              Localização desligada. A vaga ainda pode ser salva pelo CEP ou pelo mapa, mas sem distância nem rota.
            </Text>
            <LinkButton label="Ativar nas configurações" onPress={() => Linking.openSettings()} />
          </View>
        )}

        {!app ? null : !spot ? (
          <View style={s.empty}>
            <Image source={require('../../assets/images/icons/marker.png')} style={s.emptyMarker} />
            <View style={s.emptyRoad}>
              {[0, 1, 2].map((i) => <View key={i} style={s.emptyDash} />)}
            </View>
            <Text style={s.emptyTitle}>Estacionou? Guarde a vaga.</Text>
            <Text style={s.emptyText}>Leva poucos segundos e vale para rua, shopping ou estacionamento com andares.</Text>
            <View style={s.benefits}>
              {BENEFITS.map((b) => (
                <View key={b.text} style={s.benefit}>
                  <View style={s.benefitIcon}>
                    <Image source={b.icon} style={s.benefitGlyph} />
                  </View>
                  <Text style={s.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Plate>
              <MiniMap coords={spot} action="Ampliar mapa" onPress={() => router.push('/map')} />
              <View style={s.statsRow}>
                <View style={s.stat}>
                  <Text style={s.big} numberOfLines={1} adjustsFontSizeToFit>{formatDistance(distance)}</Text>
                  <Text style={s.label}>{distance == null ? 'distância indisponível' : 'até o carro'}</Text>
                </View>
                <View style={s.stat}>
                  <Text
                    style={[s.big, remaining != null && remaining <= WARN_BEFORE_MS && s.bigAlert]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    accessibilityLabel={remaining != null ? `Tempo restante ${formatRemaining(remaining)}` : undefined}
                  >
                    {remaining != null ? formatRemaining(remaining) : '—'}
                  </Text>
                  <Text style={s.label}>
                    {remaining == null ? 'sem parquímetro' : remaining > 0 ? `vence às ${formatClock(spot.expiresAt!)}` : 'tempo vencido'}
                  </Text>
                </View>
              </View>
              {delta != null && <Text style={s.floorBadge}>{floorText(delta)}</Text>}
              {spot.address ? <Text style={s.address}>{spot.address}</Text> : null}
              {details ? <Text style={plateText.body}>{details}</Text> : null}
              <Text style={plateText.hint}>Salva às {formatClock(spot.savedAt)}</Text>
            </Plate>

            <Text style={s.section}>{spot.expiresAt ? 'Renovar parquímetro' : 'Parquímetro ou Zona Azul'}</Text>
            <View style={s.chips}>
              {DURATIONS.map((d) => (
                <Chip key={d.min} label={d.label} onPress={() => handleTimer(spot, d.min)} />
              ))}
              {spot.expiresAt && <Chip label="Sem tempo" onPress={() => handleTimer(spot, null)} />}
            </View>
            <Text style={s.sectionHint}>Avisamos 10 minutos antes de vencer.</Text>

            <View style={s.secondary}>
              <View style={s.flex}>
                <OutlineButton label="Editar vaga" onPress={() => router.push('/spot')} />
              </View>
              <View style={s.flex}>
                <OutlineButton label="Liberar vaga" onPress={handleRelease} />
              </View>
            </View>
          </>
        )}
        {app && <WidgetCard spot={spot} />}
      </ScrollView>

      {app && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          {spot ? (
            <Button
              label="Ver caminho até o carro"
              icon={require('../../assets/images/icons/icon-route.png')}
              onPress={() => router.push({ pathname: '/map', params: { route: '1' } })}
            />
          ) : (
            <Button
              label="Adicionar vaga"
              icon={require('../../assets/images/icons/icon-locate.png')}
              onPress={() => router.push({ pathname: '/spot', params: { isNew: '1' } })}
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.concrete },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  flex: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 40, height: 40, borderRadius: 10 },
  headerTitle: { flex: 1, color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 28 },
  syncPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 12,
    borderRadius: 999, backgroundColor: Colors.white,
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.hint },
  syncDotOn: { backgroundColor: '#2E8B57' },
  syncText: { color: Colors.asphalt, fontSize: 13, fontWeight: '600' },

  banner: { backgroundColor: '#FFF4CC', borderLeftWidth: 4, borderLeftColor: Colors.marking, borderRadius: 8, padding: 12 },
  bannerText: { color: Colors.asphalt, fontSize: 14, lineHeight: 20 },

  empty: { alignItems: 'center', paddingTop: 24, gap: 12 },
  emptyMarker: { width: 80, height: 112 },
  emptyRoad: { flexDirection: 'row', gap: 10, marginTop: -8 },
  emptyDash: { width: 28, height: 8, borderRadius: 4, backgroundColor: Colors.marking },
  emptyTitle: { color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 34, textAlign: 'center', marginTop: 8 },
  emptyText: { color: Colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 320 },
  benefits: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  benefit: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 12, padding: 12,
  },
  benefitIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.sign, alignItems: 'center', justifyContent: 'center' },
  benefitGlyph: { width: 22, height: 22, tintColor: Colors.white, resizeMode: 'contain' },
  benefitText: { flex: 1, color: Colors.asphalt, fontSize: 15, lineHeight: 21 },

  statsRow: { flexDirection: 'row', gap: 16 },
  stat: { flex: 1 },
  big: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 52, lineHeight: 56, fontVariant: ['tabular-nums'] },
  bigAlert: { color: Colors.marking },
  label: { color: Colors.white, fontSize: 14, opacity: 0.85 },
  floorBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.marking, color: Colors.asphalt,
    fontFamily: Fonts.semi, fontSize: 18, paddingHorizontal: 10, paddingVertical: 2, borderRadius: 4,
  },
  address: { color: Colors.white, fontFamily: Fonts.semi, fontSize: 20, lineHeight: 24 },

  section: { color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 22, marginTop: 4 },
  sectionHint: { color: Colors.muted, fontSize: 14, marginTop: -4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: { flexDirection: 'row', gap: 10, marginTop: 4 },

  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: Colors.concrete, borderTopWidth: 1, borderTopColor: '#D6DAE0' },
});
