#include "NativeFFIExtras.h"

#include <algorithm>
#include <array>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <utility>

#include "NativeAddressValidation.h"
#include "NativeFFI.h"
#include "NativePluginRuntime.h"

#if defined(__APPLE__)
#include <mach-o/dyld.h>
#include <mach-o/loader.h>
#include <mach-o/nlist.h>
#include <mach/mach.h>
#elif defined(__ANDROID__) || defined(__linux__)
#include <elf.h>
#include <link.h>
#include <sys/mman.h>
#include <unistd.h>
#endif
#include <dlfcn.h>

namespace jsi = facebook::jsi;

namespace loader::ffi {
namespace {
    struct IntegerReturn {
        std::uint64_t first;
        std::uint64_t second;
    };

#if defined(__x86_64__)
    using FloatReturn = double;
#else
    struct FloatReturn {
        double values[4];
    };
#endif

    struct SlotState {
        CallbackHandler handler;
        bool            floatReturn = false;
        bool            used        = false;
    };

    std::mutex                                gSlotsMutex;
    std::array<SlotState, kCallbackSlots * 2> gSlots;

    CallbackResult runSlot(std::size_t slot, const CallbackRegisters &registers)
    {
        CallbackHandler handler;
        {
            std::lock_guard<std::mutex> lock(gSlotsMutex);
            if (!gSlots[slot].used)
            {
                return {};
            }
            handler = gSlots[slot].handler;
        }
        return handler ? handler(registers) : CallbackResult{};
    }

    template <std::size_t Slot>
    IntegerReturn integerSlot(std::uint64_t x0, std::uint64_t x1, std::uint64_t x2,
                              std::uint64_t x3, std::uint64_t x4, std::uint64_t x5,
                              std::uint64_t x6, std::uint64_t x7, double d0, double d1, double d2,
                              double d3, double d4, double d5, double d6, double d7)
    {
        CallbackResult result =
            runSlot(Slot, {{x0, x1, x2, x3, x4, x5, x6, x7}, {d0, d1, d2, d3, d4, d5, d6, d7}});
        return {result.x[0], result.x[1]};
    }

    template <std::size_t Slot>
    FloatReturn floatSlot(std::uint64_t x0, std::uint64_t x1, std::uint64_t x2, std::uint64_t x3,
                          std::uint64_t x4, std::uint64_t x5, std::uint64_t x6, std::uint64_t x7,
                          double d0, double d1, double d2, double d3, double d4, double d5,
                          double d6, double d7)
    {
        CallbackResult result = runSlot(kCallbackSlots + Slot, {{x0, x1, x2, x3, x4, x5, x6, x7},
                                                                {d0, d1, d2, d3, d4, d5, d6, d7}});
#if defined(__x86_64__)
        return result.d[0];
#else
        return {{result.d[0], result.d[1], result.d[2], result.d[3]}};
#endif
    }

    template <std::size_t... Slots>
    constexpr std::array<void *, sizeof...(Slots)> integerTable(std::index_sequence<Slots...>)
    {
        return {reinterpret_cast<void *>(&integerSlot<Slots>)...};
    }

    template <std::size_t... Slots>
    constexpr std::array<void *, sizeof...(Slots)> floatTable(std::index_sequence<Slots...>)
    {
        return {reinterpret_cast<void *>(&floatSlot<Slots>)...};
    }

    const std::array<void *, kCallbackSlots> &integerSlots()
    {
        static const auto table = integerTable(std::make_index_sequence<kCallbackSlots>());
        return table;
    }

    const std::array<void *, kCallbackSlots> &floatSlots()
    {
        static const auto table = floatTable(std::make_index_sequence<kCallbackSlots>());
        return table;
    }

    std::mutex                            gMemoryMutex;
    std::map<std::uintptr_t, std::size_t> gAllocations;

