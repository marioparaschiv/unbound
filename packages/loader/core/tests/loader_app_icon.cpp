#include <cassert>

#include "LoaderAppIcon.h"

using namespace loader::appicon;

static void startsTheFirstPickAndQueuesTheLatest()
{
    IconChangeQueue queue;
    assert(queue.request(1).startNow);
    assert(queue.busy());

    IconRequest second = queue.request(2);
    assert(!second.startNow && !second.superseded);

    IconRequest third = queue.request(3);
    assert(!third.startNow && third.superseded == 2u);

    assert(queue.finish() == 3u);
    assert(queue.busy());
    assert(!queue.finish());
    assert(!queue.busy());
    assert(queue.request(4).startNow);
}

static void dropsAQueuedPickThatWaitedTooLong()
{
    IconChangeQueue queue;
    queue.request(1);
    queue.request(2);
    assert(!queue.cancel(1));
    assert(queue.cancel(2));
    assert(!queue.cancel(2));
    assert(!queue.finish());
    assert(!queue.busy());
}

static void walksTheFramesAndLoops()
{
    std::vector<double> durations{100, 200, 100};
    assert(frameAt(durations, 0.0) == 0);
    assert(frameAt(durations, 0.15) == 1);
    assert(frameAt(durations, 0.35) == 2);
    assert(frameAt(durations, 0.45) == 0);
    assert(frameAt({}, 1.0) == 0);
}

static void animatesOnlyWhereChangesAreSilent()
{
    assert(changesNeedConfirmation(27, false));
    assert(!changesNeedConfirmation(26, false));
    assert(changesNeedConfirmation(26, true));
    assert(canAnimate(true, false, false));
    assert(!canAnimate(true, false, true));
    assert(canAnimate(true, true, true));
    assert(!canAnimate(false, true, false));
}

int main()
{
    startsTheFirstPickAndQueuesTheLatest();
    dropsAQueuedPickThatWaitedTooLong();
    walksTheFramesAndLoops();
    animatesOnlyWhereChangesAreSilent();
    return 0;
}
