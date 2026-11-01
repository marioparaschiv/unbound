import { findByPropsLazy } from '~/metro/wrappers';

/** Discord's message actions module, with `sendMessage` and `receiveMessage`; found on first access. */
export const Messages = findByPropsLazy('sendMessage', 'receiveMessage');
/** Discord's link opener module, with `openURL` and `openSettings`; found on first access. */
export const Linking = findByPropsLazy('openURL', 'openSettings');
/** Discord's module with `showUserProfile`, which opens a user's profile; found on first access. */
export const Profiles = findByPropsLazy('showUserProfile');
/** Discord's module with `fetchProfile`, which loads a user's profile from the API; found on first access. */
export const AsyncUsers = findByPropsLazy('fetchProfile');
/** Discord's invite actions module, with `acceptInviteAndTransitionToInviteChannel`; found on first access. */
export const Invites = findByPropsLazy('acceptInviteAndTransitionToInviteChannel');
/** Discord's module with `openOAuth2Modal`, which opens the app authorize screen; found on first access. */
export const OAuth2 = findByPropsLazy('openOAuth2Modal');
/** Discord's action sheet module, with `openLazy` and `hideActionSheet`; found on first access. */
export const ActionSheets = findByPropsLazy('openLazy', 'hideActionSheet');
/** Discord's user profile action sheet helpers, such as `getUserProfileActionSheetKey`; found on first access. */
export const UserProfiles = findByPropsLazy(
	'getUserProfileActionSheetKey',
	'showUserProfileActionSheetPostConnection',
);
