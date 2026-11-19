#include <cassert>
#include <string>

#include "LoaderLogRepeats.h"

static void writesTheFirstAndCountsTheRest()
{
    loader::LogRepeatCollapser collapser;
    assert(collapser.admit("E [Chat] Failed to place a bubble", 1'000).write);
    assert(!collapser.admit("E [Chat] Failed to place a bubble", 2'000).write);
    assert(!collapser.admit("E [Chat] Failed to place a bubble", 3'000).write);
    assert(collapser.admit("E [Chat] Another failure", 3'500).write);

    loader::RepeatAdmission later = collapser.admit("E [Chat] Third failure", 9'000);
    assert(later.write);
    assert(later.summaries.size() == 1);
    assert(later.summaries[0].starts_with("Repeated 2 more times between "));
    assert(later.summaries[0].ends_with(": E [Chat] Failed to place a bubble"));
}

static void writesAgainAfterAQuietSpell()
{
    loader::LogRepeatCollapser collapser;
    assert(collapser.admit("E [Chat] once", 1'000).write);

    loader::RepeatAdmission again =
        collapser.admit("E [Chat] once", 1'000 + loader::kLogRepeatQuietMs);
    assert(again.write);
    assert(again.summaries.empty());
}

static void flushesWhatIsLeft()
{
    loader::LogRepeatCollapser collapser;
    collapser.admit("E [Chat] loop", 1'000);
    collapser.admit("E [Chat] loop", 1'100);
    std::vector<std::string> summaries = collapser.flush(1'200, true);
    assert(summaries.size() == 1);
    assert(summaries[0].starts_with("Repeated 1 more time between "));
}

int main()
{
    writesTheFirstAndCountsTheRest();
    writesAgainAfterAQuietSpell();
    flushesWhatIsLeft();
    return 0;
}
