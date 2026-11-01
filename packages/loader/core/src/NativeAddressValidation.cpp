#include "NativeAddressValidation.h"

#include <cstring>
#include <dlfcn.h>

#if defined(__APPLE__)
#include <mach-o/loader.h>
#include <mach/mach.h>
#else
#include <cstdio>
#include <link.h>
#include <sys/uio.h>
#include <unistd.h>
#endif

#if defined(__has_feature)
#if __has_feature(ptrauth_calls)
#include <ptrauth.h>
#define UNBOUND_STRIPS_CODE_POINTERS 1
#endif
#endif

namespace {
std::uintptr_t codeAddress(void *address)
{
#if defined(UNBOUND_STRIPS_CODE_POINTERS)
    address = ptrauth_strip(address, ptrauth_key_function_pointer);
#endif
    return reinterpret_cast<std::uintptr_t>(address);
}

#if defined(__APPLE__)
bool regionIsExecutable(std::uintptr_t address)
{
    vm_address_t target = static_cast<vm_address_t>(address);
    natural_t    depth  = 0;
    for (unsigned int attempt = 0; attempt < 16; attempt++)
    {
        vm_address_t                          region = target;
        vm_size_t                             size   = 0;
        vm_region_submap_short_info_data_64_t info{};
        mach_msg_type_number_t                count = VM_REGION_SUBMAP_SHORT_INFO_COUNT_64;
        kern_return_t                         result =
            vm_region_recurse_64(mach_task_self(), &region, &size, &depth,
                                 reinterpret_cast<vm_region_recurse_info_t>(&info), &count);
        if (result != KERN_SUCCESS || !addressWithinRegion(target, region, size))
        {
            return false;
        }
        if (!info.is_submap)
        {
            return (info.protection & VM_PROT_EXECUTE) != 0;
        }
        depth++;
    }
    return false;
}

const load_command *nextCommand(const load_command *command)
{
    return reinterpret_cast<const load_command *>(reinterpret_cast<const std::uint8_t *>(command) +
                                                  command->cmdsize);
}

bool textSegmentSlide(const mach_header_64 *header, std::uintptr_t &slide)
{
    const auto *command = reinterpret_cast<const load_command *>(header + 1);
    for (std::uint32_t index = 0; index < header->ncmds; index++)
    {
        if (command->cmdsize < sizeof(load_command))
        {
            return false;
        }
        if (command->cmd == LC_SEGMENT_64)
        {
            const auto *segment = reinterpret_cast<const segment_command_64 *>(command);
            if (command->cmdsize < sizeof(segment_command_64) ||
                segment->nsects >
                    (command->cmdsize - sizeof(segment_command_64)) / sizeof(section_64))
            {
                return false;
            }
            if (std::strncmp(segment->segname, SEG_TEXT, sizeof(segment->segname)) == 0)
            {
                slide = reinterpret_cast<std::uintptr_t>(header) - segment->vmaddr;
                return true;
            }
        }
        command = nextCommand(command);
    }
    return false;
}

bool withinInstructionSection(const mach_header_64 *header, std::uintptr_t slide,
                              std::uintptr_t address)
{
    const auto *command = reinterpret_cast<const load_command *>(header + 1);
    for (std::uint32_t index = 0; index < header->ncmds; index++)
    {
        if (command->cmd == LC_SEGMENT_64)
        {
            const auto *segment = reinterpret_cast<const segment_command_64 *>(command);
            if ((segment->initprot & VM_PROT_EXECUTE) != 0)
            {
                const auto *sections = reinterpret_cast<const section_64 *>(segment + 1);
                for (std::uint32_t sectionIndex = 0; sectionIndex < segment->nsects; sectionIndex++)
                {
                    const section_64 &section = sections[sectionIndex];
                    if ((section.flags & (S_ATTR_PURE_INSTRUCTIONS | S_ATTR_SOME_INSTRUCTIONS)) !=
                            0 &&
                        addressWithinRegion(address, section.addr + slide, section.size))
                    {
                        return true;
                    }
                }
            }
        }
        command = nextCommand(command);
    }
    return false;
}

bool imageInstructionContains(std::uintptr_t address)
{
    Dl_info image{};
    if (dladdr(reinterpret_cast<void *>(address), &image) == 0 || !image.dli_fbase)
    {
        return false;
    }

    const auto    *header = reinterpret_cast<const mach_header_64 *>(image.dli_fbase);
    std::uintptr_t slide  = 0;
    return header->magic == MH_MAGIC_64 && textSegmentSlide(header, slide) &&
           withinInstructionSection(header, slide, address);
}
#else
bool regionIsExecutable(std::uintptr_t address)
{
    FILE *maps = std::fopen("/proc/self/maps", "re");
    if (!maps)
    {
        return false;
    }

    bool executable = false;
    char line[512];
    while (std::fgets(line, sizeof(line), maps))
    {
        unsigned long start = 0;
        unsigned long end   = 0;
        char          permissions[5]{};
        if (std::sscanf(line, "%lx-%lx %4s", &start, &end, permissions) != 3)
        {
            continue;
        }
        if (address >= start && address < end)
        {
            executable = permissions[2] == 'x';
            break;
        }
    }
    std::fclose(maps);
    return executable;
}

struct SegmentSearch {
    std::uintptr_t address;
    bool           found;
};

int findExecutableSegment(dl_phdr_info *info, std::size_t, void *context)
{
    auto *search = static_cast<SegmentSearch *>(context);
    for (ElfW(Half) index = 0; index < info->dlpi_phnum; index++)
    {
        const ElfW(Phdr) &header = info->dlpi_phdr[index];
        if (header.p_type == PT_LOAD && (header.p_flags & PF_X) != 0 &&
            addressWithinRegion(search->address, info->dlpi_addr + header.p_vaddr, header.p_memsz))
        {
            search->found = true;
            return 1;
        }
    }
    return 0;
}

bool imageInstructionContains(std::uintptr_t address)
{
    SegmentSearch search{address, false};
    dl_iterate_phdr(findExecutableSegment, &search);
    return search.found;
}
#endif
}

bool addressWithinRegion(std::uintptr_t address, std::uintptr_t base, std::size_t size)
{
    return address >= base && address - base < size;
}

bool isExecutableAddress(void *address)
{
    return address && regionIsExecutable(codeAddress(address));
}

bool isInstructionSectionAddress(void *address)
{
    return address && imageInstructionContains(codeAddress(address));
}

bool isCallableSymbolAddress(void *address)
{
    return isExecutableAddress(address) && isInstructionSectionAddress(address);
}

bool readMemorySafely(const void *address, void *destination, std::size_t size)
{
    if (!address || !destination || size == 0)
    {
        return false;
    }
#if defined(__APPLE__)
    vm_size_t     copied = 0;
    kern_return_t result =
        vm_read_overwrite(mach_task_self(), reinterpret_cast<vm_address_t>(address), size,
                          reinterpret_cast<vm_address_t>(destination), &copied);
    return result == KERN_SUCCESS && copied == size;
#else
    struct iovec local  = {destination, size};
    struct iovec remote = {const_cast<void *>(address), size};
    return process_vm_readv(getpid(), &local, 1, &remote, 1, 0) == static_cast<ssize_t>(size);
#endif
}
