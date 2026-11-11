import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera, Map as MapLibreMap, NativeUserLocation, type CameraRef, type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Button } from '@/components/controls';
import { MAP_STYLE_URL } from '@/components/mini-map';
import { Plate } from '@/components/plate';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts } from '@/constants/theme';
import { usePosition } from '@/hooks/use-position';
import { formatAddress, reverseGeocode, type Address } from '@/lib/address';
import type { Coords } from '@/lib/geo';
import { pickerStart, setPicked } from '@/lib/picker';

const SAO_PAULO: Coords = { latitude: -23.5505, longitude: -46.6333 };
const REVERSE_DELAY_MS = 600;

/**
 * Seletor de local em tela cheia: o pino fica fixo no centro e a pessoa arrasta o mapa (ou toca
 * num ponto) até o pino ficar sobre o carro. O endereço do ponto aparece embaixo; "Usar este
 * local" devolve o ponto ao formulário.
 */
export default function PickLocationScreen() {
  const insets = useSafeAreaInsets();
  const { access } = usePosition();
  const [start] = useState(() => pickerStart() ?? SAO_PAULO);
  const [center, setCenter] = useState<Coords>(start);
  const [address, setAddress] = useState<Address | null>(null);
  const [status, setStatus] = useState('Arraste o mapa até o pino ficar sobre o carro.');
  const cameraRef = useRef<CameraRef>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /** Quando o mapa para, o centro vira o local escolhido e o endereço é buscado após uma pausa curta. */
  function handleRegionDidChange(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
    const [longitude, latitude] = e.nativeEvent.center;
    const c = { latitude, longitude };
    setCenter(c);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const id = ++requestId.current;
      setStatus('Buscando o endereço deste ponto…');
      reverseGeocode(c)
        .then((a) => {
          if (id !== requestId.current) return;
          setAddress(a);
          setStatus(a ? formatAddress(a) : 'Endereço não encontrado. O ponto no mapa já basta.');
        })
        .catch(() => id === requestId.current && setStatus('Sem internet para buscar o endereço. O ponto no mapa já basta.'));
    }, REVERSE_DELAY_MS);
  }

  /** Leva o mapa até a posição atual do GPS. */
  async function handleMyLocation() {
    try {
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      cameraRef.current?.easeTo({ center: [coords.longitude, coords.latitude], zoom: 18, duration: 500 });
    } catch {
      setStatus('O GPS não respondeu. Arraste o mapa até o carro.');
    }
  }

  /** Devolve o ponto escolhido (e o endereço, se encontrado) ao formulário. */
  function handleConfirm() {
    setPicked({ coords: center, address });
    router.back();
  }

  return (
    <View style={s.root}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        compass={false}
        attributionPosition={{ top: insets.top + 72, left: 12 }}
        onRegionDidChange={handleRegionDidChange}
        onPress={(e) => cameraRef.current?.easeTo({ center: e.nativeEvent.lngLat, duration: 400 })}
      >
        <Camera ref={cameraRef} initialViewState={{ center: [start.longitude, start.latitude], zoom: 18 }} />
        {access === 'granted' && <NativeUserLocation />}
      </MapLibreMap>

      <View pointerEvents="none" style={s.pinLayer}>
        <Image source={require('../../assets/images/icons/marker.png')} style={s.pin} accessibilityLabel="Local escolhido" />
      </View>

      <ScreenHeader title="Escolher local" floating />

      <View style={[s.card, { paddingBottom: insets.bottom + 12 }]}>
        {access === 'granted' && (
          <Pressable
            onPress={handleMyLocation}
            accessibilityRole="button"
            accessibilityLabel="Ir para minha localização"
            style={({ pressed }) => [s.locate, pressed && s.pressed]}
          >
            <Image source={require('../../assets/images/icons/icon-locate.png')} style={s.locateIcon} />
          </Pressable>
        )}
        <Plate>
          <Text style={s.label}>Local da vaga</Text>
          <Text style={s.status} accessibilityLiveRegion="polite" numberOfLines={3}>{status}</Text>
          <Button label="Usar este local" onPress={handleConfirm} />
        </Plate>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.concrete },
  pinLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 48, height: 67, transform: [{ translateY: -30 }] },
  card: { position: 'absolute', left: 12, right: 12, bottom: 0, gap: 12 },
  locate: {
    alignSelf: 'flex-end', width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.sign,
    alignItems: 'center', justifyContent: 'center', elevation: 6, borderWidth: 3, borderColor: Colors.white,
  },
  pressed: { opacity: 0.8 },
  locateIcon: { width: 28, height: 28, tintColor: Colors.white },
  label: { color: Colors.white, fontFamily: Fonts.semi, fontSize: 18, opacity: 0.85 },
  status: { color: Colors.white, fontFamily: Fonts.semi, fontSize: 22, lineHeight: 26 },
});
