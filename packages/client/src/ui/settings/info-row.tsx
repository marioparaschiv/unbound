import type { ReactNode } from 'react';

import { Discord } from '~/metro/components';

type InfoRowProps = {
	label: string;
	value: string;
	icon: ReactNode;
	onPress?: () => void;
};

/** A version-info row: label on the left, an icon, and a muted value trailing on the right. */
function InfoRow({ label, value, icon, onPress }: InfoRowProps) {
	return (
		<Discord.TableRow
			label={label}
			icon={icon}
			onPress={onPress}
			trailing={<Discord.TableRow.TrailingText text={value} />}
		/>
	);
}

export default InfoRow;
