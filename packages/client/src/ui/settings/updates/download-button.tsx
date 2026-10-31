import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps } from 'react';

import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';

type DownloadButtonProps = {
	url: string;
	text: string;
	size?: ComponentProps<DesignModule['Button']>['size'];
	grow?: boolean;
};

function DownloadButton({ url, text, size = 'sm', grow }: DownloadButtonProps) {
	return (
		<Discord.Button
			size={size}
			grow={grow}
			variant='primary'
			text={text}
			onPress={() => void Linking.openURL(url)}
		/>
	);
}

export default DownloadButton;
