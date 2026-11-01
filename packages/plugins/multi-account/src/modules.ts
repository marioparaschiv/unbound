import type { FluxStore } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

type MultiAccountStoreType = FluxStore & {
	getCanUseMultiAccountMobile(): boolean;
};

export const MultiAccountStore = flux.getStore('MultiAccount', {
	lazy: true,
}) as MultiAccountStoreType;
