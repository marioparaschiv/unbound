#include <cassert>
#include <fstream>
#include <sstream>
#include <string>

#include "NativePluginRuntime.h"

using namespace loader::native;

int main()
{
    assert(nativeErrorDelivery() == NativeErrorDelivery::Throw);
    setNativeErrorDelivery(NativeErrorDelivery::Envelope);
    assert(nativeErrorDelivery() == NativeErrorDelivery::Envelope);
    setNativeErrorDelivery(NativeErrorDelivery::Throw);
    assert(nativeErrorDelivery() == NativeErrorDelivery::Throw);

    std::ifstream      file(std::string(UNBOUND_BOOTSTRAP_DIR) + "/native-failure-guard.js");
    std::ostringstream contents;
    contents << file.rdbuf();
    std::string source = contents.str();
    assert(!source.empty());
    assert(source.find(std::string("'") + kNativeFailureEnvelopeKey + "'") != std::string::npos);
    assert(source.find(std::string("'") + kNativeFailureGuardName + "'") != std::string::npos);
    assert(source.find("error.code = String(failure.code);") != std::string::npos);
    assert(source.find("throw error;") != std::string::npos);
    assert(source.find("return guard;") != std::string::npos);
    assert(std::string(kNativeBridgeErrorCode) == "NATIVE_BRIDGE_ERROR");
}
