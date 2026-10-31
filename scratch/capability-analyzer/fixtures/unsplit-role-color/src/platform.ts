// Both handlers point at the shared bridge file as it is on main.
import { createNativeMentions as mentions } from '~/ios/mentions';

declare function definePlatform<T>(handlers: { ios?: T; android?: T }): T;

export const createNativeMentions = definePlatform({ ios: mentions, android: mentions });
