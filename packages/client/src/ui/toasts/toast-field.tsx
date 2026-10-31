import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps, ComponentType } from 'react';
import { createElement } from 'react';

import { Discord } from '~/metro/components';

type ToastFieldProps = {
	value: string | ComponentType;
} & Omit<ComponentProps<DesignModule['Text']>, 'children'>;

function ToastField({ value, ...props }: ToastFieldProps) {
	if (typeof value === 'function') {
		return createElement(value);
	}

	return <Discord.Text {...props}>{value}</Discord.Text>;
}

export default ToastField;
