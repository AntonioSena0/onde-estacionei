import { useEffect, useState } from 'react';
import { Alert, AppState, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { getWidgetInfo, requestPinWidget, WidgetPreview } from 'react-native-android-widget';
import { OutlineButton } from '@/components/controls';
import { Colors, Fonts } from '@/constants/theme';
import type { Spot } from '@/lib/validation';
import { ParkingWidget, WIDGET_NAME, widgetData, type WidgetData } from '@/widget/parking-widget';

const MANUAL_STEPS =
  '1. Segure o dedo num espaço vazio da tela inicial.\n2. Toque em Widgets.\n3. Procure "Onde Estacionei?" e arraste para a tela.';
const PREVIEW_HEIGHT = 200;

/**
 * Cartão da home que mostra o widget de verdade (mapa com a rota, distância e parquímetro) e o
 * coloca na tela inicial com um toque, pelo pedido nativo do Android. Se o launcher não aceitar
 * o pedido, explica o passo a passo manual. Some quando o widget já está na tela inicial
 * (conferido ao abrir e ao voltar para o app). A prévia é refeita quando a vaga muda.
 */
export function WidgetCard({ spot }: { spot: Spot | null }) {
  const [placed, setPlaced] = useState(true);
  const [data, setData] = useState<WidgetData | null>(null);
  const width = Math.min(useWindowDimensions().width - 64, 420);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const check = () => getWidgetInfo(WIDGET_NAME).then((list) => setPlaced(list.length > 0), () => setPlaced(false));
    check();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || placed) return;
    let alive = true;
    widgetData({ width, height: PREVIEW_HEIGHT }).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [spot, placed, width]);

  /** Pede ao launcher para adicionar o widget; sem suporte, mostra como fazer à mão. */
  async function handleAdd() {
    const ok = await requestPinWidget({ widgetName: WIDGET_NAME }).catch(() => false);
    if (!ok) Alert.alert('Adicione pela tela inicial', MANUAL_STEPS);
  }

  if (Platform.OS !== 'android' || placed) return null;

  return (
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">Widget na tela inicial</Text>
      <Text style={s.text}>O mapa com o caminho até o carro, a distância e o tempo do parquímetro, sem abrir o app.</Text>
      <View style={[s.preview, { height: PREVIEW_HEIGHT }]} accessible accessibilityLabel="Prévia do widget">
        {data && (
          <WidgetPreview
            width={width}
            height={PREVIEW_HEIGHT}
            renderWidget={() => <ParkingWidget {...data} width={width} height={PREVIEW_HEIGHT} />}
          />
        )}
      </View>
      <OutlineButton label="Adicionar à tela inicial" onPress={handleAdd} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, gap: 10 },
  title: { color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 22 },
  text: { color: Colors.muted, fontSize: 15, lineHeight: 21 },
  preview: { alignItems: 'center', justifyContent: 'center' },
});
