#include <cassert>

#include "LoaderBackgroundRefresh.h"

using loader::BackgroundRefreshGate;

static void waitsAnIntervalAfterLaunch()
{
    BackgroundRefreshGate gate(1000, 100, 50);
    assert(!gate.begin(1050));
    assert(gate.begin(1100) == 1u);
}

static void runsOneRefreshAtATime()
{
    BackgroundRefreshGate gate(0, 10, 50);
    assert(gate.begin(10) == 1u);
    assert(gate.running(20));
    assert(!gate.begin(30));
    gate.finish(1);
    assert(!gate.running(30));
    assert(gate.begin(30) == 2u);
}

static void stopsWaitingOnARunThatNeverSettles()
{
    BackgroundRefreshGate gate(0, 10, 50);
    assert(gate.begin(10) == 1u);
    assert(!gate.running(60));
    assert(gate.begin(60) == 2u);
    gate.finish(1);
    assert(gate.running(70));
    gate.finish(2);
    assert(!gate.running(70));
}

int main()
{
    waitsAnIntervalAfterLaunch();
    runsOneRefreshAtATime();
    stopsWaitingOnARunThatNeverSettles();
    return 0;
}
