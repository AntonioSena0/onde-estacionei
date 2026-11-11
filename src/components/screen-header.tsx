import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts } from '@/constants/theme';

/**
 * Cabeçalho das telas internas: botão Voltar com área de toque de 48 dp e o título.
 * `floating` deixa o cabeçalho sobre o mapa, como uma pílula branca.
 */
export function ScreenHeader({ title, floating }: { title: string; floating?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[floating ? s.floating : s.bar, { paddingTop: insets.top + (floating ? 8 : 4) }]} pointerEvents="box-none">
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
        style={({ pressed }) => [s.back, floating && s.pill, pressed && s.pressed]}
      >
        <Text style={s.backText}>‹  Voltar</Text>
      </Pressable>
      <Text style={[s.title, floating && s.pillTitle]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 4,
    backgroundColor: Colors.concrete,
  },
  floating: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
  },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999 },
  pill: { backgroundColor: Colors.white, elevation: 4, paddingHorizontal: 16 },
  pressed: { opacity: 0.7 },
  backText: { color: Colors.sign, fontFamily: Fonts.semi, fontSize: 20 },
  title: { flex: 1, color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 26 },
  pillTitle: {
    flex: 0, backgroundColor: Colors.white, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 20, overflow: 'hidden', elevation: 4,
  },
});
