/// <reference types="@unbound-app/api/global" />

import { getNativeModule, reload, BundleInfo } from '@unbound-app/api/native';
import type { DesignModule } from '@unbound-app/api/metro/components';
import { findByName, findByProps } from '@unbound-app/api/metro';
import { byProps, byName } from '@unbound-app/api/metro/filters';
import { getBucket } from '@unbound-app/api/storage';
import { getStore } from '@unbound-app/api/flux';
import { show } from '@unbound-app/api/toasts';

const SomeComponent = findByName('SomeComponent');
const props = findByProps('someProp', 'anotherProp');
const userStore = getStore('UserStore');

const propsFilter = byProps('a', 'b');
const nameFilter = byName('C');

const store = getBucket('unbound');
const enabled = store.get('plugins.enabled', false);

store.set('plugins.enabled', true);

const handle = show({
	title: 'Plugin SDK Test',
	content: 'Resolved end to end.',
	duration: 3000,
});

handle.close();

const native = getNativeModule('SomeNativeModule');
const version = BundleInfo.Version;

unbound.metro.findByProps('createStyles', 'dismissAlerts');

declare const design: DesignModule;
type CreateStylesFn = DesignModule['createStyles'];

if ($$DEV$$) {
	void reload();
	store.get('debug', false);

	const styles: CreateStylesFn = design.createStyles;

	void native;
	void SomeComponent;
	void props;
	void userStore;
	void propsFilter;
	void nameFilter;
	void enabled;
	void version;
	void styles;
}
