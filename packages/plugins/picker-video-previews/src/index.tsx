import type { PluginContext } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import type { ReactElement } from 'react';

import { PreviewVideo } from '~/components/preview-video';
import { playPreview, type PreviewUpload, type VideoComponent } from '~/lib/play-preview';
import { videoFile } from '~/native/video-file';

const UPLOAD_PREVIEW_SHEET = 'modules/media_uploads/native/UploadPreviewActionSheet.tsx';

type SheetProps = { upload?: PreviewUpload };
type VideoModule = { VideoComponent?: VideoComponent };
type ThumbnailProps = { style?: unknown };

export function start(context: PluginContext) {
	const UploadPreviewSheet = metro.findByFilePath(UPLOAD_PREVIEW_SHEET);

	if (!UploadPreviewSheet) {
		logger.warn('Video previews skipped: Discord moved UploadPreviewActionSheet.');

		return;
	}

	const findFile = (uri: string) => videoFile(context.native, uri);

	patcher.react.after(UploadPreviewSheet, 'default', ({ props, result }) => {
		const Video = (metro.findByProps('VideoComponent') as VideoModule | undefined)
			?.VideoComponent;

		if (!Video) return result;

		playPreview(
			result,
			(props as SheetProps | undefined)?.upload,
			settings.sound,
			(thumbnail, uri) => (
				<PreviewVideo
					findFile={findFile}
					Video={Video}
					uri={uri}
					style={(thumbnail.props as ThumbnailProps | undefined)?.style}
					sound={settings.sound}
					thumbnail={thumbnail as ReactElement}
				/>
			),
		);

		return result;
	});
}

export function stop() {}
