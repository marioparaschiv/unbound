#include <cassert>
#include <string>
#include <vector>

#include "LoaderBase64.h"

static std::string encoded(const std::string &text)
{
    return loader::base64Encode(reinterpret_cast<const std::uint8_t *>(text.data()), text.size());
}

static std::string decoded(const std::string &text)
{
    auto bytes = loader::base64Decode(text);
    assert(bytes);
    return std::string(bytes->begin(), bytes->end());
}

int main()
{
    assert(encoded("") == "");
    assert(encoded("f") == "Zg==");
    assert(encoded("fo") == "Zm8=");
    assert(encoded("foo") == "Zm9v");
    assert(encoded("foobar") == "Zm9vYmFy");
    assert(decoded("Zg==") == "f");
    assert(decoded("Zm8=") == "fo");
    assert(decoded("Zm9vYmFy") == "foobar");

    std::vector<std::uint8_t> every(256);
    for (std::size_t index = 0; index < every.size(); index++)
    {
        every[index] = static_cast<std::uint8_t>(index);
    }

    auto roundTrip = loader::base64Decode(loader::base64Encode(every.data(), every.size()));
    assert(roundTrip && *roundTrip == every);

    assert(!loader::base64Decode("Zg="));
    assert(!loader::base64Decode("Z===="));
    assert(!loader::base64Decode("Zg==Zg=="));
    assert(!loader::base64Decode("Zm9*"));
    return 0;
}
