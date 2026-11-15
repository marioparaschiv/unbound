#include "NativeFFIClosureProbe.h"

#include <ffi.h>
#include <mutex>

#include "NativeAddressValidation.h"

namespace loader::ffi {
namespace {
    constexpr ffi_sarg kProbeAnswer = 0x5eed;

    void answerProbe(ffi_cif *, void *result, void **, void *)
    {
        *static_cast<ffi_sarg *>(result) = kProbeAnswer;
    }

    std::string probeOutcome(ffi_cif &cif, ffi_closure *closure, void *code)
    {
        if (!closure || !code)
        {
            return "alloc";
        }

        if (!isExecutableAddress(code))
        {
            return "not-executable";
        }

        if (ffi_prep_closure_loc(closure, &cif, answerProbe, nullptr, code) != FFI_OK)
        {
            return "prep";
        }

        return reinterpret_cast<int (*)()>(code)() == kProbeAnswer ? "ok" : "wrong-answer";
    }

    std::string runProbe()
    {
        ffi_cif cif{};
        if (ffi_prep_cif(&cif, FFI_DEFAULT_ABI, 0, &ffi_type_sint32, nullptr) != FFI_OK)
        {
            return "cif";
        }

        void *code    = nullptr;
        auto *closure = static_cast<ffi_closure *>(ffi_closure_alloc(sizeof(ffi_closure), &code));
        std::string result = probeOutcome(cif, closure, code);
        if (closure)
        {
            ffi_closure_free(closure);
        }

        return result;
    }
}

const std::string &closureProbe()
{
    static std::once_flag probed;
    static std::string outcome;
    std::call_once(probed, [] {
        outcome = runProbe();
    });
    return outcome;
}

bool closuresExecutable()
{
    return closureProbe() == "ok";
}
}
