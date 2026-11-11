#pragma once

#include <deque>
#include <functional>
#include <mutex>

namespace loader::native {
class NativeFrameWorkQueue
{
public:
    bool enqueue(std::function<void()> work);
    void drain();
    void clear();

private:
    std::mutex                        mutex_;
    std::deque<std::function<void()>> work_;
    bool                              scheduled_ = false;
};
}
