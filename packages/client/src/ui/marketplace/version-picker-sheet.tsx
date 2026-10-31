import type { ListedAddon } from '@unbound-app/contracts/addons';

import type { AvailableChoice, VersionChoice } from '~/addons/versions';
import type { UpdatableKind } from '~/addons/manager-of';
import { toVersionChoices } from '~/addons/versions';
import { CLIENT_VERSION } from '~/core/constants';
import { BottomSheets } from '~/metro/components';
import { messages, format } from '~/i18n/api';
import { Manager } from '~/addons/manager';
import { Moment } from '~/metro/common';

import useAddonVersions from './use-addon-versions';
import { getInstalledVersion } from './targets';

type VersionPickerSheetProps = {
	kind: UpdatableKind;
	addon: ListedAddon;
	/** Runs with the chosen version; the sheet is already closing. */
	onPick: (choice: AvailableChoice) => void;
	onClose: () => void;
};

type VersionRowProps = {
	choice: VersionChoice;
	onPick: (choice: AvailableChoice) => void;
};

function describeChoice(choice: VersionChoice): string {
	const published = Moment.utc(choice.version.publishedAt).fromNow();

	switch (choice.type) {
		case 'available':
			return choice.latest ? `${published} · ${messages.UNBOUND_VERSION_LATEST}` : published;
		case 'installed':
			return choice.latest
				? `${published} · ${messages.UNBOUND_VERSION_LATEST} · ${messages.UNBOUND_INSTALLED}`
				: `${published} · ${messages.UNBOUND_INSTALLED}`;
		case 'incompatible':
			return `${published} · ${format('UNBOUND_VERSION_NEEDS_CLIENT', { version: choice.requires })}`;
	}
}

function VersionRow({ choice, onPick }: VersionRowProps) {
	const { ActionSheetRow } = BottomSheets;

	return (
		<ActionSheetRow
			label={`v${choice.version.version}`}
			subLabel={describeChoice(choice)}
			disabled={choice.type === 'incompatible'}
			onPress={choice.type === 'available' ? () => onPick(choice) : void 0}
		/>
	);
}

/**
 * @description An action sheet listing every live version of a listed addon, newest first. Pressing a
 * version this client can run, other than the installed one, closes the sheet and hands it back.
 */
function VersionPickerSheet({ kind, addon, onPick, onClose }: VersionPickerSheetProps) {
	const { ActionSheet, ActionSheetRow, BottomSheetTitleHeader } = BottomSheets;
	const { state, retry } = useAddonVersions(addon.id);
	const { name } = addon.latestVersion.manifest;
	const held = Manager.for(kind).getHeldVersion(addon.id);
	const installed = getInstalledVersion(kind, addon);

	function pick(choice: AvailableChoice) {
		onClose();
		onPick(choice);
	}

	return (
		<ActionSheet>
			<BottomSheetTitleHeader
				title={format('UNBOUND_VERSIONS_TITLE', { name })}
				subtitle={held ? format('UNBOUND_VERSIONS_HELD', { version: held }) : void 0}
			/>
			<ActionSheetRow.Group>
				{state.status === 'loading' ? (
					<ActionSheetRow label={messages.UNBOUND_VERSIONS_LOADING} disabled />
				) : null}
				{state.status === 'failed' ? (
					<ActionSheetRow
						label={messages.UNBOUND_VERSIONS_FAILED}
						subLabel={messages.UNBOUND_VERSIONS_RETRY}
						onPress={retry}
					/>
				) : null}
				{state.status === 'ready'
					? toVersionChoices(state.versions, installed, CLIENT_VERSION).map((choice) => (
							<VersionRow
								key={choice.version.version}
								choice={choice}
								onPick={pick}
							/>
						))
					: null}
			</ActionSheetRow.Group>
		</ActionSheet>
	);
}

export default VersionPickerSheet;
