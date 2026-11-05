#pragma once

#include <jsi/jsi.h>
#include <memory>

#include "LoaderFontService.h"

namespace loader {
// `UnboundNative.fonts`: `list` and `listPresets` answer at once; every other method runs off the
// JS thread and returns a promise that rejects with what failed.
facebook::jsi::Object makeFontsBridge(facebook::jsi::Runtime             &runtime,
                                      std::shared_ptr<fonts::FontService> service);
}
