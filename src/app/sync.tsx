import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Field, OutlineButton } from '@/components/controls';
import { ScreenHeader } from '@/components/screen-header';
import { Colors } from '@/constants/theme';
import { apiConfigured, connect, disconnect, subscribe, type Connection } from '@/lib/store';

const STATUS: Record<Connection, string> = {
  off: 'Este aparelho não está conectado. A vaga fica salva só aqui.',
  connecting: 'Conectando…',
  online: 'Conectado. Mudanças aparecem na hora nos seus outros aparelhos.',
  offline: 'Sem conexão com o servidor. Tentando de novo a cada 5 segundos.',
  rejected: 'O servidor recusou o token. Confira o token e conecte de novo.',
};

/**
 * Tela de sincronização: conecta este aparelho ao servidor com um token pessoal, para que a
 * vaga e o tempo do parquímetro apareçam em tempo real nos outros aparelhos do mesmo usuário.
 */
export default function SyncScreen() {
  const [connection, setConnection] = useState<Connection>('off');
  const [token, setTokenText] = useState('');

  useEffect(() => subscribe((s) => setConnection(s.connection)), []);

  /** Salva o token no armazenamento seguro e abre a conexão em tempo real. */
  async function handleConnect() {
    try {
      await connect(token);
      setTokenText('');
    } catch (e) {
      Alert.alert('Token não salvo', e instanceof Error ? e.message : 'Confira o token e tente de novo.');
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={s.root}>
      <ScreenHeader title="Sincronizar aparelhos" />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.lead}>
          Com um servidor configurado, quem estiver com você vê a vaga, o tempo e o aviso do parquímetro no
          próprio celular, atualizados na hora.
        </Text>
        {!apiConfigured() ? (
          <Text style={s.notice}>
            Nenhum servidor seguro configurado. Defina EXPO_PUBLIC_API_URL no .env com um endereço HTTPS e gere o app
            de novo.
          </Text>
        ) : (
          <>
            <Text style={s.notice} accessibilityLiveRegion="polite">{STATUS[connection]}</Text>
            {connection === 'off' || connection === 'rejected' ? (
              <>
                <Field
                  label="Token do aparelho"
                  placeholder="Cole o token gerado no servidor"
                  value={token}
                  onChangeText={setTokenText}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button label="Conectar" onPress={handleConnect} disabled={!token.trim()} />
              </>
            ) : (
              <OutlineButton label="Desconectar este aparelho" onPress={disconnect} />
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.concrete },
  content: { padding: 16, gap: 14 },
  lead: { color: Colors.asphalt, fontSize: 16, lineHeight: 24 },
  notice: {
    color: Colors.asphalt, fontSize: 15, lineHeight: 22, backgroundColor: Colors.white, borderRadius: 10, padding: 14,
  },
});
