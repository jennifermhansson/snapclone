/**
 * The API contract, shared by api.mock.ts and api.real.ts so the two cannot
 * drift apart. Field names mirror the backend exactly, snake_case included —
 * the assignment forbids renaming them.
 */

/** Every failure from the API, mock and real alike. `code` is the HTTP status,
 *  `message` the backend's text — written for the user, rendered verbatim. */
export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

/** `created_at` is an ISO string throughout. */
export type ApiUser = { username: string; created_at: string };

export type Tokens = { access_token: string; refresh_token: string };

export type AuthResponse = { tokens: Tokens; user: ApiUser };

export type ApiFriend = { username: string; created_at: string; mutual: boolean };

/** Someone who added you and is waiting for you to add them back. Here
 *  `created_at` is when they asked, not when their account was made. */
export type ApiFriendRequest = { username: string; created_at: string };

export type AddFriendResponse = { status: 'pending' | 'friends' };

export type SendSnapInput = {
  recipients: string[];
  photo: { uri: string; mimetype: string };
  text?: string;
};
