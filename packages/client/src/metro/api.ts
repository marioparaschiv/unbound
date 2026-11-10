import { ReactNative } from '~/metro/common';
import { byProps } from '~/metro/filters';
import { find } from '~/metro/lookups';

/** Discord's message actions module, with `sendMessage` and `receiveMessage`; found on first access. */
export const Messages = find(byProps('sendMessage', 'receiveMessage'));
/** React Native's `Linking`, with `openURL` and `openSettings`; read directly, as a search on a cold metro cache costs ~15 ms. */
export const Linking = ReactNative.Linking;
/** Discord's module with `showUserProfile`, which opens a user's profile; found on first access. */
export const Profiles = find(byProps('showUserProfile'));
/** Discord's module with `fetchProfile`, which loads a user's profile from the API; found on first access. */
export const AsyncUsers = find(byProps('fetchProfile'));
/** Discord's invite actions module, with `acceptInviteAndTransitionToInviteChannel`; found on first access. */
export const Invites = find(byProps('acceptInviteAndTransitionToInviteChannel'));
/** Discord's module with `openOAuth2Modal`, which opens the app authorize screen; found on first access. */
export const OAuth2 = find(byProps('openOAuth2Modal'));
/** Discord's action sheet module, with `openLazy` and `hideActionSheet`; found on first access. */
export const ActionSheets = find(byProps('openLazy', 'hideActionSheet'));
/** Discord's user profile action sheet helpers, such as `getUserProfileActionSheetKey`; found on first access. */
export const UserProfiles = find(
	byProps('getUserProfileActionSheetKey', 'showUserProfileActionSheetPostConnection'),
);