    std::mutex                                    gRebindMutex;
    std::map<std::string, std::vector<Rebinding>> gRebindings;
}

std::optional<void *> acquireCallbackSlot(CallbackHandler handler, bool floatReturn)
{
    std::lock_guard<std::mutex> lock(gSlotsMutex);
    std::size_t                 base = floatReturn ? kCallbackSlots : 0;
    for (std::size_t index = 0; index < kCallbackSlots; index++)
    {
        SlotState &state = gSlots[base + index];
        if (!state.used)
        {
            state = {std::move(handler), floatReturn, true};
            return floatReturn ? floatSlots()[index] : integerSlots()[index];
        }
    }
    return std::nullopt;
}

bool releaseCallbackSlot(void *code)
{
    std::lock_guard<std::mutex> lock(gSlotsMutex);
    for (std::size_t index = 0; index < kCallbackSlots; index++)
    {
        for (bool floating : {false, true})
        {
            void *candidate = floating ? floatSlots()[index] : integerSlots()[index];
            if (candidate == code)
            {
                SlotState &state = gSlots[(floating ? kCallbackSlots : 0) + index];
                bool       used  = state.used;
                state            = {};
                return used;
            }
        }
    }
    return false;
}

std::size_t liveCallbackSlots()
{
    std::lock_guard<std::mutex> lock(gSlotsMutex);
    return static_cast<std::size_t>(
        std::count_if(gSlots.begin(), gSlots.end(), [](const SlotState &slot) {
            return slot.used;
        }));
}

void *allocateMemory(std::size_t size)
{
    if (size == 0 || size > 16 * 1024 * 1024)
    {
        return nullptr;
    }
    void *memory = std::calloc(1, size);
    if (memory)
    {
        std::lock_guard<std::mutex> lock(gMemoryMutex);
        gAllocations[reinterpret_cast<std::uintptr_t>(memory)] = size;
    }
    return memory;
}

bool freeMemory(void *pointer)
{
    std::lock_guard<std::mutex> lock(gMemoryMutex);
    auto found = gAllocations.find(reinterpret_cast<std::uintptr_t>(pointer));
    if (found == gAllocations.end())
    {
        return false;
    }
    gAllocations.erase(found);
    std::free(pointer);
    return true;
}

bool isAllocatedRange(const void *pointer, std::size_t size)
{
    auto                        address = reinterpret_cast<std::uintptr_t>(pointer);
    std::lock_guard<std::mutex> lock(gMemoryMutex);
    auto                        found = gAllocations.upper_bound(address);
    if (found == gAllocations.begin())
    {
        return false;
    }
    --found;
    return address >= found->first && address + size <= found->first + found->second &&
           address + size >= address;
}

#if defined(__APPLE__)
namespace {
    bool writePointer(void **slot, void *value)
    {
        vm_address_t page =
            reinterpret_cast<vm_address_t>(slot) & ~static_cast<vm_address_t>(vm_page_size - 1);
        if (vm_protect(mach_task_self(), page, vm_page_size, false,
                       VM_PROT_READ | VM_PROT_WRITE | VM_PROT_COPY) != KERN_SUCCESS)
        {
            return false;
        }
        *slot = value;
        return true;
    }

