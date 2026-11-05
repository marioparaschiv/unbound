import type { ReactElement } from 'react';

import type { SettingPredicates } from '~/ui/settings-kit/conditions';
import type { LayoutItem } from '~/ui/settings-kit/schema-layout';
import useConditions from '~/ui/settings-kit/use-conditions';
import StoredField from '~/ui/settings-kit/stored-field';
import type { DefinedSettings } from '~/storage/define';
import ButtonRow from '~/ui/settings-kit/button-row';
import NoticeRow from '~/ui/settings-kit/notice-row';

type SchemaFieldProps = {
	settings: DefinedSettings;
	item: LayoutItem;
	translate: (key: string) => string;
	predicates: SettingPredicates;
	/** Runs an export of the plugin's src/actions.ts by name. */
	runAction: (name: string) => void;
	/** Called after a setting marked `requiresRestart` changes. */
	onRestartNeeded: () => void;
};

/**
 * @description One row of a generated settings panel: a setting, which re-renders only when it changes, an action or a notice.
 * Its `visibleWhen` and `disabledWhen` hide or disable it live.
 * @param props The plugin's settings, the row, the plugin's message lookup, predicates and actions.
 * @returns The row, or `null` while it is hidden.
 */
function SchemaField({
	settings,
	item,
	translate,
	predicates,
	runAction,
	onRestartNeeded,
}: SchemaFieldProps): ReactElement | null {
	const { visible, disabled } = useConditions(settings, item.path, item.field, predicates);

	if (!visible) return null;

	if (item.kind === 'button') {
		const { field } = item;

		return (
			<ButtonRow
				label={field.title === undefined ? item.path : translate(field.title)}
				subLabel={field.subtitle === undefined ? undefined : translate(field.subtitle)}
				variant={field.displayAs}
				confirmation={field.confirm === undefined ? undefined : translate(field.confirm)}
				disabled={disabled}
				onPress={() => runAction(field.action)}
			/>
		);
	}

	if (item.kind === 'notice') {
		const { field } = item;

		return (
			<NoticeRow
				title={field.title === undefined ? item.path : translate(field.title)}
				subtitle={field.subtitle === undefined ? undefined : translate(field.subtitle)}
				tone={field.tone}
			/>
		);
	}

	return (
		<StoredField
			settings={settings}
			item={item}
			translate={translate}
			disabled={disabled}
			onRestartNeeded={onRestartNeeded}
		/>
	);
}

export default SchemaField;
