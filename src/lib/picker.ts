import type { Address } from './address';
import type { Coords } from './geo';

type PickedPlace = { coords: Coords; address: Address | null };

let start: Coords | null = null;
let picked: PickedPlace | null = null;

/** Guarda de onde o seletor de local deve começar, antes de abrir a tela. */
export function openPicker(from: Coords | null) {
  start = from;
  picked = null;
}

/** Ponto inicial do seletor de local (a vaga atual, o GPS ou nada). */
export function pickerStart(): Coords | null {
  return start;
}

/** Registra o local escolhido no seletor, para o formulário ler quando voltar ao foco. */
export function setPicked(place: PickedPlace) {
  picked = place;
}

/** Entrega o local escolhido uma única vez e limpa o registro. */
export function takePicked(): PickedPlace | null {
  const p = picked;
  picked = null;
  return p;
}
