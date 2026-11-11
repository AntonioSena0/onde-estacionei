# Testes

Testes unitários com o executor nativo do Node (`node:test`), sem framework extra. O Node 22.18+ executa TypeScript direto.

```bash
npm test          # 40 testes
npm run typecheck # tsc --noEmit
npm run lint      # expo lint
```

| Arquivo | O que testa |
|---|---|
| `tests/geo.test.ts` | Distância (Haversine), altitude pela pressão, diferença de andares, formatação de distância e tempo, horário do aviso |
| `tests/validation.test.ts` | Validação da vaga, descarte de campos extras, bloqueio de HTML e caracteres de controle, resposta do servidor, exigência de HTTPS |
| `tests/address.test.ts` | CEP (8 dígitos, máscara), linha de endereço, leitura das respostas do ViaCEP e do Nominatim e descarte de texto malicioso vindo delas |
| `tests/route.test.ts` | Leitura da rota do OSRM (pontas ligadas à sua posição e ao carro, minutos a pé), recusa de respostas malformadas e linha reta de reserva |
| `tests/reconcile.test.ts` | Decisão de sincronização: enviar, apagar, copiar do servidor ou nada |
| `tests/server.test.ts` | API real em memória: autenticação, CSRF, XSS, limites, versão e conflito, endereço e CEP, migrações ao reabrir o banco, isolamento entre usuários, SSE em tempo real e limite de taxa |

As telas dependem do aparelho (GPS, barômetro, notificações). Elas foram verificadas com `tsc`, `expo lint` e `expo-doctor`, e testadas à mão no emulador Android: permissões, adicionar vaga pelo GPS, pelo mapa e pelo CEP, salvar, home, rota a pé e sincronização. Os prints estão em [telas.md](telas.md).
