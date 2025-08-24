import { View, SafeAreaView, Image, Dimensions } from 'react-native';
import { Icons, getIDByName } from '@api/assets';
import { useSettingsStore } from '@api/storage';
import { Discord } from '@api/metro/components';
import { Clipboard } from '@api/metro/common';
import { TintedIcon } from '@ui/misc/forms';
import { reload } from '@api/native';
import { CodeBlock } from '@ui/misc';
import { Strings } from '@api/i18n';
import { useState } from 'react';

import useStyles from './error-boundary.style';


interface ErrorBoundaryProps {
	error: Record<string, any>;
	retryRender: () => void;
	res: any;
};

interface CardProps extends React.ComponentProps<typeof View> {
	containerStyle?: React.ComponentProps<typeof View>['style'];
};

const Card = ({ style, children, containerStyle, ...props }: CardProps) => {
	const styles = useStyles();

	return <View {...props} style={[styles.card, styles.cardShadow, style]}>
		<View style={[styles.cardContainer, containerStyle]}>
			{children}
		</View>
	</View>;
};

const Header = () => {
	const styles = useStyles();

	return <Card containerStyle={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
		<Image
			source={{ uri: 'https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png' }}
			style={styles.headerChainIcon}
			defaultSource={Icons['MoreHorizontalIcon']}
		/>
		{/* <Image
				source={{ uri: 'https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png' }}
				blurRadius={6}
				defaultSource={Icons['MoreHorizontalIcon']}
				style={[styles.headerChainIcon, styles.headerChainGhostIcon]}
			/> */}
		<View style={styles.headerContainer}>
			<Discord.Text variant='heading-md/bold'>
				{Strings.UNBOUND_CRASH_REPORT_TITLE}
			</Discord.Text>
			<Discord.Text variant='text-sm/semibold'>
				{Strings.UNBOUND_CRASH_REPORT_SUBTITLE}
			</Discord.Text>
		</View>
	</Card>;
};

const Outline = ({ state, error }: any) => {
	const styles = useStyles();

	let loadingTimeout: Timer;
	const [loading, setLoading] = useState(false);

	return <Card style={styles.outlineCard}>
		<View style={{ flex: 1 }}>
			<Discord.SegmentedControlPages state={state} />
			<View style={{
				position: 'absolute',
				bottom: 20,
				right: 20,
				zIndex: 1
			}}>
				<Discord.IconButton
					icon={getIDByName('ic_message_copy')}
					variant='secondary'
					size='md'
					loading={loading}
					onPress={() => {
						clearTimeout(loadingTimeout);

						setLoading(previous => !previous);
						loadingTimeout = setTimeout(() => setLoading(previous => !previous), 400);

						Clipboard.setString(error);
					}}
				/>
			</View>
		</View>
		<View style={styles.outlineSegmentedControl}>
			<Discord.SegmentedControl state={state} variant={'experimental_Large'} />
		</View>
	</Card>;
};

const Actions = ({ retryRender }: Pick<ErrorBoundaryProps, 'retryRender'>) => {
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	return <Card style={styles.actionsCard}>
		<View style={styles.actionsContainer}>
			<View style={!settings.get('recovery', false) ? { flex: 0.5, marginRight: 10 } : { flex: 1 }}>
				<Discord.Button
					onPress={retryRender}
					variant={'destructive'}
					size={'md'}
					icon={getIDByName('ic_message_retry')}
					iconPosition={'start'}
					text={Strings.UNBOUND_ERROR_BOUNDARY_ACTION_RETRY_RENDER}
				/>
			</View>

			{!settings.get('recovery', false) && (
				<View style={{ flex: 0.5 }}>
					<Discord.Button
						onPress={() => (settings.set('recovery', true), reload(false))}
						icon={getIDByName('ic_shield_24px')}
						variant={'tertiary'}
						size={'md'}
						text={Strings.UNBOUND_ERROR_BOUNDARY_ACTION_RECOVERY_MODE}
					/>
				</View>
			)}
		</View>
	</Card>;
};

export default function ErrorBoundary({ error, retryRender, res }: ErrorBoundaryProps) {
	const possibleErrors = [
		{
			id: 'component',
			icon: () => <TintedIcon source={Icons['ImageTextIcon']} size={20} />,
			label: Strings.UNBOUND_ERROR_BOUNDARY_ACTION_COMPONENT,
			error: error.toString() + error.componentStack
		},
		{
			id: 'stack',
			icon: () => <TintedIcon source={Icons['ic_category_16px']} size={20} />,
			label: Strings.UNBOUND_ERROR_BOUNDARY_ACTION_STACK_TRACE,
			error: error.stack.replace(/(at .*) \(.*\)/g, '$1')
		}
	];

	const [index, setIndex] = useState(0);
	const styles = useStyles();
	const state = Discord.useSegmentedControlState({
		defaultIndex: 0,
		items: possibleErrors.map(({ label, id, icon, error }) => {
			return {
				label,
				id,
				icon,
				page: (
					<CodeBlock
						selectable
						style={styles.outlineCodeblock}
					>
						{error}
					</CodeBlock>
				)
			};
		}),
		pageWidth: Dimensions.get('window').width - 64,
		onPageChange: setIndex
	});

	return <SafeAreaView style={styles.container}>
		<Header />
		<Outline state={state} error={possibleErrors[index].error} />
		<Actions retryRender={retryRender} />
	</SafeAreaView>;
};