import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmRemoveFriend } from '@/components/friend-actions';
import { FriendRow } from '@/components/friend-row';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { IconButton } from '@/components/ui/icon-button';
import { LargeTitle } from '@/components/ui/large-title';
import { ListSeparator } from '@/components/ui/list-separator';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Colors, Size, Spacing } from '@/constants/design';
import { S } from '@/constants/strings';
import { useApi } from '@/hooks/use-api';
import { useFriends } from '@/hooks/use-friends';
import { addFriend, deleteFriend, type ApiFriend } from '@/lib/api';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const call = useApi();
  const { friends, requests, setFriends, setRequests, loading, refreshing, error, setError, reload, refresh } =
    useFriends();

  const [actionError, setActionError] = useState<{ lead: string; detail: string } | null>(null);

  const acceptRequest = useCallback(
    async (username: string) => {
      // Optimistic: the row leaves immediately, and comes back if the call fails.
      setRequests((current) => current.filter((r) => r.username !== username));

      // There is no accept endpoint — accepting is just adding them back.
      const res = await call(() => addFriend(username));
      if (!res.ok) {
        setActionError({ lead: S.chats.acceptFailed, detail: res.message });
        void reload();
        return;
      }
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      void reload();
    },
    [call, reload, setRequests],
  );

  const removeFriend = useCallback(
    (friend: ApiFriend) => {
      confirmRemoveFriend(friend.username, friend.mutual, () => {
        void (async () => {
          const previous = friends ?? [];
          setFriends(previous.filter((f) => f.username !== friend.username));

          const res = await call(() => deleteFriend(friend.username));
          if (!res.ok) {
            setFriends(previous); // put the row back
            setActionError({ lead: S.friend.deleteFailed, detail: res.message });
            return;
          }
          // Removing a mutual friend turns them into an incoming request server-side.
          void reload();
        })();
      });
    },
    [call, friends, reload, setFriends],
  );

  const mutualFriends = friends?.filter((f) => f.mutual) ?? [];
  const pendingFriends = friends?.filter((f) => !f.mutual) ?? [];

  const sections = [
    { key: 'mutual', title: S.chats.friendsSection, data: mutualFriends },
    { key: 'pending', title: S.chats.pendingSection, data: pendingFriends },
  ].filter((section) => section.data.length > 0);

  const isEmpty = friends !== null && friends.length === 0 && requests.length === 0;

  return (
    <SafeAreaView
      style={styles.safe}
      // Only 'top': PagerBar floats over the list and already consumes the bottom
      // inset. Claiming both would double-count and leave a dead gap.
      edges={['top']}
    >
      <LargeTitle
        title={S.chats.title}
        right={
          <IconButton
            name="person.badge.plus"
            onPress={() => router.push('/add-friend')}
            accessibilityLabel={S.friends.addRow}
          />
        }
      />

      {loading && friends === null ? (
        <LoadingState label={S.chats.loading} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.username}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={ListSeparator}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Size.pagerBar + insets.bottom + Spacing.xl },
            isEmpty && styles.contentEmpty,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.ink} colors={[Colors.ink]} />
          }
          ListHeaderComponent={
            <View>
              {error ? (
                <View style={styles.banner}>
                  <ErrorBanner message={S.chats.loadFailed} detail={error} onDismiss={() => setError(null)} />
                  <Button label={S.common.retry} variant="secondary" size="md" onPress={reload} style={styles.retry} />
                </View>
              ) : null}

              {actionError ? (
                <View style={styles.banner}>
                  <ErrorBanner
                    message={actionError.lead}
                    detail={actionError.detail}
                    onDismiss={() => setActionError(null)}
                  />
                </View>
              ) : null}

              {requests.length > 0 ? (
                <View>
                  <SectionHeader title={S.chats.requestsSection} badge={requests.length} />
                  {requests.map((request) => (
                    <View key={request.username} style={styles.requestRow}>
                      <Avatar username={request.username} ring="accent" />
                      <View style={styles.requestText}>
                        <AppText variant="bodyStrong" numberOfLines={1}>
                          {request.username}
                        </AppText>
                        <AppText variant="meta" color={Colors.textSecondary}>
                          {S.chats.requestSubtitle}
                        </AppText>
                      </View>
                      <Button
                        label={S.chats.requestAccept}
                        size="sm"
                        onPress={() => void acceptRequest(request.username)}
                        accessibilityHint={S.chats.requestAcceptA11y}
                      />
                    </View>
                  ))}
                  <View style={styles.sectionBreak} />
                </View>
              ) : null}
            </View>
          }
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          renderItem={({ item }) => (
            <FriendRow
              username={item.username}
              mutual={item.mutual}
              onPress={() => router.push({ pathname: '/chat/[username]', params: { username: item.username } })}
              onLongPress={() => removeFriend(item)}
            />
          )}
          ListEmptyComponent={
            isEmpty ? (
              <EmptyState
                icon="person.2.fill"
                title={S.chats.emptyTitle}
                body={S.chats.emptyBody}
                actionLabel={S.chats.emptyAction}
                onAction={() => router.push('/add-friend')}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { flexGrow: 1 },
  contentEmpty: { justifyContent: 'center' },
  banner: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  retry: { marginTop: Spacing.md, alignSelf: 'flex-start' },
  requestRow: {
    height: Size.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  requestText: { flex: 1 },
  sectionBreak: { height: Spacing.sm, backgroundColor: Colors.surfaceAlt, marginTop: Spacing.md },
});
