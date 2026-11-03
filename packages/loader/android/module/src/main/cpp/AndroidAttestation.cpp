#include "AndroidAttestation.h"

#include <dlfcn.h>
#include <elf.h>
#include <fcntl.h>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <string_view>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

#include "JniEnvironment.h"
#include "LoaderAttestation.h"
#include "LoaderCrypto.h"
#include "LoaderDiagnostics.h"

namespace attestation = loader::attestation;

extern "C" __attribute__((section(".unbound.attestation"), used, retain, visibility("hidden")))
const unsigned char UnboundAttestationPlaceholder[attestation::kSectionSize] = {0};

#if defined(__aarch64__)
static constexpr int32_t kLoadedMachine = EM_AARCH64;
#else
static constexpr int32_t kLoadedMachine = EM_X86_64;
#endif

class MappedFile
{
public:
    explicit MappedFile(const char *path)
    {
        const int descriptor = open(path, O_RDONLY | O_CLOEXEC);
        if (descriptor < 0)
        {
            return;
        }
        struct stat status{};
        if (fstat(descriptor, &status) == 0 && status.st_size > 0)
        {
            void *mapped = mmap(nullptr, static_cast<size_t>(status.st_size), PROT_READ,
                                MAP_PRIVATE, descriptor, 0);
            if (mapped != MAP_FAILED)
            {
                data_ = mapped;
                size_ = static_cast<size_t>(status.st_size);
            }
        }
        close(descriptor);
    }

    MappedFile(const MappedFile &)            = delete;
    MappedFile &operator=(const MappedFile &) = delete;

    ~MappedFile()
    {
        if (data_)
        {
            munmap(data_, size_);
        }
    }

    std::optional<std::string_view> contents() const
    {
        if (!data_)
        {
            return std::nullopt;
        }
        return std::string_view(static_cast<const char *>(data_), size_);
    }

private:
    void  *data_ = nullptr;
    size_t size_ = 0;
};

static std::optional<std::string> loadedLibraryPath()
{
    Dl_info info{};
    if (!dladdr(reinterpret_cast<const void *>(&nativeAttestation), &info) || !info.dli_fname)
    {
        return std::nullopt;
    }
    return std::string(info.dli_fname);
}

static nlohmann::json evaluation()
{
    const std::optional<std::string> path = loadedLibraryPath();
    if (!path)
    {
        return {{"failure", "unable to read the loaded library"}};
    }
    const MappedFile                      file(path->c_str());
    const std::optional<std::string_view> library = file.contents();
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
    return unbound::android::toJavaString(env, result.dump());
}
