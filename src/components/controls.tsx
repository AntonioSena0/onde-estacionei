import {
  Image, Pressable, StyleSheet, Text, TextInput, View,
  type ImageSourcePropType, type TextInputProps,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

type Tone = 'light' | 'dark';
type PressProps = { label: string; onPress: () => void; disabled?: boolean };

/** Botão principal amarelo, da cor da faixa de solo, com ícone opcional à esquerda do texto. */
export function Button({ label, onPress, disabled, icon }: PressProps & { icon?: ImageSourcePropType }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, pressed && s.pressed, disabled && s.disabled]}
    >
      {icon && <Image source={icon} style={s.btnIcon} />}
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Botão secundário com contorno. `tone="dark"` é para usar sobre a placa azul;
 * `tone="light"` (padrão) é para fundos claros.
 */
export function OutlineButton({
  label, onPress, disabled, icon, tone = 'light',
}: PressProps & { icon?: ImageSourcePropType; tone?: Tone }) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.outline,
        dark ? s.outlineDark : s.outlineLight,
        pressed && (dark ? s.pressedDark : s.pressedLight),
        disabled && s.disabled,
      ]}
    >
      {icon && <Image source={icon} style={[s.outlineIcon, { tintColor: dark ? Colors.white : Colors.sign }]} />}
      <Text style={[s.outlineText, { color: dark ? Colors.white : Colors.sign }]}>{label}</Text>
    </Pressable>
  );
}

/** Pílula de escolha; quando `selected`, fica preenchida e é anunciada como selecionada. */
export function Chip({ label, onPress, selected, tone = 'light' }: PressProps & { selected?: boolean; tone?: Tone }) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        s.chip,
        dark ? s.chipDark : s.chipLight,
        pressed && (dark ? s.pressedDark : s.pressedLight),
        selected && (dark ? s.chipDarkOn : s.chipLightOn),
      ]}
    >
      <Text style={[s.chipText, { color: dark ? (selected ? Colors.sign : Colors.white) : selected ? Colors.white : Colors.sign }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Ação secundária com aparência de link sublinhado. */
export function LinkButton({ label, onPress, tone = 'light' }: PressProps & { tone?: Tone }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.link}>
      <Text style={[s.linkText, { color: tone === 'dark' ? Colors.white : Colors.sign }]}>{label}</Text>
    </Pressable>
  );
}

/** Campo de texto com rótulo, em fundo claro; `width` define a proporção dentro de uma linha. */
export function Field({
  label, hint, width = 1, ...props
}: TextInputProps & { label: string; hint?: string; width?: number }) {
  return (
    <View style={{ flex: width }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, props.multiline && s.inputMultiline]}
        placeholderTextColor={Colors.hint}
        accessibilityLabel={label}
        accessibilityHint={hint}
        {...props}
      />
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', gap: 10, backgroundColor: Colors.marking, borderRadius: 10, minHeight: 56,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  btnIcon: { width: 24, height: 24, tintColor: Colors.asphalt },
  btnText: { color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 24 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  pressedDark: { backgroundColor: Colors.signDark },
  pressedLight: { backgroundColor: '#DCE5F5' },

  outline: {
    flexDirection: 'row', gap: 8, borderWidth: 2, borderRadius: 10, minHeight: 48,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14,
  },
  outlineDark: { borderColor: Colors.white },
  outlineLight: { borderColor: Colors.sign, backgroundColor: Colors.white },
  outlineIcon: { width: 20, height: 20 },
  outlineText: { fontFamily: Fonts.semi, fontSize: 18 },

  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center' },
  chipDark: { borderColor: Colors.white },
  chipLight: { borderColor: Colors.sign, backgroundColor: Colors.white },
  chipDarkOn: { backgroundColor: Colors.white },
  chipLightOn: { backgroundColor: Colors.sign },
  chipText: { fontFamily: Fonts.semi, fontSize: 18 },

  link: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  linkText: { fontSize: 16, textDecorationLine: 'underline' },

  fieldLabel: { color: Colors.asphalt, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  fieldHint: { color: Colors.muted, fontSize: 13, marginTop: 4 },
  input: {
    backgroundColor: Colors.white, color: Colors.asphalt, borderRadius: 8, borderWidth: 1.5,
    borderColor: Colors.line, paddingHorizontal: 12, minHeight: 48, fontSize: 16,
  },
  inputMultiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
});
