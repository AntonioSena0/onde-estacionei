import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button, Chip, Field, OutlineButton } from '@/components/controls';
import { MiniMap } from '@/components/mini-map';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Fonts } from '@/constants/theme';
import { usePosition } from '@/hooks/use-position';
import { usePressure } from '@/hooks/use-pressure';
import {
  formatAddress, geocode, lookupPostalCode, maskPostalCode, normalizePostalCode, reverseGeocode, type Address,
} from '@/lib/address';
import { altitudeFromPressure, distanceMeters, expiryFrom, formatClock, type Coords } from '@/lib/geo';
import { openPicker, takePicked } from '@/lib/picker';
import { currentSpot, setSpot } from '@/lib/store';
import { MAX_FLOOR, MAX_NOTE, parseSpot } from '@/lib/validation';

const SAME_SPOT_M = 50;
const DURATIONS = [
  { label: '30 min', min: 30 },
  { label: '1 h', min: 60 },
  { label: '2 h', min: 120 },
];
const MODES = [
  { key: 'gps', label: 'Onde estou' },
  { key: 'map', label: 'No mapa' },
  { key: 'postalCode', label: 'Pelo CEP' },
] as const;

type Mode = (typeof MODES)[number]['key'];
type Timer = 'keep' | null | number;
type Place = Pick<Address, 'street' | 'district' | 'city' | 'state'>;

const EMPTY_PLACE: Place = { street: '', district: '', city: '', state: '' };

/** Separa um endereço salvo em uma linha ("Rua, 10 - Bairro, Cidade/UF") nos campos do formulário. */
function splitSaved(address: string): { place: Place; number: string } {
  const cut = address.indexOf(' - ');
  if (cut < 0) return { place: { ...EMPTY_PLACE, district: address }, number: '' };
  const [street, number = ''] = address.slice(0, cut).split(', ');
  return { place: { ...EMPTY_PLACE, street, district: address.slice(cut + 3) }, number };
}

/**
 * Formulário para adicionar ou editar a vaga, em três seções: local (onde estou, no mapa ou
 * pelo CEP, sempre com a prévia do mapa), detalhes opcionais e tempo do parquímetro.
 * O botão Salvar fica fixo embaixo e só libera depois que há um local.
 */
