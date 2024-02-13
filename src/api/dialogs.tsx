import type { AlertProps } from '@typings/api/dialogs';
import { ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';
import { Strings } from '@api/i18n';
import { uuid } from '@utilities';

export function showAlert(options: AlertProps) {
	Redesign.openAlert(
		options.key ?? uuid(),
		<Redesign.AlertModal
			title={options.title}
			content={options.content}
			actions={<>
				<RN.View
					style={{
						marginTop: !options.content ? -32 : -8,
						marginBottom: (options.componentMargin ?? true) && options.component ? 8 : 0
					}}
				>
					{options.component}
				</RN.View>
				{options.buttons?.length > 0 && options.buttons.map(button => (
					React.createElement(
						Redesign[(button.closeAlert ?? true) ? 'AlertActionButton' : 'Button'],
						button
					)
				))}
				{(options.cancelButton ?? true) && (
					<Redesign.AlertActionButton
						text={Strings.CANCEL}
						variant='secondary'
						onPress={() => options.onCancel?.()}
					/>
				)}
			</>}
		/>
	);
}

export default { showAlert };