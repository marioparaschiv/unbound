#pragma once

#include <functional>
#include <mutex>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

#include "LoaderFontState.h"

namespace loader::fonts {
// The single writer of `Unbound/Fonts/state.json`. Every change is one atomic write of the whole
// state, and `onChange` runs after each one so the platform re-applies its fonts.
class FontStore
{
public:
    explicit FontStore(std::string documents);

    // Loads the state once. With no `state.json` yet, adopts the font files already in the folder
    // as `local` fonts and maps the old `font-states` setting onto them.
    void open(const nlohmann::json &legacyOverrides);
    void setOnChange(std::function<void()> onChange);

    FontState       state() const;
    DiscordFamilies families() const;
    void            setFamilies(DiscordFamilies families);
    std::string     directory() const;
    std::string     pathOf(const InstalledFont &font) const;
    // A fresh empty folder inside the Fonts folder to download into before `commitInstall`.
    std::string stagingDirectory() const;
    void        discardStaging(const std::string &staged) const;

    // Moves `staged` into the Fonts folder in one rename and records `faces` in one write. A face
    // with an installed id replaces it. Throws when either step fails, leaving nothing behind.
    std::vector<InstalledFont> commitInstall(const std::string         &staged,
                                             std::vector<InstalledFont> faces);
    bool                       remove(const std::string &id);
    // Fails for an unknown font id; see `withOverride`.
    bool       setOverride(const std::string &key, const std::optional<std::string> &fontId);
    void       replaceOverrides(std::map<std::string, std::string> overrides);
    FontPreset savePreset(FontPreset preset);
    bool       removePreset(const std::string &id);

    // `{ family: { name, path } }` for `FontOverrideRegistry::plan`.
    nlohmann::json overrideTargets() const;
    // `{ name, path }` of the face replacing `family`, honouring a `*` override of every family.
    std::optional<nlohmann::json> overrideTarget(const std::string &family) const;

private:
    bool update(const std::function<bool(FontState &)> &change);
    void notify();

    std::string           directory_;
    mutable std::mutex    mutex_;
    FontState             state_;
    DiscordFamilies       families_;
    bool                  opened_ = false;
    std::function<void()> onChange_;
};
}
