#include <cassert>
#include <string>

#include "LoaderLaunchReport.h"
#include "LoaderTombstone.h"

namespace {
const std::string kTrace = R"(----- pid 4211 at 2026-11-13 00:10:02.114 -----
Cmd line: com.discord

"Signal Catcher" daemon prio=10 tid=7 Runnable
  native: #00 pc 0000000000123456  /apex/com.android.art/lib64/libart.so (art::DumpNativeStack+100)

"main" prio=5 tid=1 Blocked
  | group="main" sCount=1 ucsCount=0 flags=1 obj=0x72a4c3a0
  | sysTid=4211 nice=-10 cgrp=top-app sched=0/0 handle=0x7b2a0e14f8
  at com.discord.chat.ChatView.onLayout(ChatView.kt:120)
  - waiting to lock <0x0c1f9a2e> (a java.lang.Object) held by thread 23
  at android.view.View.layout(View.java:25000)
  native: #00 pc 00000000000a1b2c  /apex/com.android.runtime/lib64/bionic/libc.so (__futex_wait+20)

"RenderThread" daemon prio=7 tid=12 Native
  at android.os.MessageQueue.nativePollOnce(Native method)

"mqt_v_js" prio=5 tid=31 Runnable
  native: #00 pc 0000000000222222  /data/app/com.discord/lib/arm64/libhermesvm.so (hermes::vm::Interpreter::run+40)

"Unbound scheduled refresh" prio=5 tid=40 Native
  native: #00 pc 0000000000333333  /data/app/com.discord/lib/arm64/libunbound.so (loader::Loader::onBackground+12)
)";

void readsTheMainThreadOfAnAnrTrace()
{
    std::optional<std::string> stack = loader::anrTraceStack(kTrace);
    assert(stack);
    assert(stack->starts_with("ANR in thread 1 (main), from Android's ANR trace\n"));
    assert(stack->find("at com.discord.chat.ChatView.onLayout(ChatView.kt:120)")
           != std::string::npos);
    assert(stack->find("- waiting to lock") != std::string::npos);
    assert(stack->find("__futex_wait") != std::string::npos);
    assert(stack->find("nativePollOnce") == std::string::npos);
    assert(stack->find("DumpNativeStack") == std::string::npos);
    assert(loader::nativeCrashHeadline(*stack) == "ANR (not responding)");
}

void addsTheReasonAndTheThreadsThatMayHoldTheMainThread()
{
    std::optional<std::string> stack =
        loader::anrTraceStack(kTrace, "", "Input dispatching timed out\n(Waited 5000ms)");
    assert(stack);
    assert(stack->find("Reason Input dispatching timed out (Waited 5000ms)\n")
           != std::string::npos);
    assert(stack->find("Thread mqt_v_js\n") != std::string::npos);
    assert(stack->find("Thread Unbound scheduled refresh\n") != std::string::npos);
    assert(stack->find("Thread RenderThread") == std::string::npos);
    assert(stack->find("Thread mqt_v_js") > stack->find("ChatView.onLayout"));
    assert(loader::nativeCrashHeadline(*stack) == "ANR (not responding)");
}

void namesTheAddonThatBlockedTheMainThread()
{
    std::optional<std::string> stack =
        loader::anrTraceStack(kTrace, R"({"id":"chat-bubbles","name":"Chat Bubbles"})");
    assert(stack);
    assert(loader::nativeCrashHeadline(*stack) == "ANR (not responding) in Chat Bubbles");
    assert(loader::describeNativeCrash(*stack).find("Addon Chat Bubbles\n") != std::string::npos);
}

void ignoresATraceWithoutAMainThread()
{
    assert(!loader::anrTraceStack(
        "\"RenderThread\" daemon prio=7 tid=12 Native\n  at x.y(Z.java:1)\n"));
    assert(!loader::anrTraceStack(""));
}
}

int main()
{
    readsTheMainThreadOfAnAnrTrace();
    addsTheReasonAndTheThreadsThatMayHoldTheMainThread();
    namesTheAddonThatBlockedTheMainThread();
    ignoresATraceWithoutAMainThread();
    return 0;
}
