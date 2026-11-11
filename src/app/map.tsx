import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera, GeoJSONSource, Layer, Map as MapLibreMap, NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import { CarLayer } from '@/components/car-layer';
import { Button, OutlineButton } from '@/components/controls';
import { MAP_STYLE_URL } from '@/components/mini-map';
import { Plate, plateText } from '@/components/plate';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts } from '@/constants/theme';
import { usePosition } from '@/hooks/use-position';
import { boundsOf, distanceMeters, formatDistance } from '@/lib/geo';
import { fetchWalkingRoute, type WalkingRoute } from '@/lib/route';
import { currentSpot, subscribe, type AppState } from '@/lib/store';

/**
 * Mapa em tela cheia com o carro, a sua posição e a rota a pé. A câmera é declarativa:
 * mostra o carro, ou a rota inteira acima do cartão de baixo, cuja altura é medida na tela.
 * Aberta com `?rota=1`, traça a rota assim que o GPS responder.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { route: autoRoute } = useLocalSearchParams<{ route?: string }>();
  const { position, access } = usePosition();
  const [spot, setSpot] = useState(currentSpot);
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardHeight, setCardHeight] = useState(260);
  const [focus, setFocus] = useState<'car' | 'route'>('car');
  const autoRouted = useRef(false);

  useEffect(() => subscribe((s: AppState) => setSpot(s.spot)), []);

  useEffect(() => {
    if (autoRoute !== '1' || autoRouted.current || !position || !spot) return;
    autoRouted.current = true;
    handleRoute();
  });

  /** Busca a rota a pé da posição atual até o carro e enquadra o caminho inteiro. */
  async function handleRoute() {
    if (!position || !spot) return;
    setBusy(true);
    const next = await fetchWalkingRoute(position, spot);
    setRoute(next);
    setFocus('route');
    setBusy(false);
  }

  /** Abre a vaga no app de mapas do celular, para quem preferir a navegação de lá. */
  function openExternal() {
    if (!spot) return;
    const { latitude: lat, longitude: lng } = spot;
    const url = Platform.OS === 'ios'
      ? `maps://?q=Meu%20carro&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(Meu%20carro)`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`));
  }

  if (!spot) {
    return (
      <View style={s.root}>
        <ScreenHeader title="Mapa" />
        <View style={s.center}>
          <Text style={s.emptyText}>Nenhuma vaga salva.</Text>
          <OutlineButton label="Voltar para o início" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const padding = { top: insets.top + 80, right: 48, bottom: cardHeight + 32, left: 48 };
  const showRoute = focus === 'route' && route;
  const meters = route?.meters ?? (position ? distanceMeters(position, spot) : null);

  return (
    <View style={s.root}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        compass
        compassPosition={{ top: insets.top + 72, right: 12 }}
        attributionPosition={{ top: insets.top + 72, left: 12 }}
        logo={false}
      >
        {showRoute ? (
          <Camera bounds={boundsOf(route.coords)} padding={padding} duration={700} />
        ) : (
          <Camera center={[spot.longitude, spot.latitude]} zoom={17} padding={padding} duration={700} />
        )}
        {access === 'granted' && <NativeUserLocation />}
        {route && (
          <GeoJSONSource
            id="route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route.coords.map((c) => [c.longitude, c.latitude]) },
            }}
          >
            <Layer
              id="route-casing"
              type="line"
              paint={{ 'line-color': Colors.white, 'line-width': 10 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="route-line"
              type="line"
              paint={{ 'line-color': Colors.sign, 'line-width': 6, ...(route.straight && { 'line-dasharray': [1.5, 1.5] }) }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        )}
        <CarLayer coords={spot} />
      </MapLibreMap>

      <ScreenHeader title="Seu carro" floating />

      <View
        style={[s.card, { paddingBottom: insets.bottom + 12 }]}
        onLayout={(e) => setCardHeight(Math.round(e.nativeEvent.layout.height))}
      >
        <Plate>
          <View style={s.row}>
            <Text style={s.big} numberOfLines={1} adjustsFontSizeToFit>{formatDistance(meters)}</Text>
            <Text style={s.walk}>
              {route?.minutes ? `${route.minutes} min a pé` : route?.straight ? 'em linha reta' : 'até o carro'}
            </Text>
          </View>
          {spot.address ? <Text style={s.address} numberOfLines={2}>{spot.address}</Text> : null}
          {route?.straight && (
            <Text style={s.notice}>Sem rota pelas ruas agora. A linha tracejada mostra a direção do carro.</Text>
          )}
          {access !== 'granted' && (
            <Text style={s.notice}>Ative a localização para ver a distância e traçar a rota.</Text>
          )}
          <Button
            label={busy ? 'Calculando o caminho…' : route ? 'Atualizar rota' : 'Traçar rota a pé'}
            icon={require('../../assets/images/icons/icon-route.png')}
            onPress={handleRoute}
            disabled={busy || !position}
          />
          <View style={s.actions}>
            <View style={s.flex}>
              <OutlineButton
                tone="dark"
                label={focus === 'route' ? 'Ver só o carro' : 'Ver a rota'}
                onPress={() => setFocus(focus === 'route' ? 'car' : 'route')}
                disabled={!route}
              />
            </View>
            <View style={s.flex}>
              <OutlineButton tone="dark" label="Abrir em outro app" onPress={openExternal} />
            </View>
          </View>
          <Text style={plateText.hint}>Use a rota a pé com atenção ao trânsito.</Text>
        </Plate>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.concrete },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { color: Colors.muted, fontSize: 16 },
  card: { position: 'absolute', left: 12, right: 12, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  big: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 48, lineHeight: 52 },
  walk: { color: Colors.white, fontFamily: Fonts.semi, fontSize: 22, flexShrink: 1 },
  address: { color: Colors.white, fontSize: 15, lineHeight: 21, opacity: 0.92 },
  notice: { color: Colors.marking, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
