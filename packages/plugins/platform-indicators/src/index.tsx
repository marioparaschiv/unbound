import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import { featureSelfTest } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { patchUserProfilePrimaryInfo } from '~/patches/user-profile-primary-info';
import { patchMessageRowData } from '~/patches/message-row-data';
import { patchPresenceStore } from '~/patches/presence-store';
import { patchUserRow } from '~/patches/user-row';
import SettingsPanel from '~/components/settings-panel';
import { PLUGIN_NAME, SETTINGS, type SettingKey } from '~/constants';
import {
	MessageRowData,
	PresenceStore,
	SessionsStore,
	settings,
	Theme,
	ThemeStore,
	UserStore,
} from '~/modules';

function withIndicatorModules(feature: string, apply: () => () => void) {
	return () =>
		ensureModules(`${PLUGIN_NAME}: ${feature}`, { Theme, ThemeStore }) ? apply() : () => {};
}

function withRowModules(apply: () => () => void) {
	return () =>
		ensureModules(`${PLUGIN_NAME}: messages`, { MessageRowData }) ? apply() : () => {};
}

const FEATURES: Record<SettingKey, () => () => void> = {
	memberList: withIndicatorModules('member list', patchUserRow),
	profiles: withIndicatorModules('profiles', patchUserProfilePrimaryInfo),
	messages: withRowModules(patchMessageRowData),
	colorMobileIndicator: patchPresenceStore,
};

let dispose: () => Promise<void> | undefined = () => undefined;

function start() {
	if (!ensureModules(PLUGIN_NAME, { PresenceStore, SessionsStore, UserStore })) return;

	dispose = applyFeatures(
		PLUGIN_NAME,
		(Object.keys(FEATURES) as SettingKey[]).map(
			(key) => () => whileEnabled(settings, key, SETTINGS[key], FEATURES[key]),
		),
	);
}

function stop() {
	const pending = dispose();

	dispose = () => undefined;

	return pending;
}

export default {
	start,
	stop,
	selfTest: featureSelfTest,
	getSettingsPanel: () => <SettingsPanel />,
};
