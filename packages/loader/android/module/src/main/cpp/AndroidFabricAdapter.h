#pragma once

#include <memory>

#include "AndroidLoader.h"
#include "NativeFabric.h"

namespace unbound::android {
std::shared_ptr<loader::native::FabricAdapter>
makeAndroidFabricAdapter(const JavaCallbacks &callbacks);
}
