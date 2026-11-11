import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import { CarLayer } from '@/components/car-layer';
import { Colors, Fonts } from '@/constants/theme';
import type { Coords } from '@/lib/geo';

export const MAP_STYLE_URL =
  process.env.EXPO_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty';

type Props = { coords: Coords | null; onPress: () => void; action: string; height?: number; emptyText?: string };

/**
 * Prévia do mapa que não se mexe: mostra o pino da vaga e, ao ser tocada, abre o mapa em tela
 * cheia. Uma camada por cima recebe o toque, para o gesto nunca arrastar o mapa por engano.
 */
export function MiniMap({ coords, onPress, action, height = 170, emptyText = 'Nenhum local escolhido' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action}
      style={[s.frame, { height }]}
    >
      {coords ? (
        <MapLibreMap
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          dragPan={false}
          touchZoom={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
          compass={false}
          logo={false}
          attributionPosition={{ top: 4, right: 4 }}
        >
          <Camera center={[coords.longitude, coords.latitude]} zoom={16} duration={0} />
          <CarLayer coords={coords} />
        </MapLibreMap>
      ) : (
        <View style={s.empty}>
          <Image source={require('../../assets/images/icons/marker.png')} style={[s.marker, s.markerEmpty]} />
          <Text style={s.emptyText}>{emptyText}</Text>
        </View>
      )}
      <View style={StyleSheet.absoluteFill} />
      <View style={s.badge}>
        <Text style={s.badgeText}>{action}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  frame: {
    borderRadius: 10, overflow: 'hidden', borderWidth: 3, borderColor: Colors.white, backgroundColor: Colors.concrete,
  },
  marker: { width: 34, height: 48 },
  markerEmpty: { opacity: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { color: Colors.muted, fontSize: 14 },
  badge: {
    position: 'absolute', left: 8, bottom: 8, backgroundColor: Colors.white, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, elevation: 3,
  },
  badgeText: { color: Colors.sign, fontFamily: Fonts.semi, fontSize: 16 },
});
