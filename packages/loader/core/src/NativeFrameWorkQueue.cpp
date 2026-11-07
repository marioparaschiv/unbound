#include "NativeFrameWorkQueue.h"

#include <chrono>
#include <exception>
#include <string>
#include <utility>

#include "LoaderLog.h"
#include "NativePluginRuntime.h"

bool loader::native::NativeFrameWorkQueue::enqueue(std::function<void()> work)
{
    std::lock_guard<std::mutex> lock(mutex_);
    work_.push_back(std::move(work));
    if (scheduled_)
    {
        return false;
    }
    scheduled_ = true;
    return true;
}

void loader::native::NativeFrameWorkQueue::drain()
{
    std::deque<std::function<void()>> work;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        work.swap(work_);
        scheduled_ = false;
    }
    if (work.empty())
    {
        return;
    }

    const auto startedAt = std::chrono::steady_clock::now();
    for (auto &item : work)
    {
        try
        {
            item();
        }
        catch (const std::exception &error)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        std::string("Frame-batched native work failed: ") + error.what());
        }
        catch (...)
        {
            loader::log(loader::LogLevel::Error, LOG_CATEGORY_PLUGINS,
                        "Frame-batched native work failed.");
        }
    }
    loader::native::recordMainDrain(work.size(), std::chrono::steady_clock::now() - startedAt);
}

void loader::native::NativeFrameWorkQueue::clear()
{
    std::lock_guard<std::mutex> lock(mutex_);
    work_.clear();
    scheduled_ = false;
}