    void rebindImage(const mach_header_64 *header, intptr_t slide, const std::string &symbol,
                     void *replacement, std::vector<Rebinding> &done)
    {
        const symtab_command           *symtab   = nullptr;
        const dysymtab_command         *dysymtab = nullptr;
        const segment_command_64       *linkedit = nullptr;
        std::vector<const section_64 *> sections;
        auto *command = reinterpret_cast<const load_command *>(header + 1);
        for (uint32_t index = 0; index < header->ncmds; index++)
        {
            if (command->cmd == LC_SYMTAB)
            {
                symtab = reinterpret_cast<const symtab_command *>(command);
            }
            else if (command->cmd == LC_DYSYMTAB)
            {
                dysymtab = reinterpret_cast<const dysymtab_command *>(command);
            }
            else if (command->cmd == LC_SEGMENT_64)
            {
                auto *segment = reinterpret_cast<const segment_command_64 *>(command);
                if (std::strcmp(segment->segname, SEG_LINKEDIT) == 0)
                {
                    linkedit = segment;
                }
                else if (std::strncmp(segment->segname, "__DATA", 6) == 0)
                {
                    auto *section = reinterpret_cast<const section_64 *>(segment + 1);
                    for (uint32_t item = 0; item < segment->nsects; item++)
                    {
                        uint32_t type = section[item].flags & SECTION_TYPE;
                        if (type == S_LAZY_SYMBOL_POINTERS || type == S_NON_LAZY_SYMBOL_POINTERS)
                        {
                            sections.push_back(&section[item]);
                        }
                    }
                }
            }
            command = reinterpret_cast<const load_command *>(
                reinterpret_cast<const uint8_t *>(command) + command->cmdsize);
        }
        if (!symtab || !dysymtab || !linkedit || !dysymtab->nindirectsyms)
        {
            return;
        }
        uintptr_t   base     = static_cast<uintptr_t>(slide) + linkedit->vmaddr - linkedit->fileoff;
        auto       *symbols  = reinterpret_cast<const nlist_64 *>(base + symtab->symoff);
        auto       *strings  = reinterpret_cast<const char *>(base + symtab->stroff);
        auto       *indirect = reinterpret_cast<const uint32_t *>(base + dysymtab->indirectsymoff);
        std::string wanted   = "_" + symbol;
        for (const section_64 *section : sections)
        {
            auto **slots = reinterpret_cast<void **>(static_cast<uintptr_t>(slide) + section->addr);
            for (uint64_t item = 0; item < section->size / sizeof(void *); item++)
            {
                uint32_t symbolIndex = indirect[section->reserved1 + item];
                if (symbolIndex == INDIRECT_SYMBOL_ABS || symbolIndex == INDIRECT_SYMBOL_LOCAL ||
                    symbolIndex == (INDIRECT_SYMBOL_LOCAL | INDIRECT_SYMBOL_ABS) ||
                    symbolIndex >= symtab->nsyms)
                {
                    continue;
                }
                const char *name = strings + symbols[symbolIndex].n_un.n_strx;
                if (wanted != name)
                {
                    continue;
                }
                void *original = slots[item];
                if (original != replacement && writePointer(&slots[item], replacement))
                {
                    done.push_back({&slots[item], original});
                }
            }
        }
    }
}

std::vector<Rebinding> rebindImportedSymbol(const std::string &name, void *replacement,
                                            const void *skipImageContaining)
{
    std::vector<Rebinding> done;
    Dl_info                skip{};
    bool skipping = skipImageContaining && dladdr(skipImageContaining, &skip) && skip.dli_fbase;
    for (uint32_t index = 0; index < _dyld_image_count(); index++)
    {
        auto *header = reinterpret_cast<const mach_header_64 *>(_dyld_get_image_header(index));
        if (!header || header->magic != MH_MAGIC_64 || (skipping && header == skip.dli_fbase))
        {
            continue;
        }
        rebindImage(header, _dyld_get_image_vmaddr_slide(index), name, replacement, done);
    }
    return done;
}

bool restoreRebindings(const std::vector<Rebinding> &rebindings)
{
    bool restored = true;
    for (const Rebinding &rebinding : rebindings)
    {
        restored =
            writePointer(static_cast<void **>(rebinding.slot), rebinding.original) && restored;
    }
    return restored;
}
#elif defined(__ANDROID__) || defined(__linux__)
namespace {
    bool writePointer(void **slot, void *value)
    {
        long      size = sysconf(_SC_PAGESIZE);
        uintptr_t page = reinterpret_cast<uintptr_t>(slot) & ~static_cast<uintptr_t>(size - 1);
        if (mprotect(reinterpret_cast<void *>(page), static_cast<size_t>(size),
                     PROT_READ | PROT_WRITE) != 0)
        {
            return false;
        }
        *slot = value;
        return true;
    }

    struct RebindRequest {
        std::string             name;
        void                   *replacement;
        const void             *skip;
        std::vector<Rebinding> *done;
    };

    bool isPointerRelocation(uint32_t type)
    {
#if defined(__aarch64__)
        return type == R_AARCH64_JUMP_SLOT || type == R_AARCH64_GLOB_DAT || type == R_AARCH64_ABS64;
#elif defined(__x86_64__)
        return type == R_X86_64_JUMP_SLOT || type == R_X86_64_GLOB_DAT;
#else
        return false;
#endif
    }

    void rebindRelocations(ElfW(Addr) base, const ElfW(Rela) * relocations, size_t count,
                           const ElfW(Sym) * symbols, const char *strings,
                           const RebindRequest &request)
    {
        for (size_t index = 0; relocations && index < count; index++)
        {
            const ElfW(Rela) &relocation = relocations[index];
            if (!isPointerRelocation(ELF64_R_TYPE(relocation.r_info)))
            {
                continue;
            }
            const ElfW(Sym) &symbol = symbols[ELF64_R_SYM(relocation.r_info)];
            if (request.name != strings + symbol.st_name)
            {
                continue;
            }
            auto **slot     = reinterpret_cast<void **>(base + relocation.r_offset);
            void  *original = *slot;
            if (original != request.replacement && writePointer(slot, request.replacement))
            {
                request.done->push_back({slot, original});
            }
        }
    }

