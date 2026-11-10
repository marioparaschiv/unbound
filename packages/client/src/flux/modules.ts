import { byProps } from '~/metro/filters';
import { find } from '~/metro/lookups';

export const Flux = find(byProps('Store', 'connectStores'));
export const FluxHooks = find(byProps('useStateFromStores'));
export const Dispatcher = find(byProps('dispatch', 'subscribe'));
