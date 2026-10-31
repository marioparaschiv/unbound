import type { ListedAddon } from '@unbound-app/contracts/addons';

import type { AvailableChoice, VersionChoice } from '~/lib/addon-versions';
import { toVersionChoices } from '~/lib/addon-versions';
import { BottomSheets } from '~/api/metro/components';
import type { UpdatableKind } from '~/lib/updates';
import { CLIENT_VERSION } from '~/lib/constants';
import { Messages, format } from '~/api/i18n';
import { getManager } from '~/managers/utils';
import { Moment } from '~/api/metro/common';

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
			return choice.latest ? `${published} · ${Messages.UNBOUND_VERSION_LATEST}` : published;
		case 'installed':
			return choice.latest
				? `${published} · ${Messages.UNBOUND_VERSION_LATEST} · ${Messages.UNBOUND_INSTALLED}`
				: `${published} · ${Messages.UNBOUND_INSTALLED}`;
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
	const held = getManager(kind).getHeldVersion(addon.id);
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
					<ActionSheetRow label={Messages.UNBOUND_VERSIONS_LOADING} disabled />
				) : null}
				{state.status === 'failed' ? (
					<ActionSheetRow
						label={Messages.UNBOUND_VERSIONS_FAILED}
						subLabel={Messages.UNBOUND_VERSIONS_RETRY}
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
