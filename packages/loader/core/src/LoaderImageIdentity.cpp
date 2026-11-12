#include "LoaderImageIdentity.h"

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <dlfcn.h>

#if defined(__APPLE__)
#include <mach-o/loader.h>
#else
#include <elf.h>
#include <link.h>
#endif

namespace loader {
static std::string hexBytes(const uint8_t *bytes, size_t length)
{
    std::string text;
    char        digits[3];
    for (size_t index = 0; index < length; index++)
    {
        std::snprintf(digits, sizeof(digits), "%02x", bytes[index]);
        text += digits;
    }
    return text;
}

#if defined(__APPLE__)
static std::string machOUUID(const void *base)
{
    const auto *header = static_cast<const mach_header_64 *>(base);
    if (!header || header->magic != MH_MAGIC_64)
    {
        return "";
    }
    const auto *command = reinterpret_cast<const load_command *>(header + 1);
    for (uint32_t index = 0; index < header->ncmds; index++)
    {
        if (command->cmd == LC_UUID)
        {
            const auto *uuid = reinterpret_cast<const uuid_command *>(command);
            std::string hex  = hexBytes(uuid->uuid, sizeof(uuid->uuid));
            for (char &character : hex)
            {
                character = static_cast<char>(std::toupper(static_cast<unsigned char>(character)));
            }
            return hex.substr(0, 8) + "-" + hex.substr(8, 4) + "-" + hex.substr(12, 4) + "-" +
                   hex.substr(16, 4) + "-" + hex.substr(20);
        }
        command = reinterpret_cast<const load_command *>(
            reinterpret_cast<const uint8_t *>(command) + command->cmdsize);
    }
    return "";
}
#else
struct BuildIDSearch {
    uintptr_t   base = 0;
    std::string id;
};

static int findBuildID(dl_phdr_info *info, size_t, void *data)
{
    auto *search = static_cast<BuildIDSearch *>(data);
    if (info->dlpi_addr != search->base)
    {
        return 0;
    }
    for (int index = 0; index < info->dlpi_phnum; index++)
    {
        const ElfW(Phdr) &header = info->dlpi_phdr[index];
        if (header.p_type != PT_NOTE)
        {
            continue;
        }
        const auto *cursor = reinterpret_cast<const uint8_t *>(info->dlpi_addr + header.p_vaddr);
        const auto *end    = cursor + header.p_memsz;
        while (cursor + sizeof(ElfW(Nhdr)) <= end)
        {
            const auto *note = reinterpret_cast<const ElfW(Nhdr) *>(cursor);
            const auto *name = cursor + sizeof(ElfW(Nhdr));
            const auto *desc = name + ((note->n_namesz + 3) & ~3u);
            if (note->n_type == NT_GNU_BUILD_ID && note->n_namesz == 4 &&
                std::memcmp(name, "GNU", 4) == 0 && desc + note->n_descsz <= end)
            {
                search->id = hexBytes(desc, note->n_descsz);
                return 1;
            }
            cursor = desc + ((note->n_descsz + 3) & ~3u);
        }
    }
    return 1;
}
#endif

ImageIdentity loaderImageIdentity()
{
    Dl_info info = {};
    if (!dladdr(reinterpret_cast<void *>(&loaderImageIdentity), &info) || !info.dli_fname)
    {
        return {};
    }
    const char   *name = std::strrchr(info.dli_fname, '/');
    ImageIdentity identity{name ? name + 1 : info.dli_fname, ""};
#if defined(__APPLE__)
    identity.id = machOUUID(info.dli_fbase);
#else
    BuildIDSearch search{reinterpret_cast<uintptr_t>(info.dli_fbase), ""};
    dl_iterate_phdr(findBuildID, &search);
    identity.id = search.id;
#endif
    return identity;
}

std::string imageIdentityLine(const ImageIdentity &identity)
{
    if (identity.name.empty() || identity.id.empty())
    {
        return "";
    }
    return "Image " + identity.name + " " + identity.id + "\n";
}
}
