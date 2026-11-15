package app.unbound.android

import android.app.Activity
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ActivityTrackerTest {
    @Test
    fun keepsTheLastActivityWhilePausedAndForgetsItOnceDestroyed() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()

        ActivityTracker.onActivityResumed(activity)
        ActivityTracker.onActivityPaused(activity)

        assertNull(ActivityTracker.currentActivity())
        assertSame(activity, ActivityTracker.lastActivity())

        ActivityTracker.onActivityDestroyed(activity)

        assertNull(ActivityTracker.lastActivity())
    }
}
