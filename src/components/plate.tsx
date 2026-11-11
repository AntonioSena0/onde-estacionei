import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

/**
 * A "placa": fundo azul de sinalização com o filete branco interno das placas de trânsito.
 * É o elemento visual marcante do app; o resto da interface fica neutro em volta dela.
 */
export function Plate({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.plate, style]}>
      <View style={s.inner}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  plate: {
    padding: 5, borderRadius: 14, backgroundColor: Colors.sign,
    elevation: 8, shadowColor: Colors.asphalt, shadowOpacity: 0.35, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  inner: { borderRadius: 10, borderWidth: 2, borderColor: Colors.white, padding: 18, gap: 12 },
});

export const plateText = StyleSheet.create({
  body: { color: Colors.white, fontSize: 15, lineHeight: 22, opacity: 0.92 },
  hint: { color: Colors.white, fontSize: 13, opacity: 0.7, textAlign: 'center' },
});
