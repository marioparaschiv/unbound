#include "LoaderBundlePatch.h"

#include <algorithm>
#include <brotli/decode.h>
#include <memory>

namespace loader {
namespace {
    constexpr size_t kMaxPatchedBundleBytes = 64 * 1024 * 1024;
    constexpr size_t kChunkBytes            = 256 * 1024;

    struct DecoderDeleter {
        void operator()(BrotliDecoderState *state) const
        {
            BrotliDecoderDestroyInstance(state);
        }
    };
}

std::string bundlePatchPath(const std::string &file, const std::string &baseSha512)
{
    return "patches/" + file + "/" + baseSha512.substr(0, kBundlePatchNameLength) + ".br";
}

std::optional<std::string> applyBundlePatch(const std::string &base, const std::string &patch)
{
    std::unique_ptr<BrotliDecoderState, DecoderDeleter> decoder(
        BrotliDecoderCreateInstance(nullptr, nullptr, nullptr));
    if (!decoder ||
        !BrotliDecoderAttachDictionary(decoder.get(), BROTLI_SHARED_DICTIONARY_RAW, base.size(),
                                       reinterpret_cast<const uint8_t *>(base.data())))
    {
        return std::nullopt;
    }

    std::string    output;
    const uint8_t *next      = reinterpret_cast<const uint8_t *>(patch.data());
    size_t         available = patch.size();
    std::string    chunk(kChunkBytes, '\0');
    while (true)
    {
        uint8_t            *out     = reinterpret_cast<uint8_t *>(chunk.data());
        size_t              outFree = chunk.size();
        BrotliDecoderResult result = BrotliDecoderDecompressStream(decoder.get(), &available, &next,
                                                                   &outFree, &out, nullptr);
        output.append(chunk.data(), chunk.size() - outFree);
        if (output.size() > kMaxPatchedBundleBytes)
        {
            return std::nullopt;
        }
        if (result == BROTLI_DECODER_RESULT_SUCCESS)
        {
            return available == 0 ? std::optional<std::string>(output) : std::nullopt;
        }
        if (result != BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT)
        {
            return std::nullopt;
        }
    }
}

std::optional<std::string> patchBaseFor(const std::vector<std::string> &bases,
                                        const std::string              &activeSha512)
{
    return std::find(bases.begin(), bases.end(), activeSha512) != bases.end()
               ? std::optional<std::string>(activeSha512)
               : std::nullopt;
}
}
