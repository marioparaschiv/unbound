#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace loader::codesign {
constexpr uint32_t kMachOMagic64           = 0xfeedfacf;
constexpr uint32_t kMachOSwappedMagic64    = 0xcffaedfe;
constexpr uint32_t kCodeSignatureCommand   = 0x1d;
constexpr uint32_t kEmbeddedSignatureMagic = 0xfade0cc0;
constexpr uint32_t kEntitlementsBlobMagic  = 0xfade7171;
constexpr uint32_t kEntitlementsSlot       = 5;
constexpr uint32_t kFatMagic               = 0xcafebabe;
constexpr uint32_t kFatMagic64             = 0xcafebabf;

std::vector<std::string> entitlementBlobs(const std::string &executablePath);

std::optional<std::string> entitlementsFromBlob(const std::string &blob);
}
