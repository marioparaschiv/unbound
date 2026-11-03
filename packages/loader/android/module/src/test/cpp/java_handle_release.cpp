#include <cassert>
#include <cstdint>
#include <map>
#include <memory>
#include <string>

#include "JavaHandleRelease.h"

using unbound::android::JavaHandleReleaser;
using unbound::android::PendingJavaPayload;

static uint64_t gGeneration = 1;

static uint64_t currentGeneration()
{
    return gGeneration;
}

struct FakeJavaHandles {
    std::map<std::string, int> issues;

    void issue(const std::string &id)
    {
        issues[id]++;
    }

    size_t live() const
    {
        size_t count = 0;
        for (const auto &[id, remaining] : issues)
        {
            if (remaining > 0)
            {
                count++;
            }
        }
        return count;
    }

    JavaHandleReleaser releaser()
    {
        return [this](const std::string &id) {
            auto found = issues.find(id);
            assert(found != issues.end());
            assert(found->second > 0);
            found->second--;
        };
    }
};

static const std::string kHookPayload =
    R"({"phase":"before","self":{"type":"handle","value":"java-7"},)"
    R"("args":[{"type":"handle","value":"java-8"},{"type":"string","value":"java-9"},)"
    R"({"type":"handle","value":"objc-1"},[{"type":"handle","value":"java-10"}]]})";

static void undeliveredHookToUnknownTokenReleasesEveryIssuedHandle()
{
    FakeJavaHandles handles;
    handles.issue("java-1");
    for (const char *id : {"java-7", "java-8", "java-10"})
    {
        handles.issue(id);
    }
    unbound::android::releaseJavaHandleIssues(handles.releaser(), kHookPayload);
    assert(handles.live() == 1);
    assert(handles.issues["java-1"] == 1);
}

static void inactiveListenerDropsEventAndReleasesOnce()
{
    FakeJavaHandles handles;
    handles.issue("java-1");
    for (const char *id : {"java-7", "java-8", "java-10"})
    {
        handles.issue(id);
    }
    {
        auto pending = std::make_shared<PendingJavaPayload>(handles.releaser(), currentGeneration,
                                                            kHookPayload);
        auto copy    = pending;
    }
    assert(handles.live() == 1);
}

static void deliveredEventKeepsHandlesLive()
{
    FakeJavaHandles handles;
    for (const char *id : {"java-7", "java-8", "java-10"})
    {
        handles.issue(id);
    }
    {
        PendingJavaPayload pending(handles.releaser(), currentGeneration, kHookPayload);
        pending.transfer();
    }
    assert(handles.live() == 3);
}

static void droppedAsyncResultReleasesItsHandleOnce()
{
    FakeJavaHandles handles;
    handles.issue("java-1");
    {
        auto response = std::make_shared<PendingJavaPayload>(handles.releaser(), currentGeneration);
        handles.issue("java-42");
        response->receive(R"({"type":"handle","value":"java-42"})");
    }
    assert(handles.live() == 1);
    assert(handles.issues["java-42"] == 0);
}

static void takenAsyncResultKeepsItsHandle()
{
    FakeJavaHandles handles;
    {
        PendingJavaPayload response(handles.releaser(), currentGeneration);
        handles.issue("java-42");
        response.receive(R"({"type":"handle","value":"java-42"})");
        std::string payload = response.take();
        assert(!payload.empty());
    }
    assert(handles.live() == 1);
}

static void emptyAsyncResultReleasesNothing()
{
    FakeJavaHandles handles;
    handles.issue("java-1");
    {
        PendingJavaPayload response(handles.releaser(), currentGeneration);
    }
    assert(handles.live() == 1);
}

static void replacedRuntimeSkipsReleaseOfOldHandles()
{
    FakeJavaHandles handles;
    handles.issue("java-42");
    {
        PendingJavaPayload pending(handles.releaser(), currentGeneration,
                                   R"({"type":"handle","value":"java-42"})");
        gGeneration++;
    }
    assert(handles.live() == 1);
}

static void resultArrivingAfterRuntimeReplacementIsNeverReleased()
{
    FakeJavaHandles handles;
    {
        PendingJavaPayload response(handles.releaser(), currentGeneration);
        gGeneration++;
        handles.issue("java-42");
        response.receive(R"({"type":"handle","value":"java-42"})");
    }
    assert(handles.live() == 1);
}

static void invalidPayloadReleasesNothing()
{
    FakeJavaHandles handles;
    handles.issue("java-1");
    unbound::android::releaseJavaHandleIssues(handles.releaser(), "{not json");
    assert(handles.live() == 1);
}

int main()
{
    undeliveredHookToUnknownTokenReleasesEveryIssuedHandle();
    inactiveListenerDropsEventAndReleasesOnce();
    deliveredEventKeepsHandlesLive();
    droppedAsyncResultReleasesItsHandleOnce();
    takenAsyncResultKeepsItsHandle();
    emptyAsyncResultReleasesNothing();
    replacedRuntimeSkipsReleaseOfOldHandles();
    resultArrivingAfterRuntimeReplacementIsNeverReleased();
    invalidPayloadReleasesNothing();
    return 0;
}
