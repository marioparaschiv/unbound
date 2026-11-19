#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace loader {
struct DiskFullNote {
    int64_t at = 0;
    std::string file;
};

bool isOutOfSpace(int error);
void noteWriteFailure(int error, const std::string &path, int64_t at);
std::optional<DiskFullNote> diskFullNote();
void clearDiskFullNote();
}
