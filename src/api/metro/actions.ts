import { Actions } from '@typings/api/metro/actions';
import { findByProps } from '@metro';

// Libraries
export const Invites: Actions.Invites = findByProps('acceptInviteAndTransitionToInviteChannel', { lazy: true });