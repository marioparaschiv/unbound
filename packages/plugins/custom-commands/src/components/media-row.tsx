import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { Image } from 'react-native';

import { isSaved, mediaUri } from '~/media';
import type { DraftMedia } from '~/media';

type MediaRowProps = {
	media: DraftMedia;
	onRemove: () => void;
};

function MediaRow({ media, onRemove }: MediaRowProps) {
	const mimeType = isSaved(media) ? media.mimeType : media.type;
	const uri = isSaved(media) ? mediaUri(media) : media.uri;
	const kind = mimeType.startsWith('video/') ? 'Video' : 'Image';
	const size = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
		media.fileSize / 1024,
	);

	return (
		<Discord.TableRow
			label={media.fileName}
			labelLineClamp={1}
			subLabel={`${kind} · ${size} KB`}
			icon={
				mimeType.startsWith('image/') ? (
					<Image source={{ uri }} style={{ borderRadius: 8, height: 48, width: 48 }} />
				) : (
					<Discord.TableRow.Icon source={assets.getIDByName('VideoIcon')} />
				)
			}
			trailing={
				<Discord.IconButton
					size='sm'
					variant='secondary'
					icon={assets.getIDByName('XSmallIcon')}
					accessibilityLabel={`Remove ${media.fileName}`}
					onPress={onRemove}
				/>
			}
		/>
	);
}

export default MediaRow;
