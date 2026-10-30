#include <cassert>
#include <string>

#include "LoaderAlertCountdown.h"

using namespace loader::alerts;

static void formatsTitles()
{
    assert(countdownTitle("astral", 5) == "astral (5)");
    assert(countdownTitle("", 1) == " (1)");
}

static void leavesAlertsWithoutTimeoutAlone()
{
    for (long seconds : {0L, -3L})
    {
        Countdown            countdown("Warning", seconds);
        const CountdownFrame frame = countdown.frame();
        assert(frame.title == "Warning" && frame.buttonsEnabled && !frame.running);
        const CountdownFrame ticked = countdown.tick(true);
        assert(ticked.title == "Warning" && ticked.buttonsEnabled && !ticked.running);
    }
}

static void countsDownThenEnablesButtons()
{
    Countdown      countdown("Integrity", 3);
    CountdownFrame frame = countdown.frame();
    assert(frame.title == "Integrity (3)" && !frame.buttonsEnabled && frame.running);

    frame = countdown.tick(true);
    assert(frame.title == "Integrity (2)" && !frame.buttonsEnabled && frame.running);
    frame = countdown.tick(true);
    assert(frame.title == "Integrity (1)" && !frame.buttonsEnabled && frame.running);
    frame = countdown.tick(true);
    assert(frame.title == "Integrity" && frame.buttonsEnabled && !frame.running);
    frame = countdown.tick(true);
    assert(frame.title == "Integrity" && frame.buttonsEnabled && !frame.running);
}

static void stopsWhenTheAlertIsDismissed()
{
    Countdown countdown("Integrity", 5);
    countdown.tick(true);
    CountdownFrame frame = countdown.tick(false);
    assert(frame.title == "Integrity (4)" && !frame.buttonsEnabled && !frame.running);
    frame = countdown.tick(true);
    assert(!frame.running);
}

static void enablesAfterASingleSecond()
{
    Countdown countdown("Notice", 1);
    assert(countdown.frame().title == "Notice (1)");
    const CountdownFrame frame = countdown.tick(true);
    assert(frame.title == "Notice" && frame.buttonsEnabled && !frame.running);
}

int main()
{
    formatsTitles();
    leavesAlertsWithoutTimeoutAlone();
    countsDownThenEnablesButtons();
    stopsWhenTheAlertIsDismissed();
    enablesAfterASingleSecond();
    return 0;
}
