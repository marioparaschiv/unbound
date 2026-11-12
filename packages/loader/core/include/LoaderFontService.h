#pragma once

#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

#include "LoaderFontStore.h"
#include "LoaderTransport.h"

namespace loader::fonts {
// What `UnboundNative.fonts` does: resolves fonts through Unbound's API, downloads and checks
// them, and changes the store. Each call returns JSON for JS or throws what failed.
class FontService
{
public:
    FontService(std::string documents, FileDownloader download);

    FontStore &store();
    void       setApiOrigin(std::string origin);

    nlohmann::json list() const;
    // The installed faces as `NativePlatform.fonts.list` entries: `{ name, displayName, path, ...
    // }`.
    nlohmann::json catalogEntries() const;
    nlohmann::json resolve(const std::string &input);
    // Installs the files of `input` whose weight and style are in `variants` (every file when it
    // is null or empty). Returns `{ installed, errors }`; throws when nothing installed.
    nlohmann::json install(const std::string &input, const nlohmann::json &variants);
    void           remove(const std::string &id);
    // Adds a face of variable font `id` at `variations` (`{ wght: 450 }`) and returns it.
    nlohmann::json addInstance(const std::string &id, const nlohmann::json &variations);
    void           setOverride(const std::string &family, const std::optional<std::string> &fontId);
    void           setTargets(const nlohmann::json &constants, const nlohmann::json &options);

    nlohmann::json listPresets() const;
    // Saves `preset`; one with no `overrides` snapshots the current ones.
    nlohmann::json savePreset(const nlohmann::json &preset);
    // Replaces every override with the preset's, installing missing faces first. Returns
    // `{ applied, unavailable, skipped, errors }`.
    nlohmann::json applyPreset(const std::string &id);
    void           removePreset(const std::string &id);

private:
    nlohmann::json installLocked(const std::string &input, const nlohmann::json &variants);
    nlohmann::json resolveLocked(const std::string &input);

    FontStore      store_;
    FileDownloader download_;
    std::string    apiOrigin_;
    std::mutex     apiMutex_;
    // One install or preset at a time, so two never stage the same face.
    std::mutex installMutex_;
};

// The default origin of Unbound's API, overridden at build time with `UNBOUND_DEFAULT_API_URL`.
std::string defaultApiOrigin();
std::string percentEncode(const std::string &text);
}
