import type { ReactElement } from 'react';

import { HelpMessage, HelpMessageTypes } from '~/metro/components';

/** Props for `NoticeRow`. */
export type NoticeRowProps = {
	/** The message's first line. */
	title: string;
	/** A second line under the title; none when omitted. */
	subtitle?: string;
	/** `info` reads plain, `warning` cautious, `danger` as an error. */
	tone: 'info' | 'warning' | 'danger';
};

/**
 * @description A message in a settings panel, drawn with Discord's `HelpMessage` in the style of its tone; it takes no input.
 * @param props The title, subtitle and tone.
 * @returns The message.
 */
function NoticeRow({ title, subtitle, tone }: NoticeRowProps): ReactElement {
	const messageType = {
		info: HelpMessageTypes.INFO,
		warning: HelpMessageTypes.WARNING,
		danger: HelpMessageTypes.ERROR,
	}[tone];

	return (
		<HelpMessage messageType={messageType}>
			{subtitle === undefined ? title : `${title}\n${subtitle}`}
		</HelpMessage>
	);
}

export default NoticeRow;
