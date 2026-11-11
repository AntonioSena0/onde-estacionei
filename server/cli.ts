import { parseArgs } from 'node:util';
import { openDatabase } from './db.ts';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    user: { type: 'string' },
    'user-id': { type: 'string' },
  },
});

if (!values.name) {
  console.error('Uso: npm run server:device -- --name "Celular da Ana" [--user "Ana" | --user-id 1]');
  process.exit(1);
}

const db = openDatabase(process.env.DATABASE_FILE ?? 'server/data/onde-estacionei.db');
const { userId, token } = db.createDevice({
  name: values.name,
  userName: values.user,
  userId: values['user-id'] ? Number(values['user-id']) : undefined,
});
db.close();

console.log(`Aparelho cadastrado no usuário ${userId}.`);
console.log(`Token (aparece só agora, guarde com cuidado): ${token}`);
