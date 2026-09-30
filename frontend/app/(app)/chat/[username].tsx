import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Colors, Size, Spacing } from '@/constants/design';
import { S } from '@/constants/strings';

/**
 * Shell only — Wednesday's WebSocket work plugs in here.
 *
 * The list is already `inverted` and the composer already sits inside a
 * KeyboardAvoidingView so that enabling messages later is wiring, not a rewrite.
 * Bubble styling is decided in `renderItem` below when messages arrive:
 *   sent     -> alignSelf 'flex-end',   fill Colors.sent,       borderBottomRightRadius 6
 *   received -> alignSelf 'flex-start', fill Colors.surfaceAlt, borderBottomLeftRadius 6
 */
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();

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

      <FlatList
        inverted
        data={[]}
        keyExtractor={(_, index) => String(index)}
        renderItem={null}
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
        <AppText variant="meta" color={Colors.textTertiary} center style={styles.comingSoon}>
          {S.chat.comingSoon}
        </AppText>

        <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <IconButton
            name="camera.fill"
            onPress={() => {}}
            accessibilityLabel={S.chat.cameraA11y}
            size={40}
            disabled
          />
          <TextInput
            editable={false}
            placeholder={S.chat.composerPlaceholder}
            placeholderTextColor={Colors.disabledText}
            // Present in the accessibility tree, just marked unavailable — hiding a
            // disabled control entirely is worse than explaining it.
            accessibilityState={{ disabled: true }}
            accessibilityHint={S.chat.composerDisabledHint}
            style={styles.input}
          />
          <IconButton
            name="paperplane.fill"
            onPress={() => {}}
            accessibilityLabel={S.chat.sendA11y}
            size={40}
            variant="filled"
            disabled
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
  listContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  comingSoon: { paddingVertical: Spacing.md },
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
