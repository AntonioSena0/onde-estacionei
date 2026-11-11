'use no memo';

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { StaticMapImageManager } from '@maplibre/maplibre-react-native';
import {
  FlexWidget, ImageWidget, OverlapWidget, TextWidget, requestWidgetUpdate,
  type WidgetInfo, type WidgetTaskHandlerProps,
} from 'react-native-android-widget';
import { MAP_STYLE_URL } from '@/components/mini-map';
import { loadState } from '@/lib/db';
import { distanceMeters, formatClock, formatDistance, type Coords } from '@/lib/geo';
import { fetchWalkingRoute } from '@/lib/route';
import type { Spot } from '@/lib/validation';
import { paddedBounds, routeStyle } from '@/lib/widget-map';

export const WIDGET_NAME = 'ParkingSpot';

const BAR_HEIGHT = 68;
const DEEP_LINK = 'ondeestacionei://map?route=1';

export type WidgetData = {
  spot: Spot | null;
  distance: number | null;
  walkMinutes: number | null;
  now: number;
  map: string | null;
};

type Size = { width: number; height: number };

let baseStyle: Record<string, unknown> | null = null;

/**
 * Gera a imagem do mapa do widget (PNG em data URI) com a rota a pé da sua última posição até o
 * carro. Sem posição, mostra só o carro. Usa o mesmo mapa gratuito do app e o OSRM; se algo
 * falhar (sem internet, por exemplo), devolve null e o widget fica só com os números.
 */
async function mapImage(spot: Spot, from: Coords | null, size: Size) {
  try {
    baseStyle ??= (await (await fetch(MAP_STYLE_URL)).json()) as Record<string, unknown>;
    const route = from ? await fetchWalkingRoute(from, spot) : null;
    const camera = route
      ? { bounds: paddedBounds(route.coords) }
      : { center: [spot.longitude, spot.latitude] as [number, number], zoom: 16 };
    const map = await StaticMapImageManager.createImage({
      mapStyle: routeStyle(baseStyle, spot, route),
      width: Math.round(size.width),
      height: Math.round(size.height - BAR_HEIGHT),
      output: 'base64',
      ...camera,
    });
    return { map, route };
  } catch {
    return { map: null, route: null };
  }
}

/**
 * Junta os dados do widget: a vaga salva, a última posição conhecida (sem ligar o GPS) e o mapa
 * com a rota no tamanho do widget. Se o banco falhar, devolve "sem vaga" para o widget nunca
 * ficar em branco. Sem `size`, pula o mapa (é o caso da prévia dentro do app).
 */
export async function widgetData(size?: Size): Promise<WidgetData> {
  const { spot } = await loadState().catch(() => ({ spot: null }));
  const now = Date.now();
  if (!spot) return { spot, distance: null, walkMinutes: null, now, map: null };
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  const from = last ? { latitude: last.coords.latitude, longitude: last.coords.longitude } : null;
  const { map, route } = size ? await mapImage(spot, from, size) : { map: null, route: null };
  const walked = route && !route.straight ? route : null;
  return {
    spot,
    distance: walked?.meters ?? (from ? distanceMeters(from, spot) : null),
    walkMinutes: walked?.minutes ?? null,
    now,
    map,
  };
}

/** Texto do parquímetro: minutos restantes e horário de vencimento, ou o aviso de vencido. */
function timerText(spot: Spot, now: number) {
  if (!spot.expiresAt) return { big: 'Livre', small: 'sem parquímetro' };
  const min = Math.ceil((spot.expiresAt - now) / 60000);
  if (min <= 0) return { big: 'Vencido', small: `venceu às ${formatClock(spot.expiresAt)}` };
  const big = min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
  return { big, small: `vence às ${formatClock(spot.expiresAt)}` };
}