    int rebindObject(dl_phdr_info *info, size_t, void *data)
    {
        auto &request = *static_cast<RebindRequest *>(data);
        if (request.skip)
        {
            for (int index = 0; index < info->dlpi_phnum; index++)
            {
                const ElfW(Phdr) &header = info->dlpi_phdr[index];
                uintptr_t start          = info->dlpi_addr + header.p_vaddr;
                uintptr_t skip           = reinterpret_cast<uintptr_t>(request.skip);
                if (header.p_type == PT_LOAD && skip >= start && skip < start + header.p_memsz)
                {
                    return 0;
                }
            }
        }
        const ElfW(Dyn) *dynamic = nullptr;
        for (int index = 0; index < info->dlpi_phnum; index++)
        {
            if (info->dlpi_phdr[index].p_type == PT_DYNAMIC)
            {
                dynamic = reinterpret_cast<const ElfW(Dyn) *>(info->dlpi_addr +
                                                              info->dlpi_phdr[index].p_vaddr);
            }
        }
        if (!dynamic || (info->dlpi_name && std::strstr(info->dlpi_name, "vdso") != nullptr))
        {
            return 0;
        }
        const ElfW(Sym) *symbols = nullptr;
        const char *strings      = nullptr;
        const ElfW(Rela) *plt = nullptr, *rela = nullptr;
        size_t pltSize = 0, relaSize = 0;
        auto   located = [&](ElfW(Addr) address) {
            return address < info->dlpi_addr ? address + info->dlpi_addr : address;
        };
        for (const ElfW(Dyn) *entry = dynamic; entry->d_tag != DT_NULL; entry++)
        {
            switch (entry->d_tag)
            {
                case DT_SYMTAB:
                    symbols = reinterpret_cast<const ElfW(Sym) *>(located(entry->d_un.d_ptr));
                    break;
                case DT_STRTAB:
                    strings = reinterpret_cast<const char *>(located(entry->d_un.d_ptr));
                    break;
                case DT_JMPREL:
                    plt = reinterpret_cast<const ElfW(Rela) *>(located(entry->d_un.d_ptr));
                    break;
                case DT_PLTRELSZ:
                    pltSize = entry->d_un.d_val;
                    break;
                case DT_RELA:
                    rela = reinterpret_cast<const ElfW(Rela) *>(located(entry->d_un.d_ptr));
                    break;
                case DT_RELASZ:
                    relaSize = entry->d_un.d_val;
                    break;
                default:
                    break;
            }
        }
        if (!symbols || !strings)
        {
            return 0;
        }
        rebindRelocations(info->dlpi_addr, plt, pltSize / sizeof(ElfW(Rela)), symbols, strings,
                          request);
        rebindRelocations(info->dlpi_addr, rela, relaSize / sizeof(ElfW(Rela)), symbols, strings,
                          request);
        return 0;
    }
}

std::vector<Rebinding> rebindImportedSymbol(const std::string &name, void *replacement,
                                            const void *skipImageContaining)
{
    std::vector<Rebinding> done;
    RebindRequest          request{name, replacement, skipImageContaining, &done};
    dl_iterate_phdr(rebindObject, &request);
    return done;
}

bool restoreRebindings(const std::vector<Rebinding> &rebindings)
{
    bool restored = true;
    for (const Rebinding &rebinding : rebindings)
    {
        restored =
            writePointer(static_cast<void **>(rebinding.slot), rebinding.original) && restored;
    }
    return restored;
}
#else
std::vector<Rebinding> rebindImportedSymbol(const std::string &, void *, const void *)
{
    return {};
}

bool restoreRebindings(const std::vector<Rebinding> &)
{
    return false;
}
#endif

namespace {
    enum class Passing
    {
        Integer,
        Float,
        Double,
        FloatAggregate,
        IntegerAggregate,
        Indirect,
    };

