#include <cassert>

#include "LoaderBackgroundRefresh.h"

using loader::BackgroundRefreshGate;
using loader::BackgroundRefreshState;

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

static void reportsItsState()
{
    BackgroundRefreshGate gate(0, 10, 50);
    BackgroundRefreshState launched = gate.state(4);
    assert(launched.sinceLastMs == 4 && launched.intervalMs == 10 && launched.runs == 0
           && !launched.running);
    assert(gate.begin(10) == 1u);
    BackgroundRefreshState running = gate.state(15);
    assert(running.sinceLastMs == 5 && running.runs == 1 && running.running);
}

int main()
{
    waitsAnIntervalAfterLaunch();
    runsOneRefreshAtATime();
    stopsWaitingOnARunThatNeverSettles();
    reportsItsState();
    return 0;
}