/**
 * Desenha o widget da tela inicial: o mapa com a rota até o carro ocupando a largura toda e,
 * embaixo, a faixa azul com a distância e o tempo do parquímetro. Tocar abre o mapa do app já
 * traçando a rota. O Android só redesenha widgets a cada 30 minutos, então o horário de
 * vencimento é a informação confiável; os minutos são os de quando o widget foi desenhado.
 * O arquivo começa com "use no memo" porque a biblioteca não aceita componentes
 * transformados pelo React Compiler (o widget quebrava com "Invalid Hook Call").
 */
export function ParkingWidget({ spot, distance, walkMinutes, now, map, width, height }: WidgetData & Size) {
  if (!spot) {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'ondeestacionei://spot?isNew=1' }}
        accessibilityLabel="Nenhuma vaga salva. Toque para guardar onde estacionou."
        style={{
          height: 'match_parent', width: 'match_parent', backgroundColor: '#1D4FA8',
          borderRadius: 20, padding: 18, justifyContent: 'center',
        }}
      >
        <TextWidget text="Nenhuma vaga salva" style={{ fontSize: 22, color: '#FFFFFF', fontWeight: 'bold' }} />
        <TextWidget text="Toque para guardar onde estacionou" style={{ fontSize: 15, color: '#F5C400', marginTop: 4 }} />
      </FlexWidget>
    );
  }

  const timer = timerText(spot, now);
  const mapHeight = height - BAR_HEIGHT;
  const walk = walkMinutes ? `${walkMinutes} min a pé` : 'até o carro';
  const place = [spot.floor && `Andar ${spot.floor}`, spot.note].filter(Boolean).join(', ');

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: DEEP_LINK }}
      accessibilityLabel={`${formatDistance(distance)} até o carro. Parquímetro: ${timer.big}, ${timer.small}.`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#1D4FA8', borderRadius: 20 }}
    >
      <OverlapWidget style={{ width: 'match_parent', height: mapHeight }}>
        {map ? (
          <ImageWidget image={map as `data:image${string}`} imageWidth={width} imageHeight={mapHeight} resizeMode="cover" radius={20} />
        ) : (
          <FlexWidget
            style={{
              width: 'match_parent', height: mapHeight, backgroundColor: '#163E86',
              borderTopLeftRadius: 20, borderTopRightRadius: 20, justifyContent: 'center', alignItems: 'center',
            }}
          >
            <TextWidget text="Mapa indisponível sem internet" style={{ fontSize: 14, color: '#FFFFFF' }} />
          </FlexWidget>
        )}
        {place ? (
          <FlexWidget style={{ marginTop: 10, marginLeft: 10, backgroundColor: '#F5C400', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <TextWidget text={place} maxLines={1} style={{ fontSize: 13, color: '#33373B', fontWeight: 'bold' }} />
          </FlexWidget>
        ) : null}
      </OverlapWidget>
      <FlexWidget
        style={{
          width: 'match_parent', height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, flexGap: 12,
        }}
      >
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={formatDistance(distance)} style={{ fontSize: 24, color: '#FFFFFF', fontWeight: 'bold' }} />
          <TextWidget text={walk} style={{ fontSize: 13, color: '#FFFFFF' }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, alignItems: 'flex-end' }}>
          <TextWidget text={timer.big} style={{ fontSize: 24, color: '#F5C400', fontWeight: 'bold' }} />
          <TextWidget text={timer.small} style={{ fontSize: 13, color: '#FFFFFF' }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/** Desenha o widget no tamanho que ele ocupa na tela inicial. */
async function render(info: WidgetInfo) {
  const size = { width: info.width, height: info.height };
  return <ParkingWidget {...await widgetData(size)} {...size} />;
}

/** Responde ao Android quando o widget é adicionado, atualizado (a cada 30 min) ou redimensionado. */
export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(await render(widgetInfo));
}

/** Redesenha o widget na hora; o app chama quando a vaga muda e quando vai para o segundo plano. */
export async function refreshWidget() {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: render }).catch(() => {});
}
