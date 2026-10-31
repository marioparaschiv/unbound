#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <nlohmann/json.hpp>
#include <random>
#include <string>

#include "LoaderColor.h"
#include "LoaderThemes.h"

static void require(bool condition, const char *invariant, const std::string &detail)
{
    if (!condition)
    {
        std::fprintf(stderr, "theme fuzz invariant broken: %s (%s)\n", invariant,
                     detail.substr(0, 240).c_str());
        std::exit(1);
    }
}

class Generator
{
public:
    explicit Generator(uint32_t seed) : random_(seed) {}

    uint32_t next(uint32_t bound)
    {
        return bound == 0 ? 0 : random_() % bound;
    }

    std::string color()
    {
        static const char *const colors[] = {"#fff",
                                             "#ffffff",
                                             "#ffffff80",
                                             "#12345",
                                             "#gggggg",
                                             "#",
                                             "rgb(255, 0, 0)",
                                             "rgba(0,0,0,0.5)",
                                             "rgb(nan, 0, 0)",
                                             "rgb(inf,-inf,0)",
                                             "rgb(1e400, 0, 0)",
                                             "rgba(1,2,3,nan)",
                                             "rgb(1,2)",
                                             "rgb(1,2,3,4,5)",
                                             "rgb(",
                                             "rgb)(",
                                             "  #000  ",
                                             "rgb(-5, 999, 3.5)",
                                             "red",
                                             ""};
        std::string              value    = colors[next(sizeof(colors) / sizeof(colors[0]))];
        if (next(4) == 0 && !value.empty())
        {
            value[next(static_cast<uint32_t>(value.size()))] = static_cast<char>(random_());
        }
        return value;
    }

    nlohmann::json scalar()
    {
        switch (next(7))
        {
            case 0:
                return nullptr;
            case 1:
                return next(2) == 0;
            case 2:
                return static_cast<int>(next(1000));
            case 3:
                return nlohmann::json::array({1, "two"});
            case 4:
                return nlohmann::json::object({{"nested", color()}});
            default:
                return color();
        }
    }

    std::string key()
    {
        static const char *const keys[] = {
            "BACKGROUND_PRIMARY", "text-normal", "brand.500", "",       "a", "___",
            "UPPER_CASE",         "mixedCase",   "😀_emoji",  "x.y-z_w"};
        return keys[next(sizeof(keys) / sizeof(keys[0]))];
    }

    nlohmann::json theme()
    {
        nlohmann::json raw      = nlohmann::json::object();
        nlohmann::json semantic = nlohmann::json::object();
        for (uint32_t index = next(12); index > 0; index--)
        {
            raw[key() + std::to_string(index)] = next(5) ? nlohmann::json(color()) : scalar();
        }
        for (uint32_t index = next(12); index > 0; index--)
        {
            nlohmann::json entry = nlohmann::json::object();
            switch (next(6))
            {
                case 0:
                    entry = scalar();
                    break;
                case 1:
                    entry["type"]  = scalar();
                    entry["value"] = scalar();
                    break;
                default:
                    entry["type"]  = next(2) ? "color" : "raw";
                    entry["value"] = next(2) ? color() : key() + std::to_string(next(12));
                    if (next(4) == 0)
                    {
                        entry["opacity"] = scalar();
                    }
                    break;
            }
            semantic[key() + std::to_string(index)] = entry;
        }
        nlohmann::json bundle = {{"raw", raw}, {"semantic", semantic}};
        if (next(5) == 0)
        {
            bundle["raw"] = scalar();
        }
        if (next(5) == 0)
        {
            bundle["semantic"] = scalar();
        }
        nlohmann::json manifest = {
            {"id", next(5) ? nlohmann::json("theme." + std::to_string(next(9))) : scalar()}};
        nlohmann::json theme = {{"manifest", manifest}, {"bundle", bundle}};
        if (next(8) == 0)
        {
            theme["bundle"] = scalar();
        }
        if (next(8) == 0)
        {
            theme["manifest"] = scalar();
        }
        return next(10) == 0 ? scalar() : theme;
    }

private:
    std::mt19937 random_;
};

static void checkColor(const std::optional<loader::RGBAColor> &color, const std::string &input)
{
    if (!color)
    {
        return;
    }
    require(std::isfinite(color->red) && std::isfinite(color->green) &&
                std::isfinite(color->blue) && std::isfinite(color->alpha),
            "a parsed colour has finite channels", input);
    loader::toARGB(*color);
    loader::isDarkColor(*color);
}

int main()
{
    const char *roundsVariable = std::getenv("ASTRAL_FUZZ_ITERATIONS");
    const long  rounds         = roundsVariable ? std::strtol(roundsVariable, nullptr, 10) : 5000;
    Generator   generator(0x7e3e);

    for (long round = 0; round < rounds; round++)
    {
        std::string input = generator.color();
        checkColor(loader::parseColor(input), input);

        nlohmann::json themes = nlohmann::json::array();
        for (uint32_t count = 1 + generator.next(4); count > 0; count--)
        {
            themes.push_back(generator.theme());
        }
        try
        {
            for (const nlohmann::json &theme : themes)
            {
                loader::ThemeColors colors = loader::resolveThemeColors(theme);
                for (const auto &[name, color] : colors.semantic)
                {
                    checkColor(color, name);
                    loader::themeColorAccessor(name);
                    loader::themeColorResource(name);
                }
                for (const auto &[name, color] : colors.raw)
                {
                    checkColor(color, name);
                }
                loader::themeColorsByAccessor(colors);
            }
            loader::findTheme(themes, "theme." + std::to_string(generator.next(9)));
            loader::themeIdFrom(generator.key());
        }
        catch (const std::exception &error)
        {
            require(false, "applying a theme never throws",
                    std::string(error.what()) + " for " +
                        themes.dump(-1, ' ', false, nlohmann::json::error_handler_t::replace));
        }
    }
    std::printf("theme fuzz: %ld themes and colours\n", rounds);
    return 0;
}
