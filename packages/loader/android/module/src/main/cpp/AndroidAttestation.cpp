#include "AndroidAttestation.h"

#include <dlfcn.h>
#include <elf.h>
#include <fstream>
#include <iterator>
#include <nlohmann/json.hpp>
#include <string>

#include "JniEnvironment.h"
#include "LoaderAttestation.h"
#include "LoaderCrypto.h"
#include "LoaderDiagnostics.h"

namespace attestation = loader::attestation;

extern "C" __attribute__((section(".astral.attestation"), used, retain, visibility("hidden")))
const unsigned char AstralAttestationPlaceholder[attestation::kSectionSize] = {0};

#if defined(__aarch64__)
static constexpr int32_t kLoadedMachine = EM_AARCH64;
#else
static constexpr int32_t kLoadedMachine = EM_X86_64;
#endif

static std::optional<std::string> loadedLibrary()
{
    Dl_info info{};
    if (!dladdr(reinterpret_cast<const void *>(&nativeAttestation), &info) || !info.dli_fname)
    {
        return std::nullopt;
    }
    std::ifstream file(info.dli_fname, std::ios::binary);
    if (!file)
    {
        return std::nullopt;
    }
    return std::string(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
}

static nlohmann::json evaluation()
{
    const std::optional<std::string> library = loadedLibrary();
    if (!library)
    {
        return {{"failure", "unable to read the loaded library"}};
    }
    const attestation::Evaluation result = attestation::evaluate(*library, kLoadedMachine, 0);
    if (result.failure)
    {
        return {{"failure", *result.failure}};
    }
    const std::optional<std::string> point = attestation::publicKeyPoint();
    if (!point)
    {
        return {{"failure", "unable to read the pinned P-256 public key"}};
    }
    return {
        {"digest", loader::crypto::hex(result.digest)},
        {"signature", loader::crypto::hex(result.record.signature)},
        {"publicKey", loader::crypto::hex(*point)},
        {"commitHash", result.record.commitHash},
    };
}

jstring nativeAttestation(JNIEnv *env, jclass)
{
    nlohmann::json result    = evaluation();
    result["warningTitle"]   = loader::diagnostics::kAttestationWarningTitle;
    result["warningMessage"] = loader::diagnostics::kAttestationWarningMessage;
    return astral::android::toJavaString(env, result.dump());
}
