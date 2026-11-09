#pragma once

#include <jsi/jsi.h>

#include "LoaderSettings.h"

namespace loader {
// `NativePlatform.settings`: JS reads single keys from the store and stages or applies changes.
facebook::jsi::Object settingsBridge(facebook::jsi::Runtime &runtime, SettingsStore *store);
}
