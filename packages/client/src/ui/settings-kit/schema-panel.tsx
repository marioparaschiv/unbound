import { useState, type ReactElement } from 'react';

import { runSettingsAction, type SettingActions } from '~/ui/settings-kit/run-action';
import type { SettingPredicates } from '~/ui/settings-kit/conditions';
import { schemaLayout } from '~/ui/settings-kit/schema-layout';
import SchemaSection from '~/ui/settings-kit/schema-section';
import type { DefinedSettings } from '~/storage/define';
import RestartRow from '~/ui/settings-kit/restart-row';
import ResetRow from '~/ui/settings-kit/reset-row';
import Page from '~/ui/components/page';

const NO_PREDICATES: SettingPredicates = {};
const NO_ACTIONS: SettingActions = {};

/** Props for `SchemaPanel`. */
export type SchemaPanelProps = {
	/** The plugin's settings, from `storage.define`. */
	settings: DefinedSettings;
	/** The plugin's messages in the user's locale; every title, subtitle and option label is a key of them. */
	messages: Readonly<Record<string, string>>;
	/** The plugin's `useMessages` hook, which re-renders the panel when the user's locale changes. */
	useMessages: () => string;
	/** The `visibleWhen` and `disabledWhen` predicates the build lifted out of settings.ts, by setting key. */
	predicates?: SettingPredicates;
	/** The exports of the plugin's src/actions.ts, which `setting.button` rows run. */
	actions?: SettingActions;
	/** The plugin's id, which names it when an action fails. */
	pluginId?: string;
};

/**
 * @description The settings panel generated from a plugin's settings schema: a row per setting, a section per
 * `setting.section`, a restart hint once a `requiresRestart` setting changes, and a reset row.
 * @param props The plugin's settings, messages, predicates and actions.
 * @returns The page.
 */
function SchemaPanel({
	settings,
	messages,
	useMessages,
	predicates = NO_PREDICATES,
	actions = NO_ACTIONS,
	pluginId = 'a plugin',
}: SchemaPanelProps): ReactElement {
	const [restartNeeded, setRestartNeeded] = useState(false);

	useMessages();

	const translate = (key: string) => messages[key] ?? key;

	return (
		<Page>
			{restartNeeded ? <RestartRow /> : null}
			{schemaLayout(settings.schema).map((section) => (
				<SchemaSection
					key={section.path || 'settings'}
					settings={settings}
					section={section}
					translate={translate}
					predicates={predicates}
					runAction={(name) => void runSettingsAction(actions, name, pluginId)}
					onRestartNeeded={() => setRestartNeeded(true)}
				/>
			))}
			<ResetRow onReset={settings.reset} />
		</Page>
	);
}

export default SchemaPanel;
