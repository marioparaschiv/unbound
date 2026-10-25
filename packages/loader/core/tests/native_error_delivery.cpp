#include "NativePluginRuntime.h"

#include <cassert>
#include <string>

using namespace loader::native;

int main()
{
    assert(nativeErrorDelivery() == NativeErrorDelivery::Throw);
    setNativeErrorDelivery(NativeErrorDelivery::Envelope);
    assert(nativeErrorDelivery() == NativeErrorDelivery::Envelope);
    setNativeErrorDelivery(NativeErrorDelivery::Throw);
    assert(nativeErrorDelivery() == NativeErrorDelivery::Throw);

    std::string source = kNativeFailureGuardSource;
    assert(source.rfind("(function () {", 0) == 0);
    assert(source.find(std::string("'") + kNativeFailureEnvelopeKey + "'") != std::string::npos);
    assert(source.find(std::string("'") + kNativeFailureGuardName + "'") != std::string::npos);
    assert(source.find("error.code = String(failure.code);") != std::string::npos);
    assert(source.find("throw error;") != std::string::npos);
    assert(std::string(kNativeBridgeErrorCode) == "NATIVE_BRIDGE_ERROR");
}
