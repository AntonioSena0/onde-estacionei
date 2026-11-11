# Segurança

Como o projeto trata **confidencialidade, integridade e disponibilidade** (tríade CIA) e os ataques mais comuns.

## Confidencialidade

| Medida | Onde |
|---|---|
| Banco do aparelho criptografado com **SQLCipher** (AES-256). A chave aleatória fica no Android Keystore / iOS Keychain | `src/lib/db.ts`, `src/lib/secrets.ts` |
| Token do aparelho só no armazenamento seguro, nunca no banco, no código ou no `.env` | `src/lib/secrets.ts` |
| O app recusa servidor sem **HTTPS**. HTTP só é aceito em desenvolvimento, para `localhost` e para o emulador | `isSecureUrl` em `src/lib/validation.ts` |
| O servidor guarda só o **hash SHA-256** do token. Um vazamento do banco não revela tokens | `server/db.ts` |
| HTTPS direto com `TLS_CERT_FILE`/`TLS_KEY_FILE`, com HSTS ligado | `server/index.ts` |
| Isolamento por usuário: cada consulta filtra pelo usuário dono do token | `server/db.ts` |
| `Cache-Control: no-store` e `Referrer-Policy: no-referrer` | `server/app.ts` |
| Segredos fora do Git: `.env` ignorado, apenas `.env.example` versionado. Variáveis `EXPO_PUBLIC_` não carregam segredos | `.gitignore`, `.env.example` |

## Integridade

| Medida | Onde |
|---|---|
| Validação por lista de campos permitidos: só os campos conhecidos são copiados (sem atribuição em massa), com tipos e faixas conferidos | `parseVaga` |
| O app também valida o que chega do servidor antes de gravar | `parseRemoteState` |
| `CHECK`, `NOT NULL`, `UNIQUE` e chaves estrangeiras nos dois bancos | `server/db.ts`, `src/lib/db.ts` |
| Controle de concorrência otimista com `If-Match` e versão. Nenhuma alteração sobrescreve outra sem querer (`409`) | `server/app.ts`, `server/db.ts` |
| Transações `BEGIN IMMEDIATE`: a checagem e a gravação acontecem juntas ou não acontecem | `server/db.ts` |
| Operações do app executadas em fila, para que um evento SSE e uma edição local nunca gravem ao mesmo tempo | `serial` em `src/lib/store.ts` |
| Queries sempre parametrizadas (`?`), sem concatenar valores no SQL (**SQL injection**) | todos os acessos ao banco |

## Disponibilidade

| Medida | Onde |
|---|---|
| O app funciona **offline**: grava primeiro no SQLite local e sincroniza depois | `src/lib/store.ts` |
| O SSE reconecta sozinho a cada 5 s e ressincroniza ao reconectar | `startRealtime` |
| Limite de requisições por IP e por aparelho (`429` + `Retry-After`), com limpeza das janelas vencidas | `rateLimit` |
| Limite de 2 KB por corpo, 50 cabeçalhos, timeouts de cabeçalho e de requisição | `server/app.ts`, `server/index.ts` |
| Máximo de conexões SSE por usuário e `ping` periódico | `openStream` |
| Erros internos não derrubam o servidor e não vazam detalhes | `handler` |
| Desligamento limpo (SIGINT/SIGTERM) e banco em modo WAL | `server/index.ts`, `server/db.ts` |
| Tempo máximo de 10 s nas chamadas do app | `request` em `src/lib/store.ts` |

## Privacidade (LGPD)

A posição do carro é um dado pessoal. O app guarda o mínimo necessário e só envia a terceiros o que cada função precisa.

| Dado | Para onde vai | Quando |
|---|---|---|
| Vaga completa | Fica no SQLite criptografado do aparelho | Sempre |
| Vaga completa | Servidor de sincronização do próprio usuário | Só se a sincronização estiver ligada |
| CEP digitado | ViaCEP | Ao tocar em **Buscar** |
| Rua, número, cidade e UF | Nominatim (OpenStreetMap) | Ao buscar pelo CEP, para achar o ponto |
| Coordenada do pino | Nominatim | Quando o pino para, para preencher o endereço |
| Sua posição e a do carro | Servidor OSRM da FOSSGIS | Ao tocar em **Traçar rota a pé** |

- Nenhum serviço externo recebe nome, token ou identificador do usuário. O `User-Agent` identifica só o app (`OndeEstacionei/1.0`), como pede a política de uso do Nominatim.
- Todas as chamadas usam HTTPS.
- **Liberar vaga** apaga a vaga do aparelho. No servidor, ela fica só no histórico do próprio usuário.
- As permissões são pedidas com contexto, na tela de permissões. A localização é pedida só **durante o uso** e nunca em segundo plano.
- O app funciona sem esses serviços. Sem internet, o local escolhido no mapa basta para salvar.

## Ataques

### XSS (Cross-Site Scripting)

- O app é React Native: `<Text>` nunca interpreta HTML e não há WebView.
- O servidor responde só JSON com `X-Content-Type-Options: nosniff` e `Content-Security-Policy: default-src 'none'`, então nada do que ele devolve pode virar página executável.
- Textos com `<`, `>` ou caracteres de controle são recusados no app e no servidor (`cleanText`), como defesa em profundidade para qualquer painel web futuro.

### CSRF (Cross-Site Request Forgery)

- A autenticação usa o cabeçalho `Authorization`, **sem cookies**. O navegador não anexa esse cabeçalho sozinho, então um site malicioso não consegue agir em nome do usuário.
- Requisições com `Origin` fora de `ALLOWED_ORIGINS` recebem `403`.
- Escritas exigem `Content-Type: application/json`, que um formulário HTML não consegue enviar (`415`), e `If-Match` (`428`).
- O servidor não envia cabeçalhos CORS, então páginas de outra origem não leem as respostas.

### Outros

| Ataque | Defesa |
|---|---|
| SQL injection | Queries parametrizadas e `CHECK` no esquema |
| Força bruta de token | Tokens de 256 bits aleatórios e limite de requisições por IP antes da autenticação |
| Clickjacking | `X-Frame-Options: DENY` e `frame-ancestors 'none'` |
| Atribuição em massa | Lista de campos permitidos em `parseVaga` |
| Resposta adulterada de serviço externo | ViaCEP e Nominatim passam por `parseViaCep`, `parseSearch` e `parseReverse`, que conferem tipos, faixas de coordenadas e textos |
| Abuso dos serviços gratuitos | Uma consulta ao Nominatim por segundo, no máximo, e espera de 0,6 s após mover o mapa |
| Negação de serviço simples | Limites de taxa, de tamanho, de conexões e timeouts |
| Interceptação (MITM) | HTTPS obrigatório no app e HSTS no servidor |

## Testes de segurança

`tests/server.test.ts` e `tests/validation.test.ts` cobrem: 401 sem token, hash do token, 403 para outra origem, 415 para formulário, 428 sem `If-Match`, 400 para HTML, 413 para corpo grande, 409 em conflito, isolamento entre usuários, 429 no limite e cabeçalhos de segurança. Veja [testes.md](testes.md).