    struct Slot {
        Passing     passing;
        std::size_t count = 1;
        std::size_t size  = 0;
    };

    void flatten(const StructLayout &layout, std::vector<Kind> &leaves)
    {
        for (const StructField &field : layout.fields)
        {
            if (field.type.kind == Kind::Struct && field.type.layout)
            {
                flatten(*field.type.layout, leaves);
            }
            else
            {
                leaves.push_back(field.type.kind);
            }
        }
    }

    Slot slotFor(const Type &type)
    {
        if (type.kind == Kind::Float)
        {
            return {Passing::Float, 1, sizeof(float)};
        }
        if (type.kind == Kind::Double)
        {
            return {Passing::Double, 1, sizeof(double)};
        }
        if (type.kind == Kind::Struct && type.layout)
        {
            std::vector<Kind> leaves;
            flatten(*type.layout, leaves);
            bool aggregate = !leaves.empty() && leaves.size() <= 4 &&
                             (leaves.front() == Kind::Float || leaves.front() == Kind::Double) &&
                             std::all_of(leaves.begin(), leaves.end(), [&](Kind leaf) {
                                 return leaf == leaves.front();
                             });
            if (aggregate)
            {
                return {Passing::FloatAggregate, leaves.size(), type.layout->size};
            }
            if (type.layout->size <= 16)
            {
                return {Passing::IntegerAggregate, (type.layout->size + 7) / 8, type.layout->size};
            }
            return {Passing::Indirect, 1, type.layout->size};
        }
        return {Passing::Integer, 1, typeSize(type)};
    }

    bool floating(const Slot &slot)
    {
        return slot.passing == Passing::Float || slot.passing == Passing::Double ||
               slot.passing == Passing::FloatAggregate;
    }

    std::vector<std::uint8_t> argumentBytes(const Slot &slot, const CallbackRegisters &registers,
                                            std::size_t &x, std::size_t &d)
    {
        std::vector<std::uint8_t> buffer(std::max<std::size_t>(slot.size, 8));
        switch (slot.passing)
        {
            case Passing::Integer:
                std::memcpy(buffer.data(), &registers.x[x++], 8);
                break;
            case Passing::Float: {
                float value = 0;
                std::memcpy(&value, &registers.d[d++], sizeof(float));
                std::memcpy(buffer.data(), &value, sizeof(float));
                break;
            }
            case Passing::Double:
                std::memcpy(buffer.data(), &registers.d[d++], sizeof(double));
                break;
            case Passing::FloatAggregate: {
                std::size_t element = slot.size / slot.count;
                for (std::size_t index = 0; index < slot.count; index++)
                {
                    std::memcpy(buffer.data() + index * element, &registers.d[d++], element);
                }
                break;
            }
            case Passing::IntegerAggregate:
                std::memcpy(buffer.data(), &registers.x[x], slot.size);
                x += slot.count;
                break;
            case Passing::Indirect: {
                auto *source = reinterpret_cast<const void *>(registers.x[x++]);
                if (source)
                {
                    std::memcpy(buffer.data(), source, slot.size);
                }
                break;
            }
        }
        return buffer;
    }

    CallbackResult resultFrom(const Slot &slot, const std::vector<std::uint8_t> &bytes)
    {
        CallbackResult result{};
        if (slot.passing == Passing::FloatAggregate)
        {
            std::size_t element = slot.size / slot.count;
            for (std::size_t index = 0; index < slot.count; index++)
            {
                std::memcpy(&result.d[index], bytes.data() + index * element, element);
            }
        }
        else if (floating(slot))
        {
            std::memcpy(&result.d[0], bytes.data(),
                        slot.passing == Passing::Float ? sizeof(float) : sizeof(double));
        }
        else
        {
            std::memcpy(result.x, bytes.data(), std::min<std::size_t>(bytes.size(), 16));
        }
        return result;
    }

    struct JSCallback {
        Signature                      signature;
        std::vector<Slot>              slots;
        Slot                           result{Passing::Integer};
        std::shared_ptr<jsi::Function> function;
        std::uint64_t                  generation = 0;
    };

