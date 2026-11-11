import * as SQLite from 'expo-sqlite';
import type { LocalState } from './reconcile';
import { getDbKey } from './secrets';
import type { Spot } from './validation';

export type StoredState = LocalState & { notificationId: string | null };

type Row = {
  latitude: number | null;
  longitude: number | null;
  savedAt: number | null;
  altitude: number | null;
  floor: string;
  note: string;
  address: string;
  postalCode: string;
  expiresAt: number | null;
  notificationId: string | null;
  version: number;
  dirty: number;
};

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS vaga (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    latitude       REAL CHECK (latitude BETWEEN -90 AND 90),
    longitude      REAL CHECK (longitude BETWEEN -180 AND 180),
    savedAt        INTEGER,
    altitude       REAL,
    floor          TEXT NOT NULL DEFAULT '' CHECK (length(floor) <= 20),
    note           TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 120),
    expiresAt      INTEGER CHECK (expiresAt IS NULL OR expiresAt > savedAt),
    notificationId TEXT,
    version        INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    dirty          INTEGER NOT NULL DEFAULT 0 CHECK (dirty IN (0, 1)),
    CHECK ((latitude IS NULL) = (longitude IS NULL) AND (latitude IS NULL) = (savedAt IS NULL))
  );
  INSERT OR IGNORE INTO vaga (id) VALUES (1);
  `,
  `
  ALTER TABLE vaga ADD COLUMN address TEXT NOT NULL DEFAULT '' CHECK (length(address) <= 160);
  ALTER TABLE vaga ADD COLUMN cep TEXT NOT NULL DEFAULT '' CHECK (cep = '' OR (length(cep) = 8 AND cep NOT GLOB '*[^0-9]*'));
  `,
  `
  ALTER TABLE vaga RENAME TO spot;
  ALTER TABLE spot RENAME COLUMN cep TO postalCode;
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre o banco local uma vez por processo (o app e o widget rodam em processos JS separados).
 * O arquivo é criptografado com SQLCipher; a chave vem do armazenamento seguro e precisa ser
 * o primeiro comando da conexão. Depois aplica, em uma transação, só as migrações que o
 * arquivo ainda não recebeu (a versão fica em PRAGMA user_version), sem apagar dados.
 */
function getDb() {
  dbPromise ??= (async () => {
    const key = await getDbKey();
    if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Chave do banco corrompida.');
    const db = await SQLite.openDatabaseAsync('onde-estacionei.db');
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    const { user_version: current } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!;
    if (current < MIGRATIONS.length) {
      await db.withTransactionAsync(async () => {
        for (const sql of MIGRATIONS.slice(current)) await db.execAsync(sql);
        await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length}`);
      });
    }
    return db;
  })();
  return dbPromise;
}

/** Converte a linha única da tabela no estado do app. */
function toState(r: Row): StoredState {
  const spot: Spot | null =
    r.latitude == null || r.longitude == null || r.savedAt == null
      ? null
      : {
          latitude: r.latitude,
          longitude: r.longitude,
          savedAt: r.savedAt,
          altitude: r.altitude,
          floor: r.floor,
          note: r.note,
          address: r.address,
          postalCode: r.postalCode,
          expiresAt: r.expiresAt,
        };
  return { spot, version: r.version, dirty: r.dirty === 1, notificationId: r.notificationId };
}

/** Lê o estado salvo: a vaga atual (ou nenhuma), a versão do servidor e se há mudança não enviada. */
export async function loadState(): Promise<StoredState> {
  const db = await getDb();
  return toState((await db.getFirstAsync<Row>('SELECT * FROM spot WHERE id = 1'))!);
}

/** Grava o estado inteiro na linha única, com parâmetros (nunca concatenando valores no SQL). */
export async function saveState(s: StoredState): Promise<void> {
  const db = await getDb();
  const v = s.spot;
  await db.runAsync(
    `UPDATE spot SET latitude = ?, longitude = ?, savedAt = ?, altitude = ?, floor = ?, note = ?,
       address = ?, postalCode = ?, expiresAt = ?, notificationId = ?, version = ?, dirty = ?
     WHERE id = 1`,
    v?.latitude ?? null, v?.longitude ?? null, v?.savedAt ?? null, v?.altitude ?? null,
    v?.floor ?? '', v?.note ?? '', v?.address ?? '', v?.postalCode ?? '', v?.expiresAt ?? null,
    s.notificationId, s.version, s.dirty ? 1 : 0,
  );
}
