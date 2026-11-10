import { runFeatures } from '@unbound-plugins/shared/lifecycle/features';

import { codeblocksSelfTest, startCodeblocks } from '~/codeblocks';

export const { start, stop, selfTest } = runFeatures(startCodeblocks, {
	atomic: true,
	selfTest: codeblocksSelfTest,
});

export { SettingsPanel } from '~/settings';
