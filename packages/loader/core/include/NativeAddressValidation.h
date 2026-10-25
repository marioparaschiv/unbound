#pragma once

#include <cstddef>
#include <cstdint>

bool addressWithinRegion(std::uintptr_t address, std::uintptr_t base, std::size_t size);
bool isExecutableAddress(void *address);
bool isInstructionSectionAddress(void *address);
bool isCallableSymbolAddress(void *address);
