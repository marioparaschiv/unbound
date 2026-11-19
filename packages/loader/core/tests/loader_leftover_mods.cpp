#include <cassert>
#include <string>
#include <vector>

#include "LoaderLeftoverMods.h"

using loader::environment_report::leftoverMods;

int main()
{
    assert(leftoverMods({"Unbound", "Inbox", "tmp"}).empty());
    assert((leftoverMods({"Unbound", "Enmity", "pyoncord", "bunny"})
            == std::vector<std::string>{"Enmity", "Bunny"}));
    assert((leftoverMods({"VENDETTA"}) == std::vector<std::string>{"Vendetta"}));
    return 0;
}
