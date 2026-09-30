import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { IconButton } from '@/components/ui/icon-button';
import { Colors, Radius, Size, Spacing } from '@/constants/design';
import { S } from '@/constants/strings';
import { useApi } from '@/hooks/use-api';
import { getMessages, sendMessage, type ApiMessage } from '@/lib/api';
import { onMessageReceived, onSocketConnect } from '@/lib/socket';

/** Newest first: the list is `inverted`, so index 0 is drawn at the bottom. */
function mergeNewestFirst(current: ApiMessage[], incoming: ApiMessage[]): ApiMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  // ids are bigserial on the backend, so a higher id is a later message.
  return [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id));
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const call = useApi();

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ lead: string; detail: string } | null>(null);
  const loadingOlder = useRef(false);
  const reachedStart = useRef(false);

  const loadLatest = useCallback(async () => {
    const res = await call(() => getMessages(username));
    if (!res.ok) return setError({ lead: S.chat.loadFailed, detail: res.message });
    setError(null);
    setMessages((current) => mergeNewestFirst(current, res.data));
  }, [call, username]);

  // First page, and again after every websocket (re)connect: whatever arrived
  // while the socket was down was only ever saved, never pushed to us.
  useEffect(() => {
    void loadLatest();
    return onSocketConnect(() => void loadLatest());
  }, [loadLatest]);

  // Live messages from THIS friend. The socket is shared by the whole app, so
  // messages from anyone else are ignored here.
  useEffect(
    () =>
      onMessageReceived((message) => {
        if (message.sender_username === username) {
          setMessages((current) => mergeNewestFirst(current, [message]));
        }
      }),
    [username],
  );

  const loadOlder = useCallback(async () => {
    const oldest = messages[messages.length - 1];
    if (!oldest || loadingOlder.current || reachedStart.current) return;

    loadingOlder.current = true;
    const res = await call(() => getMessages(username, oldest.id));
    loadingOlder.current = false;

    if (!res.ok) return setError({ lead: S.chat.loadFailed, detail: res.message });
    // The backend pages by 50; fewer back means there is nothing older.
    if (res.data.length < 50) reachedStart.current = true;
    setMessages((current) => mergeNewestFirst(current, res.data));
  }, [call, messages, username]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    const res = await call(() => sendMessage(username, body));
    setSending(false);

    if (!res.ok) return setError({ lead: S.chat.sendFailed, detail: res.message });

    setError(null);
    setDraft('');
    // Our own message comes back in the response; the socket only carries
    // messages TO us, so nothing else would put it on screen.
    setMessages((current) => mergeNewestFirst(current, [res.data]));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron.left" onPress={() => router.back()} accessibilityLabel={S.common.back} glyphSize={24} />
        <Avatar username={username} size={36} />
        <View style={styles.headerText}>
          <AppText variant="headline" numberOfLines={1}>
            {username}
          </AppText>
          <AppText variant="meta" color={Colors.textSecondary}>
            {S.chat.friendsSubtitle}
          </AppText>
        </View>
        <IconButton name="camera.fill" onPress={() => router.navigate('/')} accessibilityLabel={S.chat.cameraA11y} />
      </View>

      <ErrorBanner message={error?.lead ?? null} detail={error?.detail} onDismiss={() => setError(null)} />

      <FlatList
        inverted
        data={messages}
        keyExtractor={(message) => message.id}
        renderItem={({ item }) => {
          const mine = item.sender_username !== username;
          return (
            <View
              style={[styles.bubble, mine ? styles.sent : styles.received]}
              accessible
              accessibilityLabel={mine ? S.chat.sentA11y(item.body) : S.chat.receivedA11y(username, item.body)}
            >
              <AppText variant="body" color={mine ? Colors.onDark : Colors.text}>
                {item.body}
              </AppText>
            </View>
          );
        }}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="bubble.left.and.bubble.right.fill"
            title={S.chat.emptyTitle}
            body={S.chat.emptyBody(username)}
          />
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={S.chat.composerPlaceholder}
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <IconButton
            name="paperplane.fill"
            onPress={send}
            accessibilityLabel={S.chat.sendA11y}
            size={40}
            variant="filled"
            disabled={sending || draft.trim().length === 0}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: {
    height: Size.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: Size.hairline,
    borderBottomColor: Colors.separator,
  },
  headerText: { flex: 1 },
  // flexGrow + center keeps the empty state in the middle; with messages the list
  // simply fills up from the bottom because it is inverted.
  listContent: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.sm },
  bubble: {
    maxWidth: '80%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sent: { alignSelf: 'flex-end', backgroundColor: Colors.inkSoft, borderBottomRightRadius: 6 },
  received: { alignSelf: 'flex-start', backgroundColor: Colors.surfaceAlt, borderBottomLeftRadius: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    borderTopWidth: Size.hairline,
    borderTopColor: Colors.separator,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.separator,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
});