export default function SpotFormScreen() {
  const insets = useSafeAreaInsets();
  const pressure = usePressure();
  const { position, access } = usePosition();
  const { isNew } = useLocalSearchParams<{ isNew?: string }>();
  const [initial] = useState(() => (isNew === '1' ? null : currentSpot()));
  const [saved] = useState(() => (initial ? splitSaved(initial.address) : null));

  const [mode, setMode] = useState<Mode>(initial ? 'map' : 'gps');
  const [coords, setCoords] = useState<Coords | null>(initial);
  const [postalCode, setPostalCode] = useState(initial?.postalCode ? maskPostalCode(initial.postalCode) : '');
  const [place, setPlace] = useState<Place>(saved?.place ?? EMPTY_PLACE);
  const [number, setNumber] = useState(saved?.number ?? '');
  const [floor, setFloor] = useState(initial?.floor ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [timer, setTimer] = useState<Timer>(initial?.expiresAt && initial.expiresAt > Date.now() ? 'keep' : null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const usedGps = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const picked = takePicked();
      if (!picked) return;
      setCoords(picked.coords);
      if (picked.address) fillAddress(picked.address);
      setStatus(null);
    }, []),
  );

  useEffect(() => {
    if (mode === 'gps' && !usedGps.current && access === 'granted') {
      usedGps.current = true;
      handleUseGps();
    }
  });

  /** Preenche os campos com um endereço encontrado, sem apagar o número já digitado. */
  function fillAddress(a: Address) {
    setPlace({ street: a.street, district: a.district, city: a.city, state: a.state });
    if (a.postalCode) setPostalCode(maskPostalCode(a.postalCode));
    if (a.number) setNumber(a.number);
  }

  /** Usa a posição atual do GPS como local da vaga e busca o endereço dela. */
  async function handleUseGps() {
    setBusy(true);
    setStatus('Buscando sua posição…');
    try {
      const { coords: c } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCoords(c);
      setStatus('Buscando o endereço…');
      const a = await reverseGeocode(c).catch(() => null);
      if (a) fillAddress(a);
      setStatus(a ? null : 'Posição salva. Endereço não encontrado: preencha a rua, se quiser.');
    } catch {
      setStatus('O GPS não respondeu. Vá para um local aberto ou escolha no mapa.');
    } finally {
      setBusy(false);
    }
  }

  /** Abre o seletor de local em tela cheia, começando no ponto atual (ou no GPS). */
  function handleOpenPicker() {
    openPicker(coords ?? position);
    router.push('/pick-location');
  }

  /** Busca o CEP no ViaCEP, preenche o endereço e encontra o ponto (com o número, se houver). */
  async function handlePostalCode() {
    const digits = normalizePostalCode(postalCode);
    if (!digits) return setStatus('Digite os 8 números do CEP.');
    setBusy(true);
    setStatus('Buscando o CEP…');
    try {
      const found = await lookupPostalCode(digits);
      if (!found) return setStatus('CEP não encontrado. Confira os números ou escolha no mapa.');
      fillAddress(found);
      const point = await geocode({ ...found, number }).catch(() => null);
      if (point) setCoords(point);
      setStatus(
        point
          ? 'Confira o ponto na prévia. Toque nela para ajustar a posição exata do carro.'
          : 'Achamos o endereço, mas não o ponto. Toque na prévia para marcar no mapa.',
      );
    } catch {
      setStatus('Não foi possível consultar o CEP agora. Escolha o local no mapa.');
    } finally {
      setBusy(false);
    }
  }

  /** Troca o modo de escolha do local; "Onde estou" já busca a posição na hora. */
  function handleMode(next: Mode) {
    setMode(next);
    setStatus(null);
    if (next === 'gps') {
      if (access === 'granted') handleUseGps();
      else setStatus('A localização está desligada. Use o mapa ou o CEP.');
    }
    if (next === 'map' && !coords) handleOpenPicker();
  }

  /**
   * Valida e salva a vaga. A altitude do barômetro só é guardada quando o local está a até 50 m
   * da pessoa, porque longe dali a pressão medida não é a do andar do carro.
   */
  async function handleSave() {
    if (!coords) return;
    const typedPostalCode = postalCode.trim();
    const digits = normalizePostalCode(typedPostalCode);
    if (typedPostalCode && !digits) return Alert.alert('CEP incompleto', 'Digite os 8 números do CEP ou apague o campo.');

    let altitude = initial?.altitude ?? null;
    if (pressure && position && distanceMeters(position, coords) <= SAME_SPOT_M) altitude = altitudeFromPressure(pressure);

    const parsed = parseSpot({
      latitude: coords.latitude,
      longitude: coords.longitude,
      savedAt: initial?.savedAt ?? Date.now(),
      altitude,
      floor,
      note,
      address: formatAddress({ ...place, number: number.trim() }),
      postalCode: digits ?? '',
      expiresAt: timer === 'keep' ? initial?.expiresAt : timer == null ? null : expiryFrom(timer),
    });
    if (!parsed.ok) return Alert.alert('Confira os dados', `O campo ${parsed.error}.`);
    await setSpot(parsed.value);
    router.back();
  }

  const placeHint = [place.district, [place.city, place.state].filter(Boolean).join('/')].filter(Boolean).join(', ');

  return (
    <KeyboardAvoidingView behavior="padding" style={s.root}>
      <ScreenHeader title={initial ? 'Editar vaga' : 'Nova vaga'} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.safety}>Salve com o carro parado. Mexer no celular dirigindo é infração gravíssima.</Text>

        <Text style={s.section} accessibilityRole="header">Local</Text>
        <View style={s.segment} accessibilityRole="radiogroup">
          {MODES.map((m) => (
            <View key={m.key} style={s.flex}>
              <Chip label={m.label} selected={mode === m.key} onPress={() => handleMode(m.key)} />
            </View>
          ))}
        </View>

        <MiniMap
          coords={coords}
          action={coords ? 'Ajustar no mapa' : 'Escolher no mapa'}
          emptyText="Toque para marcar o carro no mapa"
          onPress={handleOpenPicker}
        />

        {mode === 'gps' && (
          <OutlineButton
            label="Atualizar minha posição"
            icon={require('../../assets/images/icons/icon-locate.png')}
            onPress={handleUseGps}
            disabled={busy || access !== 'granted'}
          />
        )}
        {mode === 'postalCode' && (
          <View style={s.row}>
            <Field
              label="CEP"
              placeholder="00000-000"
              value={postalCode}
              onChangeText={(t) => setPostalCode(maskPostalCode(t))}
              keyboardType="number-pad"
              maxLength={9}
              returnKeyType="search"
              onSubmitEditing={handlePostalCode}
              width={1.4}
            />
            <View style={s.searchCell}>
              <OutlineButton
                label="Buscar"
                icon={require('../../assets/images/icons/icon-search.png')}
                onPress={handlePostalCode}
                disabled={busy}
              />
            </View>
          </View>
        )}
        {status ? <Text style={s.status} accessibilityLiveRegion="polite">{status}</Text> : null}

        <View style={s.row}>
          <Field
            label="Rua"
            placeholder="Preenchida pelo GPS, mapa ou CEP"
            value={place.street}
            onChangeText={(street) => setPlace({ ...place, street })}
            maxLength={80}
            width={2.6}
          />
          <Field label="Número" placeholder="100" value={number} onChangeText={setNumber} maxLength={10} keyboardType="numbers-and-punctuation" />
        </View>
        {placeHint ? <Text style={s.placeHint}>{placeHint}</Text> : null}
        {mode !== 'postalCode' && postalCode ? <Text style={s.placeHint}>CEP {postalCode}</Text> : null}

        <Text style={s.section} accessibilityRole="header">Detalhes</Text>
        <Field label="Andar (opcional)" placeholder="Ex.: G2, 3º subsolo" value={floor} onChangeText={setFloor} maxLength={MAX_FLOOR} />
        <Field
          label="Descrição (opcional)"
          placeholder="Ex.: vaga B14, perto do elevador, carro prata"
          value={note}
          onChangeText={setNote}
          maxLength={MAX_NOTE}
          multiline
          hint={`${note.length}/${MAX_NOTE}`}
        />

        <Text style={s.section} accessibilityRole="header">Parquímetro ou Zona Azul</Text>
        <View style={s.chips}>
          {initial?.expiresAt && initial.expiresAt > Date.now() ? (
            <Chip label={`Manter (até ${formatClock(initial.expiresAt)})`} selected={timer === 'keep'} onPress={() => setTimer('keep')} />
          ) : null}
          <Chip label="Sem tempo" selected={timer === null} onPress={() => setTimer(null)} />
          {DURATIONS.map((d) => (
            <Chip key={d.min} label={d.label} selected={timer === d.min} onPress={() => setTimer(d.min)} />
          ))}
        </View>
        <Text style={s.placeHint}>Com tempo marcado, avisamos 10 minutos antes de vencer.</Text>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!coords && <Text style={s.footerHint}>Escolha o local para salvar.</Text>}
        <Button label={initial ? 'Salvar alterações' : 'Salvar vaga'} onPress={handleSave} disabled={busy || !coords} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.concrete },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  flex: { flex: 1 },
  safety: {
    color: Colors.asphalt, fontSize: 14, lineHeight: 20, backgroundColor: '#FFF4CC',
    borderLeftWidth: 4, borderLeftColor: Colors.marking, borderRadius: 8, padding: 10,
  },
  section: { color: Colors.asphalt, fontFamily: Fonts.bold, fontSize: 24, marginTop: 8 },
  segment: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  searchCell: { flex: 1 },
  status: { color: Colors.sign, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  placeHint: { color: Colors.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 6, backgroundColor: Colors.concrete, borderTopWidth: 1, borderTopColor: '#D6DAE0' },
  footerHint: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
});
