# API de sincronização

Servidor em `server/`, feito só com módulos nativos do Node (`node:http`, `node:https`, `node:sqlite`, `node:crypto`), sem dependências externas.

## Autenticação

Todas as rotas, exceto `/health`, exigem o cabeçalho:

```
Authorization: Bearer <token do aparelho>
```

O token é gerado pelo comando abaixo e aparece **uma única vez**:

```bash
npm run server:dispositivo -- --nome "Celular da Ana" --usuario "Ana"     # novo usuário
npm run server:dispositivo -- --nome "Celular do Bruno" --usuario-id 1     # outro aparelho do mesmo usuário
```

## Formato da vaga

```json
{
  "latitude": -23.5505,
  "longitude": -46.6333,
  "savedAt": 1762876800000,
  "altitude": 760.2,
  "floor": "G2",
  "note": "Pilar B14",
  "address": "Praça da Sé, 100 - Sé, São Paulo/SP",
  "cep": "01001000",
  "expiresAt": 1762880400000
}
```

| Campo | Regra |
|---|---|
| `latitude` / `longitude` | Números entre -90 e 90 / -180 e 180 |
| `savedAt` | Inteiro positivo (ms) |
| `altitude` | Opcional, entre -500 e 9000 m |
| `floor` / `note` / `address` | Opcionais, até 20 / 120 / 160 caracteres, sem `<`, `>` ou caracteres de controle |
| `cep` | Opcional, vazio ou 8 dígitos |
| `expiresAt` | Opcional, depois de `savedAt` e no máximo 7 dias depois |

Campos fora dessa lista são descartados.

Respostas de estado: `{ "version": 5, "vaga": { ... } | null }`.

## Rotas

| Método | Rota | Cabeçalhos | Resposta |
|---|---|---|---|
| GET | `/health` | nenhum | `200 { "status": "ok" }` |
| GET | `/api/vaga` | `Authorization` | `200` com o estado |
| PUT | `/api/vaga` | `Authorization`, `Content-Type: application/json`, `If-Match: "<versão>"` | `200` com o novo estado e `ETag`, ou `409` com o estado atual |
| DELETE | `/api/vaga` | `Authorization`, `If-Match: "<versão>"` | `200 { version, vaga: null }` ou `409` |
| GET | `/api/eventos` | `Authorization` | Fluxo SSE (`text/event-stream`) |

## Eventos SSE

```
retry: 5000

event: vaga
id: 5
data: {"version":5,"vaga":{...}}

: ping
```

- O estado atual é enviado logo ao conectar. Depois chega um evento a cada mudança, só para os aparelhos do mesmo usuário.
- `: ping` a cada 20 s mantém a conexão aberta em proxies.
- Máximo de 5 conexões simultâneas por usuário.

## Erros

O corpo é sempre `{ "erro": "mensagem" }`, sem detalhes internos.

| Status | Quando |
|---|---|
| 400 | JSON inválido ou campo fora das regras |
| 401 | Token ausente, inválido ou revogado |
| 403 | Origem web não autorizada (`Origin`) |
| 404 / 405 | Rota ou método inexistente |
| 409 | A versão em `If-Match` não é a atual (outro aparelho alterou antes) |
| 413 | Corpo maior que 2 KB |
| 415 | Escrita sem `Content-Type: application/json` |
| 428 | Escrita sem `If-Match` |
| 429 | Limite de requisições ou de conexões SSE (traz `Retry-After`) |
| 500 | Erro inesperado (registrado só no servidor) |
