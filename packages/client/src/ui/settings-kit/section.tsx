import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps, ReactElement } from 'react';

import { Discord } from '~/metro/components';

/** Props of {@link Section}: Discord's `TableRowGroup` props, such as `title`. */
export type SectionProps = ComponentProps<DesignModule['TableRowGroup']>;

/**
 * @description A titled group of settings rows, Discord's `TableRowGroup`.
 * @param props The group's title and rows.
 * @returns The group.
 */
function Section(props: SectionProps): ReactElement {
	return <Discord.TableRowGroup {...props} />;
}

export default Section;
