import type { AvailableChoice, VersionChoice } from '~/addons/versions';
import { BottomSheets } from '~/metro/components';
import { messages, format } from '~/i18n/api';
import { Moment } from '~/metro/common';

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

export default VersionRow;
