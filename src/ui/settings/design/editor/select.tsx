// Here we select a theme or allow the user to create a new theme
// If the user chooses to create a new theme, push create.tsx
//
// This page should send a flux event that closes the settings page
// and takes you to the main page of discord (where channels and stuff are)
// then opens the theme editor view
//
// NOTE: You can use the themes Addons page for this, just modify its appearance,
import { useSettingsStore } from '@api/storage';
import { Themes } from '@managers';
import { Dispatcher, React, ReactNative as RN } from '@metro/common';
import { Redesign } from '@metro/components';
import { Addons } from '@ui/components/internal';

export function SelectPage() {
  const addons = Themes.useEntities();
  const settings = useSettingsStore('theme-editor');
  const navigation = Redesign.useNavigation();

  return (
    <RN.View style={{ flex: 1 }}>
      <Addons
        showHeaderRight={false}
        showOverflow={false}
        showToggles={false}
        type='Themes'
        addons={addons}
        arrow
        onPress={addon => {
          // Should be enough to go back to the settings page
          for (let i = 0; i < 3; ++i) {
            navigation.popToTop();
          }

          settings.set('enabled', true);
          settings.set('selected', addon.id);
          Dispatcher.dispatch({ type: 'ENABLE_THEME_EDITOR' })
        }}
      />
    </RN.View>
  );
}
