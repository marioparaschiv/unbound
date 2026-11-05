import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { Image } from 'react-native';

import { isSaved, mediaUri } from '~/commands/media';
import type { DraftMedia } from '~/commands/media';

type MediaRowProps = {
	media: DraftMedia;
	onRemove: () => void;
};

function MediaRow({ media, onRemove }: MediaRowProps) {
	const mimeType = isSaved(media) ? media.mimeType : media.type;
	const uri = isSaved(media) ? mediaUri(media) : media.uri;
	const kind = mimeType.startsWith('video/') ? messages.MEDIA_VIDEO : messages.MEDIA_IMAGE;
	const size = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
		media.fileSize / 1024,
	);

	return (
		<Discord.TableRow
			label={media.fileName}
			labelLineClamp={1}
			subLabel={format('MEDIA_DETAILS', { kind, size })}
			icon={
				mimeType.startsWith('image/') ? (
					<Image source={{ uri }} style={{ borderRadius: 8, height: 48, width: 48 }} />
				) : (
					<Discord.TableRow.Icon source={assets.getIdByName('VideoIcon')} />
				)
			}
			trailing={
				<Discord.IconButton
					size='sm'
					variant='secondary'
					icon={assets.getIdByName('XSmallIcon')}
					accessibilityLabel={format('REMOVE_MEDIA_LABEL', { name: media.fileName })}
					onPress={onRemove}
				/>
			}
		/>
	);
}

export default MediaRow;
