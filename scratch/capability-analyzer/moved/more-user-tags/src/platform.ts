// UB-129 prototype move: the only platform branch, in the shape plan §9 gives definePlatform.
import { createTagGradients as android } from '~/android/tag-gradients';
import { createTagGradients as ios } from '~/ios/tag-gradient-renderer';

declare function definePlatform<T>(handlers: { ios?: T; android?: T }): T;

export const createTagGradients = definePlatform({ ios, android });
