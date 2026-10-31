// UB-129 prototype move: the only platform branch, in the shape plan §9 gives definePlatform.
import { createNativeMentions as android } from '~/android/mentions';
import { createNativeMentions as ios } from '~/ios/mentions';

declare function definePlatform<T>(handlers: { ios?: T; android?: T }): T;

export const createNativeMentions = definePlatform({ ios, android });
