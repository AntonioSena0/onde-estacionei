import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RemoteState } from '../src/lib/reconcile.ts';
import type { Spot } from '../src/lib/validation.ts';

export type Device = { id: number; userId: number };

const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS usuarios (
    id        INTEGER PRIMARY KEY,
    nome      TEXT    NOT NULL CHECK (length(nome) BETWEEN 1 AND 60),
    versao    INTEGER NOT NULL DEFAULT 0 CHECK (versao >= 0),
    criado_em INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dispositivos (
    id          INTEGER PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome        TEXT    NOT NULL CHECK (length(nome) BETWEEN 1 AND 60),
    token_hash  TEXT    NOT NULL UNIQUE CHECK (length(token_hash) = 64),
    criado_em   INTEGER NOT NULL,
    revogado_em INTEGER
  );

  CREATE TABLE IF NOT EXISTS vagas (
    id             INTEGER PRIMARY KEY,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    latitude       REAL    NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude      REAL    NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    salva_em       INTEGER NOT NULL,
    altitude       REAL,
    andar          TEXT    NOT NULL DEFAULT '' CHECK (length(andar) <= 20),
    referencia     TEXT    NOT NULL DEFAULT '' CHECK (length(referencia) <= 120),
    vence_em       INTEGER CHECK (vence_em IS NULL OR vence_em > salva_em),
    liberada_em    INTEGER,
    atualizada_por INTEGER REFERENCES dispositivos(id) ON DELETE SET NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS vagas_uma_ativa_por_usuario
    ON vagas(usuario_id) WHERE liberada_em IS NULL;
  CREATE INDEX IF NOT EXISTS dispositivos_usuario ON dispositivos(usuario_id);
  `,
  `
  ALTER TABLE vagas ADD COLUMN endereco TEXT NOT NULL DEFAULT '' CHECK (length(endereco) <= 160);
  ALTER TABLE vagas ADD COLUMN cep TEXT NOT NULL DEFAULT '' CHECK (cep = '' OR (length(cep) = 8 AND cep NOT GLOB '*[^0-9]*'));
  `,
  `
  ALTER TABLE usuarios RENAME TO users;
  ALTER TABLE users RENAME COLUMN nome TO name;
  ALTER TABLE users RENAME COLUMN versao TO version;
  ALTER TABLE users RENAME COLUMN criado_em TO created_at;

  ALTER TABLE dispositivos RENAME TO devices;
  ALTER TABLE devices RENAME COLUMN usuario_id TO user_id;
  ALTER TABLE devices RENAME COLUMN nome TO name;
  ALTER TABLE devices RENAME COLUMN criado_em TO created_at;
  ALTER TABLE devices RENAME COLUMN revogado_em TO revoked_at;

  ALTER TABLE vagas RENAME TO spots;
  ALTER TABLE spots RENAME COLUMN usuario_id TO user_id;
  ALTER TABLE spots RENAME COLUMN salva_em TO saved_at;
  ALTER TABLE spots RENAME COLUMN andar TO floor;
  ALTER TABLE spots RENAME COLUMN referencia TO note;
  ALTER TABLE spots RENAME COLUMN vence_em TO expires_at;
  ALTER TABLE spots RENAME COLUMN liberada_em TO released_at;
  ALTER TABLE spots RENAME COLUMN atualizada_por TO updated_by;
  ALTER TABLE spots RENAME COLUMN endereco TO address;
  ALTER TABLE spots RENAME COLUMN cep TO postal_code;

  DROP INDEX vagas_uma_ativa_por_usuario;
  CREATE UNIQUE INDEX spots_one_active_per_user ON spots(user_id) WHERE released_at IS NULL;
  DROP INDEX dispositivos_usuario;
  CREATE INDEX devices_user ON devices(user_id);
  `,
];

type SpotRow = {
  latitude: number;
  longitude: number;
  saved_at: number;
  altitude: number | null;
  floor: string;
  note: string;
  address: string;
  postal_code: string;
  expires_at: number | null;
};

/** Gera o hash SHA-256 do token; o servidor só guarda o hash, nunca o token. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Converte uma linha da tabela spots no formato da API. */
function toSpot(r: SpotRow): Spot {
  return {
    latitude: r.latitude,
    longitude: r.longitude,
    savedAt: r.saved_at,
    altitude: r.altitude,
    floor: r.floor,
    note: r.note,
    address: r.address,
    postalCode: r.postal_code,
    expiresAt: r.expires_at,
  };
}

/**
 * Abre (ou cria) o banco do servidor com chaves estrangeiras e modo WAL ligados, e aplica em uma
 * transação só as migrações que o arquivo ainda não recebeu (a versão fica em PRAGMA user_version).
 */
export function openDatabase(file: string) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (current < MIGRATIONS.length) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const sql of MIGRATIONS.slice(current)) db.exec(sql);
      db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  const q = {
    device: db.prepare(
      'SELECT id, user_id AS userId FROM devices WHERE token_hash = ? AND revoked_at IS NULL',
    ),
    version: db.prepare('SELECT version FROM users WHERE id = ?'),
    active: db.prepare(
      `SELECT latitude, longitude, saved_at, altitude, floor, note, address, postal_code, expires_at
       FROM spots WHERE user_id = ? AND released_at IS NULL`,
    ),
    update: db.prepare(
      `UPDATE spots SET latitude = ?, longitude = ?, saved_at = ?, altitude = ?, floor = ?, note = ?,
         address = ?, postal_code = ?, expires_at = ?, updated_by = ?
       WHERE user_id = ? AND released_at IS NULL`,
    ),
    insert: db.prepare(
      `INSERT INTO spots (user_id, latitude, longitude, saved_at, altitude, floor, note, address, postal_code,
         expires_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    release: db.prepare(
      'UPDATE spots SET released_at = ?, updated_by = ? WHERE user_id = ? AND released_at IS NULL',
    ),
    bump: db.prepare('UPDATE users SET version = version + 1 WHERE id = ?'),
    newUser: db.prepare('INSERT INTO users (name, created_at) VALUES (?, ?)'),
    newDevice: db.prepare(
      'INSERT INTO devices (user_id, name, token_hash, created_at) VALUES (?, ?, ?, ?)',
    ),
  };

  /**
   * Executa a função dentro de uma transação que trava o banco para escrita (BEGIN IMMEDIATE),
   * para que a checagem de versão e a gravação aconteçam juntas ou não aconteçam.
   */
  function transaction<T>(fn: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  /** Lê a versão e a vaga ativa do usuário. */
  function getState(userId: number): RemoteState {
    const { version } = q.version.get(userId) as { version: number };
    const row = q.active.get(userId) as SpotRow | undefined;
    return { version, spot: row ? toSpot(row) : null };
  }

  return {
    close: () => db.close(),

    getState,

    /** Encontra o aparelho dono do token (ignorando tokens revogados). */
    findDevice(token: string): Device | null {
      return (q.device.get(hashToken(token)) as Device | undefined) ?? null;
    },

    /**
     * Grava a vaga se a versão esperada for a atual (controle de concorrência otimista).
     * Devolve o novo estado, ou `conflict` com o estado atual quando outro aparelho mudou antes.
     */
    saveSpot(device: Device, expected: number, v: Spot) {
      return transaction(() => {
        const current = getState(device.userId);
        if (current.version !== expected) return { conflict: true as const, state: current };
        const values = [
          v.latitude, v.longitude, v.savedAt, v.altitude, v.floor, v.note, v.address, v.postalCode, v.expiresAt, device.id,
        ] as const;
        if (current.spot) q.update.run(...values, device.userId);
        else q.insert.run(device.userId, ...values);
        q.bump.run(device.userId);
        return { conflict: false as const, state: getState(device.userId) };
      });
    },

    /** Libera a vaga ativa (o registro fica no histórico com released_at), com a mesma checagem de versão. */
    releaseSpot(device: Device, expected: number, now = Date.now()) {
      return transaction(() => {
        const current = getState(device.userId);
        if (current.version !== expected) return { conflict: true as const, state: current };
        if (current.spot) {
          q.release.run(now, device.id, device.userId);
          q.bump.run(device.userId);
        }
        return { conflict: false as const, state: getState(device.userId) };
      });
    },

    /**
     * Cadastra um aparelho e devolve o token (mostrado uma única vez).
     * Sem `userId`, cria também um usuário novo com o nome informado.
     */
    createDevice(opts: { userId?: number; userName?: string; name: string }) {
      const token = randomBytes(32).toString('base64url');
      const userId = transaction(() => {
        const id = opts.userId ?? Number(q.newUser.run(opts.userName ?? opts.name, Date.now()).lastInsertRowid);
        q.newDevice.run(id, opts.name, hashToken(token), Date.now());
        return id;
      });
      return { userId, token };
    },
  };
}

export type Db = ReturnType<typeof openDatabase>;
