import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { useState, type ReactNode } from 'react';

import StateIcon from '~/components/state-icon';

type PermissionRowProps = {
	title: string;
	description?: string;
	state?: 'allowed' | 'denied';
	icon?: ReactNode;
	trailing?: ReactNode;
};

function PermissionRow({ title, description, state, icon, trailing }: PermissionRowProps) {
	const [expanded, setExpanded] = useState(false);
	const ActionSheetRow = getActionSheetRow();

	return (
		<ActionSheetRow
			label={title}
			subLabel={expanded ? description : undefined}
			icon={icon ?? (state ? <StateIcon state={state} /> : undefined)}
			trailing={trailing}
			onPress={description ? () => setExpanded((open) => !open) : undefined}
		/>
	);
}

export default PermissionRow;