    CallbackResult runJavaScript(const std::shared_ptr<JSCallback> &callback,
                                 const CallbackRegisters           &registers)
    {
        std::vector<std::uint8_t> output(std::max<std::size_t>(callback->result.size, 32));
        if (callback->generation != native::runtimeGeneration())
        {
            return resultFrom(callback->result, output);
        }
        std::size_t                            x = 0;
        std::size_t                            d = 0;
        std::vector<std::vector<std::uint8_t>> arguments;
        for (const Slot &slot : callback->slots)
        {
            arguments.push_back(argumentBytes(slot, registers, x, d));
        }
        native::executeRuntimeSynchronously([&](jsi::Runtime &runtime) {
            if (callback->generation != native::runtimeGeneration())
            {
                return;
            }
            std::vector<jsi::Value> values;
            for (std::size_t index = 0; index < arguments.size(); index++)
            {
                values.push_back(readValue(runtime, callback->signature.arguments[index],
                                           arguments[index].data()));
            }
            jsi::Value returned = callback->function->call(
                runtime, static_cast<const jsi::Value *>(values.data()), values.size());
            if (callback->signature.result.kind != Kind::Void)
            {
                ArgumentStorage storage;
                writeValue(runtime, returned, callback->signature.result, output.data(), storage);
            }
        });
        return resultFrom(callback->result, output);
    }

    void *pointerArgument(jsi::Runtime &runtime, const jsi::Value &value, const char *method)
    {
        std::shared_ptr<PointerHost> host = pointerHost(runtime, value);
        if (!host || !host->value())
        {
            throw std::invalid_argument(std::string(method) + " expects a pointer");
        }
        return host->value();
    }

    std::size_t offsetArgument(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count,
                               std::size_t index)
    {
        if (index >= count || args[index].isUndefined())
        {
            return 0;
        }
        if (!args[index].isNumber() || args[index].getNumber() < 0)
        {
            throw std::invalid_argument("The memory offset must be a non-negative number");
        }
        return static_cast<std::size_t>(args[index].getNumber());
    }

    Type typeArgument(jsi::Runtime &runtime, const jsi::Value &value)
    {
        jsi::Object signature(runtime);
        signature.setProperty(runtime, "returnType", jsi::Value(runtime, value));
        signature.setProperty(runtime, "args", jsi::Array(runtime, 0));
        return signatureFromValue(runtime, jsi::Value(runtime, signature)).result;
    }
}

jsi::Value allocate(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 1 || !args[0].isNumber() || args[0].getNumber() <= 0)
    {
        throw std::invalid_argument("ffi.alloc expects a size in bytes");
    }
    void *memory = allocateMemory(static_cast<std::size_t>(args[0].getNumber()));
    if (!memory)
    {
        throw std::invalid_argument("ffi.alloc could not allocate that size");
    }
    return pointerValue(runtime, memory);
}

jsi::Value release(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 1)
    {
        throw std::invalid_argument("ffi.free expects a pointer from ffi.alloc");
    }
    return jsi::Value(freeMemory(pointerArgument(runtime, args[0], "ffi.free")));
}

jsi::Value read(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 2)
    {
        throw std::invalid_argument("ffi.read expects a pointer and a type");
    }
    auto       *base   = static_cast<std::uint8_t *>(pointerArgument(runtime, args[0], "ffi.read"));
    Type        type   = typeArgument(runtime, args[1]);
    std::size_t size   = typeSize(type);
    std::size_t offset = offsetArgument(runtime, args, count, 2);
    if (size == 0)
    {
        throw std::invalid_argument("ffi.read cannot read a void");
    }
    std::vector<std::uint8_t> buffer(std::max<std::size_t>(size, 8));
    if (!readMemorySafely(base + offset, buffer.data(), size))
    {
        throw std::invalid_argument("ffi.read could not read that address");
    }
    return readValue(runtime, type, buffer.data());
}

jsi::Value write(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 3)
    {
        throw std::invalid_argument("ffi.write expects a pointer, a type and a value");
    }
    auto       *base = static_cast<std::uint8_t *>(pointerArgument(runtime, args[0], "ffi.write"));
    Type        type = typeArgument(runtime, args[1]);
    std::size_t size = typeSize(type);
    std::size_t offset = offsetArgument(runtime, args, count, 3);
    if (size == 0 || !isAllocatedRange(base + offset, size))
    {
        throw std::invalid_argument("ffi.write only writes inside memory from ffi.alloc");
    }
    std::vector<std::uint8_t> buffer(std::max<std::size_t>(size, 8));
    ArgumentStorage           storage;
    writeValue(runtime, args[2], type, buffer.data(), storage);
    if (type.kind == Kind::CString)
    {
        throw std::invalid_argument("ffi.write cannot store a string; allocate its bytes instead");
    }
    std::memcpy(base + offset, buffer.data(), size);
    return jsi::Value::undefined();
}

