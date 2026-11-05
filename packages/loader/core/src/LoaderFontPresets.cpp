#include <algorithm>
#include <stdexcept>

#include "LoaderFontService.h"
#include "LoaderLog.h"

namespace loader::fonts {
struct PlannedFace {
    std::string   family;
    FontSource    source;
    DiscordFamily wanted;
};

// The faces one provider install has to bring, or every face when a source names none.
struct MissingOrigin {
    FontSource     source;
    nlohmann::json variants  = nlohmann::json::array();
    bool           everyFace = false;
};

nlohmann::json FontService::applyPreset(const std::string &id)
{
    std::lock_guard<std::mutex> lock(installMutex_);
    const FontState             state    = store_.state();
    const DiscordFamilies       families = store_.families();
    const auto                  preset =
        std::find_if(state.presets.begin(), state.presets.end(), [&](const FontPreset &entry) {
            return entry.id == id;
        });
    if (preset == state.presets.end())
    {
        throw std::runtime_error("No preset has the id " + id);
    }

    nlohmann::json             skipped = nlohmann::json::array();
    std::vector<PlannedFace>   planned;
    std::vector<MissingOrigin> missing;
    for (const auto &[family, source] : preset->overrides)
    {
        // Without targets from JS yet, no family can be judged gone.
        if (!families.empty() && !families.count(family))
        {
            skipped.push_back(family);
            continue;
        }
        const DiscordFamily wanted = discordFamily(families, family);
        planned.push_back({family, source, wanted});
        if (source.local() || matchSource(state.fonts, source, wanted))
        {
            continue;
        }
        auto origin = std::find_if(missing.begin(), missing.end(), [&](const MissingOrigin &entry) {
            return sameOrigin(entry.source, source);
        });
        if (origin == missing.end())
        {
            origin = missing.insert(missing.end(), {source});
        }
        if (source.weight)
        {
            origin->variants.push_back(
                {{"weight", *source.weight}, {"style", source.style.value_or("normal")}});
        }
        else
        {
            origin->everyFace = true;
        }
    }

    nlohmann::json errors = nlohmann::json::array();
    for (const MissingOrigin &origin : missing)
    {
        try
        {
            const nlohmann::json result =
                installLocked(fontSourceInput(origin.source),
                              origin.everyFace ? nlohmann::json() : origin.variants);
            for (const nlohmann::json &error : result["errors"])
            {
                errors.push_back(error);
            }
        }
        catch (const std::exception &error)
        {
            log(LogLevel::Warning, LOG_CATEGORY_FONTS,
                "Failed to install " + origin.source.id + " for preset " + id + ": " +
                    error.what());
            errors.push_back(error.what());
        }
    }

    const std::vector<InstalledFont>   installed = store_.state().fonts;
    std::map<std::string, std::string> overrides;
    nlohmann::json                     applied     = nlohmann::json::array();
    nlohmann::json                     unavailable = nlohmann::json::array();
    for (const PlannedFace &face : planned)
    {
        // A face that failed keeps Discord's font: no override points at a missing file.
        if (const InstalledFont *font = matchSource(installed, face.source, face.wanted))
        {
            overrides[face.family] = font->id;
            applied.push_back(face.family);
        }
        else
        {
            unavailable.push_back(face.family);
        }
    }
    store_.replaceOverrides(std::move(overrides));
    return {{"applied", std::move(applied)},
            {"unavailable", std::move(unavailable)},
            {"skipped", std::move(skipped)},
            {"errors", std::move(errors)}};
}
}
