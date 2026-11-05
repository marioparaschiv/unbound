import { View } from 'react-native';
import { useRef } from 'react';

import FlashList, { type FlashListHandle } from '~/ui/components/flash-list';
import { Discord, SafeArea } from '~/metro/components';
import InstallMenu from '~/ui/addons/install-menu';
import Empty from '~/ui/components/empty-state';
import AddonCard from '~/ui/addons/addon-card';
import { messages, format } from '~/i18n/api';
import useAddons from '~/ui/hooks/use-addons';
import type { Addon } from '~/addons/addon';

import type { Filter } from './filter-menu';

import usePluginFilter from './use-plugin-filter';
import LibrariesToggle from './libraries-toggle';
import useLibraries from './use-libraries';
import useStyles from './plugins.style';
import FilterMenu from './filter-menu';

type CardInfo = { item: Addon };

const keyOf = (addon: Addon) => addon.id;

/**
 * @description The Plugins settings page: a pinned round search field beside round install and filter buttons, over
 * a virtualised list of plugin cards that runs to the bottom edge. Library plugins stay hidden behind a toggle that
 * counts them.
 */
function PluginsPage() {
	const styles = useStyles();
	const { listed, libraries, shown, toggle } = useLibraries(useAddons('plugin'));
	const { query, setQuery, filter, setFilter, visible, counts } = usePluginFilter(listed);
	const list = useRef<FlashListHandle>(null);

	// Another filter shows another list, so it starts from the top.
	function pick(next: Filter) {
		list.current?.scrollToOffset({ offset: 0, animated: false });
		setFilter(next);
	}

	const labels = {
		all: messages.UNBOUND_FILTER_ALL,
		enabled: messages.UNBOUND_FILTER_ENABLED,
		disabled: messages.UNBOUND_FILTER_DISABLED,
	};

	function renderCard({ item }: CardInfo) {
		return (
			<View style={styles.card}>
				{/* Keyed so a recycled cell remounts: the settings button's motion must not carry over to another addon. */}
				<AddonCard
					key={item.id}
					addon={item}
					kind='plugin'
					library={libraries.has(item.id)}
				/>
			</View>
		);
	}

	return (
		<View style={styles.page}>
			<Discord.Stack
				direction='horizontal'
				spacing={8}
				align='center'
				style={styles.controls}
			>
				<View style={styles.search}>
					<Discord.SearchBar
						size='md'
						value={query}
						onChange={setQuery}
						placeholder={format('UNBOUND_SEARCH', { type: messages.UNBOUND_PLUGINS })}
					/>
				</View>
				<InstallMenu kind='plugin' size='md' />
				<FilterMenu value={filter} counts={counts} labels={labels} onChange={pick} />
			</Discord.Stack>
			{visible.length ? (
				<FlashList
					ref={list}
					data={visible}
					extraData={`${filter}:${shown}`}
					keyExtractor={keyOf}
					renderItem={renderCard}
					estimatedItemSize={128}
					ListFooterComponent={
						// The bottom inset pads the end of the list, so the cards scroll under the home indicator.
						<SafeArea.SafeAreaPaddingView bottom>
							<LibrariesToggle
								count={libraries.size}
								shown={shown}
								onToggle={toggle}
							/>
						</SafeArea.SafeAreaPaddingView>
					}
					keyboardDismissMode='on-drag'
					contentContainerStyle={styles.content}
				/>
			) : (
				// Fills the space under the controls without scrolling, so the empty state sits in its centre.
				<SafeArea.SafeAreaPaddingView bottom style={styles.empty}>
					<View style={styles.center}>
						<Empty image='sticker_search_empty'>{messages.UNBOUND_EMPTY_RESULTS}</Empty>
					</View>
					<LibrariesToggle count={libraries.size} shown={shown} onToggle={toggle} />
				</SafeArea.SafeAreaPaddingView>
			)}
		</View>
	);
}

export default PluginsPage;
