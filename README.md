<img src="assets/images/icon.png" alt="Logo do Onde Estacionei?" width="96" />

# Onde Estacionei?

Aplicativo de estacionamento inteligente em **React Native + TypeScript** (Expo SDK 58, Expo Router). Ele guarda a posição exata do carro (pelo GPS, escolhendo no mapa ou pelo CEP), traça a rota a pé de volta, controla o tempo do parquímetro ou da Zona Azul e avisa 10 minutos antes de o tempo acabar.

> Projeto 4, Quarto Bimestre.

<p>
  <img src="docs/screenshots/02-home-vazia.png" width="200" alt="Home sem vaga" />
  <img src="docs/screenshots/04-nova-vaga-cep.png" width="200" alt="Nova vaga pelo CEP" />
  <img src="docs/screenshots/06-home-com-vaga.png" width="200" alt="Home com a vaga salva" />
  <img src="docs/screenshots/07-rota-a-pe.png" width="200" alt="Rota a pé até o carro" />
</p>

Todas as telas estão em [docs/telas.md](docs/telas.md).

## Funcionalidades

| Conceito | No app |
|---|---|
| **Localização e mapas** | Formulário com prévia do mapa: a vaga é salva pelo GPS, escolhendo no mapa (pino fixo no centro) ou pelo **CEP**. O mapa em tela cheia desenha a rota a pé até o carro |
| **Notificações** | Aviso local 10 minutos antes de vencer o parquímetro |
| **Widget** | Distância e tempo restante na tela inicial do Android |
| **Sensores** | Barômetro estima a altitude e diz em que andar o carro ficou. Há também um formulário manual |
| **SQLite** | Vaga salva no aparelho (criptografado), funcionando offline |
| **Tempo real (SSE)** | Aparelhos do mesmo usuário veem a vaga mudar na hora |

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/funcionalidades.md](docs/funcionalidades.md) | Como cada recurso funciona e o fluxo de sincronização |
| [docs/telas.md](docs/telas.md) | Telas com prints, fluxo de navegação, estados, mensagens e normas de uso seguro |
| [docs/banco-de-dados.md](docs/banco-de-dados.md) | Tabelas, colunas, relacionamentos (diagrama ER) e integridade |
| [docs/api.md](docs/api.md) | Rotas da API, eventos SSE e códigos de erro |
| [docs/seguranca.md](docs/seguranca.md) | Confidencialidade, integridade, disponibilidade, XSS, CSRF e outros |
| [docs/testes.md](docs/testes.md) | Como rodar e o que cada teste cobre |

## Tecnologias

| Recurso | Biblioteca |
|---|---|
| Interface | React Native, Expo Router, TypeScript |
| Mapas e GPS | `@maplibre/maplibre-react-native` + OpenFreeMap, `expo-location` |
| Endereço e CEP | ViaCEP (CEP) e Nominatim/OpenStreetMap (endereço e coordenada) |
| Sensores | `expo-sensors` (Barometer) |
| Notificações | `expo-notifications` |
| Widget | `react-native-android-widget` |
| Banco local | `expo-sqlite` com SQLCipher |
| Segredos | `expo-secure-store`, `expo-crypto` |
| Tempo real | `react-native-sse` no app, `node:http` no servidor |
| Servidor | Node.js 22.18+ (`node:sqlite`, `node:crypto`), sem dependências externas |

## Custo zero

Nenhuma parte do projeto pede cartão, cadastro pago ou chave de API.

