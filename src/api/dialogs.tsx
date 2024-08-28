import type { AlertProps } from '@typings/api/dialogs';
import { Design } from '@api/metro/components';
import { createElement } from 'react';
import { View } from 'react-native';
import { Strings } from '@api/i18n';
import { uuid } from '@utilities';

export type * from '@typings/api/dialogs';

export function showDialog(options: AlertProps) {
	options.key ??= uuid();

	Design.openAlert(options.key, <Design.AlertModal
		title={options.title}
		content={options.content}
		actions={<>
			<View
				style={{
					marginTop: !options.content ? -32 : -8,
					marginBottom: (options.componentMargin ?? true) && options.component ? 8 : 0
				}}
			>
				{options.component}
			</View>
			{options.buttons?.length > 0 && options.buttons.map(button => createElement(
				Design[(button.closeAlert ?? true) ? 'AlertActionButton' : 'Button'],
				button
			))}
			{(options.cancelButton ?? true) && (
				<Design.AlertActionButton
					text={Strings.CANCEL}
					variant='secondary'
					onPress={() => options.onCancel?.()}
				/>
			)}
		</>}
	/>);
}

export default { showDialog };