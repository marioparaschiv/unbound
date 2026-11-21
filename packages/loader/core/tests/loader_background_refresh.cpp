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
    gate.finish(1, true);
    assert(!gate.running(30));
    assert(gate.begin(30) == 2u);
}

static void stopsWaitingOnARunThatNeverSettles()
{
    BackgroundRefreshGate gate(0, 10, 50);
    assert(gate.begin(10) == 1u);
    assert(!gate.running(60));
    assert(gate.begin(60) == 2u);
    gate.finish(1, true);
    assert(gate.running(70));
    gate.finish(2, true);
    assert(!gate.running(70));
}

static void backsOffAfterQuietRuns()
{
    BackgroundRefreshGate gate(0, 10, 1000);
    assert(gate.begin(10) == 1u);
    gate.finish(1, false);
    assert(gate.state(10).intervalMs == 20);
    assert(!gate.begin(25));
    assert(gate.begin(30) == 2u);
    gate.finish(2, false);
    assert(gate.begin(70) == 3u);
    gate.finish(3, false);
    assert(gate.begin(150) == 4u);
    gate.finish(4, false);
    assert(gate.state(150).intervalMs == 80);
    assert(gate.begin(230) == 5u);
    gate.finish(5, true);
    assert(gate.state(230).intervalMs == 10);
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
    backsOffAfterQuietRuns();
    return 0;
}
