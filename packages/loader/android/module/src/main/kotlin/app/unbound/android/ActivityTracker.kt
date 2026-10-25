package app.unbound.android

import android.app.Activity
import android.app.Application
import android.os.Bundle
import java.lang.ref.WeakReference

object ActivityTracker : Application.ActivityLifecycleCallbacks {
    private val lock = Any()
    private var installed = false

    @Volatile
    private var current: WeakReference<Activity>? = null

    @Volatile
    private var knownApplication: Application? = null

    @Volatile
    var generation: Long = 0
        private set

    fun install(application: Application?) {
        if (application == null) return
        knownApplication = application

        synchronized(lock) {
            if (installed) return
            application.registerActivityLifecycleCallbacks(this)
            installed = true
        }
    }

    fun application(): Application? = knownApplication

    fun currentActivity(): Activity? = current?.get()

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit

    override fun onActivityStarted(activity: Activity) = Unit

    override fun onActivityResumed(activity: Activity) {
        if (!installed) install(activity.application)
        val previous = current?.get()
        if (previous !== activity) generation++
        current = WeakReference(activity)
    }

    override fun onActivityPaused(activity: Activity) {
        if (current?.get() === activity) current = null
    }

    override fun onActivityStopped(activity: Activity) = Unit

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

    override fun onActivityDestroyed(activity: Activity) {
        if (current?.get() === activity) current = null
    }
}
