import { metro, patcher } from '@unbound-app/api';

const unpatches: (() => void)[] = [];

export default {
	start() {
		const UserStore = metro.findByProps('getCurrentUser', 'getUser');

		unpatches.push(
			patcher.after(UserStore, 'getCurrentUser', ({ result }) => {
				console.log('[{{displayName}}] getCurrentUser returned', result?.username);
			}),
		);
	},

	stop() {
		for (const unpatch of unpatches) unpatch();

		unpatches.length = 0;
	},
};
