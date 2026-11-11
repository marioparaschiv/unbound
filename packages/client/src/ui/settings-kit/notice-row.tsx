import type { ReactElement } from 'react';

import { Discord, HelpMessage, HelpMessageTypes, isRenderable } from '~/metro/components';

/** Props for `NoticeRow`. */
export type NoticeRowProps = {
	/** The message's first line. */
	title: string;
	/** A second line under the title; none when omitted. */
	subtitle?: string;
	/** `info` reads plain, `warning` cautious, `danger` as an error. */
	tone: 'info' | 'warning' | 'danger';
};

const NOTICE_TYPES = { info: 'info', warning: 'warning', danger: 'critical' } as const;

/**
 * @description A message in a settings panel, drawn with Discord's `InlineNotice` in the style of its tone, or its
 * `HelpMessage` on builds without one; it takes no input.
 * @param props The title, subtitle and tone.
 * @returns The message.
 */
function NoticeRow({ title, subtitle, tone }: NoticeRowProps): ReactElement {
	if (isRenderable(Discord.InlineNotice)) {
		return subtitle === undefined ? (
			<Discord.InlineNotice type={NOTICE_TYPES[tone]} message={title} />
		) : (
			<Discord.InlineNotice type={NOTICE_TYPES[tone]} title={title} message={subtitle} />
		);
	}

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
