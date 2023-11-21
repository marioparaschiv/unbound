import type { Actions } from '@typings/api/metro/actions';
import { findByProps } from '@metro';

export const Invites: Actions.Invites = findByProps('acceptInviteAndTransitionToInviteChannel', { lazy: true });
export const Linking = findByProps('openURL', 'openDeeplink', { lazy: true });