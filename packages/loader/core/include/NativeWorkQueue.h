#pragma once

#include <chrono>
#include <cstddef>
#include <deque>
#include <iterator>
#include <list>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <utility>

namespace loader::native {
enum class NativeWorkPriority
{
    Deferred,
    Critical,
};

template <typename Task> class NativeWorkQueue
{
public:
    bool enqueue(Task task, NativeWorkPriority priority = NativeWorkPriority::Deferred)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto &queue = priority == NativeWorkPriority::Critical ? critical_ : deferred_;
        queue.push_back({std::move(task), {}});
        return !std::exchange(scheduled_, true);
    }

    bool enqueueCoalesced(std::string key, Task task)
    {
        if (key.empty())
        {
            return enqueue(std::move(task));
        }
        std::optional<Task>         replaced;
        std::lock_guard<std::mutex> lock(mutex_);
        auto                        found = coalesced_.find(key);
        if (found != coalesced_.end())
        {
            replaced.emplace(std::move(found->second->task));
            found->second->task = std::move(task);
            return false;
        }
        deferred_.push_back({std::move(task), std::move(key)});
        coalesced_.emplace(deferred_.back().key, std::prev(deferred_.end()));
        return !std::exchange(scheduled_, true);
    }

    template <typename Consumer, typename Clock>
    bool drain(Consumer consume, Clock clock,
               std::chrono::steady_clock::duration budget = std::chrono::milliseconds(2))
    {
        const auto deadline  = clock() + budget;
        bool       processed = false;
        for (;;)
        {
            std::optional<Entry> task;
            {
                std::lock_guard<std::mutex> lock(mutex_);
                if (!critical_.empty())
                {
                    task.emplace(std::move(critical_.front()));
                    critical_.pop_front();
                }
                else if (!deferred_.empty() && (!processed || clock() < deadline))
                {
                    auto current = deferred_.begin();
                    if (!current->key.empty())
                    {
                        auto found = coalesced_.find(current->key);
                        if (found != coalesced_.end() && found->second == current)
                        {
                            coalesced_.erase(found);
                        }
                    }
                    task.emplace(std::move(*current));
                    deferred_.pop_front();
                }
                else
                {
                    scheduled_ = !deferred_.empty();
                    return scheduled_;
                }
            }
            consume(std::move(task->task));
            processed = true;
        }
    }

    size_t size() const
    {
        std::lock_guard<std::mutex> lock(mutex_);
        return critical_.size() + deferred_.size();
    }

    void retryScheduling()
    {
        std::lock_guard<std::mutex> lock(mutex_);
        scheduled_ = false;
    }

private:
    struct Entry {
        Task        task;
        std::string key;
    };

    using Queue    = std::list<Entry>;
    using Iterator = typename Queue::iterator;

    mutable std::mutex                        mutex_;
    Queue                                     deferred_;
    Queue                                     critical_;
    std::unordered_map<std::string, Iterator> coalesced_;
    bool                                      scheduled_ = false;
};
}
