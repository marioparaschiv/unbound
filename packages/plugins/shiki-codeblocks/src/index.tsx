import type { PluginContext } from '@unbound-app/api/native';

import { codeblocksSelfTest, startCodeblocks, stopCodeblocks } from '~/codeblocks';

export function start(context: PluginContext) {
	startCodeblocks(context);
}

export function stop() {
	return stopCodeblocks();
}

export function selfTest() {
	return codeblocksSelfTest();
}

export { SettingsPanel } from '~/settings';
