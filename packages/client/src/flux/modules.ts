import { findByPropsLazy } from '~/metro/wrappers';

export const Flux = findByPropsLazy('Store', 'connectStores');
export const FluxHooks = findByPropsLazy('useStateFromStores');
export const Dispatcher = findByPropsLazy('dispatch', 'subscribe');
