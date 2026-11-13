import { Discord, Avatars } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import type { ReactNode } from 'react';
import { Image } from 'react-native';

import type { Entity } from './entity';

import useStyles from './entity-row.style';

type EntityRowProps = {
	/** The resolved entity, or `undefined` to show the bare id. */
	entity: Entity | undefined;
	id: string;
	/** The second line when nothing resolves the id. */
	unknownLabel: string;
	onPress?: () => void;
	trailing?: ReactNode;
};

/**
 * @description One user, channel or server as Discord draws it in a list: avatar or icon, name, and a second line.
 * @param props The entity, its id, and what pressing it does.
 * @returns The row.
 */
function EntityRow({ entity, id, unknownLabel, onPress, trailing }: EntityRowProps) {
	const styles = useStyles();
	const { Avatar, AvatarSizes } = Avatars;

	function icon() {
		if (entity?.kind === 'user' && entity.image) {
			return <Avatar source={{ uri: entity.image }} size={AvatarSizes.SMALL} />;
		}

		if (entity?.image) {
			return <Image source={{ uri: entity.image }} style={styles.guildIcon} />;
		}

		return <Discord.TableRow.Icon source={assets.getIdByName(entity?.icon ?? 'ServerIcon')} />;
	}

	return (
		<Discord.TableRow
			label={entity?.name ?? id}
			subLabel={entity ? entity.detail : unknownLabel}
			labelLineClamp={1}
			subLabelLineClamp={1}
			icon={icon()}
			arrow={Boolean(onPress) && !trailing}
			trailing={trailing}
			onPress={onPress}
		/>
	);
}

export default EntityRow;
