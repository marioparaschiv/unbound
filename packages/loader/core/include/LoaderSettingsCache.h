#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace loader {
// settings.json stays the file people and tools edit. Next to it the store keeps a binary
// cache: each store as MessagePack, plus where that store's text sits in settings.json. The
// cache holds only while it names the hash of settings.json's exact bytes, so any edit to the
// JSON, by hand or by a tool, makes the next load parse the JSON again and rebuild the cache.

// One store as the cache records it.
struct CachedStore {
    std::string name;
    uint64_t    jsonOffset = 0;
    uint64_t    jsonLength = 0;
    std::string packed;
};

// 64-bit FNV-1a of settings.json's bytes. Not a security check: whoever can edit the cache can
// edit the JSON too.
uint64_t settingsHash(std::string_view json);

std::string encodeSettingsCache(uint64_t jsonHash, uint64_t jsonSize,
                                const std::vector<CachedStore> &stores);

// The stores the cache holds for a settings.json of this hash and size, or nothing when the cache
// is malformed, from another format version, or for other JSON.
std::optional<std::vector<CachedStore>> decodeSettingsCache(std::string_view cache,
                                                            uint64_t jsonHash, uint64_t jsonSize);
}
