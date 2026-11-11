import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import type { Coords } from '@/lib/geo';

/**
 * Desenha o pino do carro (o mesmo da logo) como símbolo nativo do mapa, ancorado pela ponta
 * no ponto exato da vaga. Fica sempre visível, mesmo sobre nomes de ruas.
 */
export function CarLayer({ coords }: { coords: Coords }) {
  return (
    <>
      <Images images={{ car: require('../../assets/images/icons/marker.png') }} />
      <GeoJSONSource
        id="car"
        data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [coords.longitude, coords.latitude] } }}
      >
        <Layer
          id="car-pin"
          type="symbol"
          layout={{
            'icon-image': 'car',
            'icon-anchor': 'bottom',
            'icon-size': 0.42,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
