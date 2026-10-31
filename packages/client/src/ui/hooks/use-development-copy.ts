import { useSettingsStore } from '~/storage/api';
import { Manager } from '~/addons/manager';

/**
 * @description Reads whether an addon is a development copy, re-rendering when its manager's development markers change.
 * @param kind The addon's kind.
 * @param id The addon id.
 * @returns Whether the addon is a development copy.
 */
function useDevelopmentCopy(kind: 'plugin' | 'theme' | 'icon-pack', id: string): boolean {
	const manager = Manager.for(kind);

	useSettingsStore(manager.bucket, ({ key }) => key === 'development');

	return manager.isDevelopmentCopy(id);
}

export default useDevelopmentCopy;
