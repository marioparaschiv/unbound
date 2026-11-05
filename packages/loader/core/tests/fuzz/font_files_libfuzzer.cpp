#include <cstddef>
#include <cstdint>

#include "FontFilesFuzz.h"

extern "C" int LLVMFuzzerTestOneInput(const std::uint8_t *data, std::size_t size)
{
    font_files_fuzz::fuzzOne(data, size);
    return 0;
}
