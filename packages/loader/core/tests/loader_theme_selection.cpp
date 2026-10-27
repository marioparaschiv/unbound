#include <cassert>
#include <set>
#include <string>

#include "LoaderThemes.h"

using loader::ThemeRefresh;
using loader::ThemeSelection;

int main()
{
    assert(!loader::themeIdFrom(""));
    assert(loader::themeIdFrom("midnight") == "midnight");

    std::set<std::string> installed{"midnight", "sunrise"};
    ThemeSelection        selection([&installed](const std::string &id) {
        return installed.count(id) > 0;
    });

    assert(!selection.current() && !selection.discordTheme());
    assert(!selection.needsSelection(""));
    assert(selection.needsSelection("midnight"));
    assert(selection.refresh() == ThemeRefresh::None);

    assert(selection.followDiscordTheme("dark") == "dark");
    assert(selection.discordTheme() == "dark");
    assert(selection.apply("dark") == "dark");
    assert(!selection.followDiscordTheme("dark"));
    assert(selection.followDiscordTheme("light") == "light");
    assert(selection.apply("light") == "light");

    assert(!selection.select("missing"));
    assert(selection.current() == "light");

    assert(selection.select("midnight"));
    assert(selection.apply("midnight") == "midnight");
    assert(!selection.needsSelection("midnight"));
    assert(selection.needsSelection(""));
    assert(!selection.followDiscordTheme("dark"));
    assert(selection.discordTheme() == "dark");
    assert(selection.refresh() == ThemeRefresh::Reapply);

    installed.erase("midnight");
    assert(selection.refresh() == ThemeRefresh::Reset);
    assert(!selection.apply(""));
    assert(selection.followDiscordTheme("dark") == "dark");

    assert(selection.select("sunrise"));
    selection.apply("sunrise");
    assert(!selection.followDiscordTheme("light"));
    assert(selection.select(""));
    assert(!selection.apply(""));
    assert(selection.followDiscordTheme("light") == "light");

    ThemeSelection fresh([](const std::string &) {
        return true;
    });
    assert(fresh.followDiscordTheme("") == "");
    assert(!fresh.apply(""));
    return 0;
}