| Parte | Serviço | Custo |
|---|---|---|
| Mapa | [MapLibre](https://maplibre.org) + [OpenFreeMap](https://openfreemap.org) (dados do OpenStreetMap) | Gratuito, sem chave e sem limite |
| Rota a pé | Servidor OSRM público da [FOSSGIS](https://routing.openstreetmap.de) | Gratuito, sem chave |
| CEP | [ViaCEP](https://viacep.com.br) | Gratuito, sem chave |
| Endereço do ponto | [Nominatim](https://nominatim.org) (OpenStreetMap), até 1 consulta por segundo | Gratuito, sem chave |
| Notificações | Locais, agendadas no próprio aparelho | Gratuito, não usa Firebase |
| Banco e servidor | SQLite e Node.js, rodando no seu computador | Gratuito |
| Build do app | `npx expo run:android` local, ou EAS no plano gratuito (conta Expo, sem cartão) | Gratuito |
| Fonte | Barlow Condensed (licença OFL), embutida no app | Gratuito |

Mapas, rotas e endereços usam serviços comunitários. O mapa mostra a atribuição ao OpenStreetMap, como a licença exige.

## Como rodar

Requisitos: Node.js 22.18 ou mais novo, e um celular Android ou emulador.

```bash
npm install
cp .env.example .env     # preencha as variáveis (veja abaixo)
```

### App

O widget, o mapa e o SQLCipher usam código nativo que o **Expo Go não inclui**. Gere um *development build*:

Com o Android Studio instalado (emulador ou celular conectado por USB):

```bash
npx expo run:android
```

Sem Android Studio, dá para gerar o APK na nuvem com uma conta Expo gratuita. O comando `build:configure` cria o `eas.json`:

```bash
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform android
npx expo start          # depois, com o APK instalado no celular
```

### Servidor de sincronização (opcional)

Sem servidor, o app funciona normalmente, com a vaga salva só no aparelho.

```bash
npm run server:dispositivo -- --nome "Celular da Ana" --usuario "Ana"   # mostra o token
npm run server                                                          # sobe a API
```

No app, toque no selo **Sincronizar** no topo da home e cole o token. Para um segundo aparelho do mesmo usuário, rode `--usuario-id 1`.

### Variáveis de ambiente

Todas estão descritas em [`.env.example`](.env.example). O `.env` não vai para o Git.

| Variável | Uso |
|---|---|
| `EXPO_PUBLIC_MAP_STYLE_URL` | Estilo do mapa (padrão: OpenFreeMap, gratuito e sem chave) |
| `EXPO_PUBLIC_ROUTING_URL` | Servidor OSRM da rota a pé |
| `EXPO_PUBLIC_CEP_URL` | Serviço de CEP (ViaCEP) |
| `EXPO_PUBLIC_GEOCODER_URL` | Serviço de endereço e coordenada (Nominatim) |
| `EXPO_PUBLIC_API_URL` | Endereço HTTPS da API (em desenvolvimento: `http://10.0.2.2:3333`) |
| `HOST`, `PORT` | Endereço do servidor |
| `DATABASE_FILE` | Arquivo SQLite do servidor |
| `TLS_CERT_FILE`, `TLS_KEY_FILE` | HTTPS direto no servidor |
| `ALLOWED_ORIGINS` | Origens web permitidas (CSRF) |
| `RATE_LIMIT_PER_MINUTE` | Limite de requisições |

### Adicionar o widget

Na home do app, toque em **Adicionar à tela inicial**, no cartão **Widget na tela inicial**, e confirme. Se o launcher do celular não mostrar a confirmação, faça à mão: pressione e segure a tela inicial, abra **Widgets**, procure **Onde Estacionei?** e arraste para a tela.

## Testes e verificação

```bash
npm test           # 40 testes unitários (lógica, CEP, rota, validação, sincronização, API, SSE e segurança)
npm run typecheck
npm run lint
```

## Estrutura

```
index.ts                     Entrada: Expo Router + handler do widget
app.config.ts                Configuração do app (lê o .env)
src/app/                     Telas: home, permissões, vaga, escolher-local, mapa, sincronizar
src/components/              Placa, prévia do mapa, pino do carro, cabeçalho, botões e campos
src/hooks/                   GPS, barômetro e relógio
src/constants/theme.ts       Cores e fontes
src/lib/                     Lógica: geo, CEP e endereço, validação, banco, segredos, notificações, rota, sincronização
src/widget/                  Widget Android
server/                      API REST + SSE (app, banco, CLI de aparelhos)
tests/                       Testes unitários
docs/                        Documentação e prints (docs/screenshots)
```

## Limitações conhecidas

- O Android atualiza widgets no máximo a cada 30 minutos. Por isso o widget mostra o **horário** de vencimento, que continua correto entre as atualizações.
- A estimativa de andar usa 3 m por andar. Ela pode errar por 1 andar e muda com o clima ao longo de horas.
- O widget existe só no Android.
- Em conflito entre aparelhos, prevalece a alteração que chegou primeiro ao servidor.
- Rota e endereço dependem de serviços comunitários gratuitos. Sem eles, o app mostra a linha reta até o carro, e o ponto no mapa basta para salvar.
