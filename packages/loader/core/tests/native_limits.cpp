#include <cassert>
#include <stdexcept>
#include <string>

#include "NativeLimits.h"

using namespace loader::native;

template <typename Parse> static bool rejects(Parse parse)
{
    try
    {
        parse();
    }
    catch (const std::invalid_argument &)
    {
        return true;
    }
    return false;
}

int main()
{
    assert(kMaximumHandleIdBytes == 128);
    assert(kMaximumNativeNameBytes == 256);
    assert(kMaximumBatchSteps == 64);
    assert(kMaximumAssociationsPerObject == 64);
    assert(kMaximumMountedSurfaces == 64);

    assert(parseName("java.lang.String", kMaximumNativeNameBytes, "class name") ==
           "java.lang.String");
    assert(parseName(std::string(256, 'a'), kMaximumNativeNameBytes, "class name").size() == 256);
    assert(rejects([] {
        parseName(std::string(257, 'a'), kMaximumNativeNameBytes, "class name");
    }));
    assert(rejects([] {
        parseName("", kMaximumNativeNameBytes, "class name");
    }));
    assert(parseName(" padded ", kMaximumNativeNameBytes, "class name") == " padded ");
    std::string multibyte;
    for (int index = 0; index < 64; index++)
    {
        multibyte += "\xE2\x82\xAC";
    }
    assert(rejects([&] {
        parseName(multibyte, 128, "member name");
    }));

    assert(parseHandleId({{"id", "java-1"}}, "handle") == "java-1");
    assert(parseHandleId({{"type", "handle"}, {"value", "java-2"}}, "handle") == "java-2");
    assert(parseHandleId({{"id", "surface-1"}, {"type", "handle"}, {"value", "java-3"}},
                         "handle") == "surface-1");
    assert(parseHandleId({{"id", " java-4 "}}, "handle") == " java-4 ");
    assert(rejects([] {
        parseHandleId({{"id", ""}}, "handle");
    }));
    assert(rejects([] {
        parseHandleId({{"id", std::string(129, 'x')}}, "handle");
    }));
    assert(rejects([] {
        parseHandleId({{"id", 7}}, "handle");
    }));
    assert(rejects([] {
        parseHandleId({{"type", "string"}, {"value", "java-5"}}, "handle");
    }));
    assert(rejects([] {
        parseHandleId(nlohmann::json::array(), "handle");
    }));
    assert(handleJSON("java-6") == R"({"id":"java-6"})");
}
