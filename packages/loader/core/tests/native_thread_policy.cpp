#include <cassert>

#include "NativeThreadPolicy.h"

using loader::native::crossesToMain;
using loader::native::postsToMain;
using loader::native::runsInPlace;
using loader::native::threadPolicy;

int main()
{
    assert(threadPolicy(nlohmann::json(nullptr)) == "current");
    assert(threadPolicy(nlohmann::json::array({"main"})) == "current");
    assert(threadPolicy(nlohmann::json::object()) == "current");
    assert(threadPolicy({{"thread", 1}}) == "current");
    assert(threadPolicy({{"thread", "main"}}) == "main");
    assert(threadPolicy({{"thread", "main-post"}}) == "main-post");
    assert(threadPolicy({{"thread", "background"}}) == "background");

    assert(crossesToMain("main"));
    assert(crossesToMain("main-post"));
    assert(!crossesToMain("current"));
    assert(!crossesToMain("background"));

    assert(runsInPlace("current", false));
    assert(runsInPlace("current", true));
    assert(runsInPlace("main", true));
    assert(runsInPlace("main-post", true));
    assert(!runsInPlace("main", false));
    assert(!runsInPlace("main-post", false));
    assert(!runsInPlace("background", true));

    assert(postsToMain("main-post", true));
    assert(!postsToMain("main-post", false));
    assert(!postsToMain("main", true));
}