jsi::Value callback(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 2 || !args[1].isObject() || !args[1].asObject(runtime).isFunction(runtime))
    {
        throw std::invalid_argument("ffi.callback expects a signature and a function");
    }
    auto state           = std::make_shared<JSCallback>();
    state->signature     = signatureFromValue(runtime, args[0]);
    std::size_t integers = 0;
    std::size_t floats   = 0;
    for (const Type &type : state->signature.arguments)
    {
        Slot slot = slotFor(type);
        (floating(slot) ? floats : integers) += slot.count;
        state->slots.push_back(slot);
    }
#if defined(__x86_64__)
    constexpr std::size_t kIntegerRegisters = 6;
#else
    constexpr std::size_t kIntegerRegisters = 8;
#endif
    if (integers > kIntegerRegisters || floats > 8)
    {
        throw std::invalid_argument("ffi.callback has more arguments than fit in registers");
    }
    state->result    = slotFor(state->signature.result);
    bool floatReturn = floating(state->result);
#if defined(__x86_64__)
    if (state->result.passing == Passing::FloatAggregate)
    {
        throw std::invalid_argument("ffi.callback cannot return a float struct on x86_64");
    }
#endif
    if (state->result.passing == Passing::Indirect)
    {
        throw std::invalid_argument("ffi.callback cannot return a struct larger than 16 bytes");
    }
    state->function =
        std::make_shared<jsi::Function>(args[1].asObject(runtime).asFunction(runtime));
    state->generation          = native::runtimeGeneration();
    std::optional<void *> code = acquireCallbackSlot(
        [state](const CallbackRegisters &registers) {
            return runJavaScript(state, registers);
        },
        floatReturn);
    if (!code)
    {
        throw std::invalid_argument("ffi.callback has no free slots; release callbacks first");
    }
    return pointerValue(runtime, *code, true);
}

jsi::Value releaseCallback(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 1)
    {
        throw std::invalid_argument("ffi.releaseCallback expects a pointer from ffi.callback");
    }
    return jsi::Value(
        releaseCallbackSlot(pointerArgument(runtime, args[0], "ffi.releaseCallback")));
}

jsi::Value rebind(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 2 || !args[0].isString())
    {
        throw std::invalid_argument("ffi.rebind expects a symbol name and a replacement pointer");
    }
    std::string name        = args[0].getString(runtime).utf8(runtime);
    void       *replacement = pointerArgument(runtime, args[1], "ffi.rebind");
    void       *original    = dlsym(RTLD_DEFAULT, name.c_str());
    if (!original)
    {
        throw std::invalid_argument("ffi.rebind found no symbol named " + name);
    }
    std::vector<Rebinding> done = rebindImportedSymbol(
        name, replacement, reinterpret_cast<const void *>(&rebindImportedSymbol));
    {
        std::lock_guard<std::mutex> lock(gRebindMutex);
        std::vector<Rebinding>     &recorded = gRebindings[name];
        recorded.insert(recorded.end(), done.begin(), done.end());
    }
    jsi::Object result(runtime);
    result.setProperty(runtime, "original", pointerValue(runtime, original, true));
    result.setProperty(runtime, "slots", static_cast<double>(done.size()));
    return result;
}

jsi::Value restore(jsi::Runtime &runtime, const jsi::Value *args, std::size_t count)
{
    if (count < 1 || !args[0].isString())
    {
        throw std::invalid_argument("ffi.restore expects a symbol name");
    }
    std::vector<Rebinding> done;
    {
        std::lock_guard<std::mutex> lock(gRebindMutex);
        auto found = gRebindings.find(args[0].getString(runtime).utf8(runtime));
        if (found == gRebindings.end())
        {
            return jsi::Value(false);
        }
        done = std::move(found->second);
        gRebindings.erase(found);
    }
    std::reverse(done.begin(), done.end());
    return jsi::Value(restoreRebindings(done));
}
}
