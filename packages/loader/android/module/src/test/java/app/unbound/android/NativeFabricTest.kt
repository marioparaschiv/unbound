package app.unbound.android

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeFabricTest {
    private class FakeSurface(private val view: View) : NativeFabric.Surface {
        var started = false
        var stopped = false
        var props: Bundle? = null

        override fun view(): View = view
        override fun start() {
            started = true
        }

        override fun stop() {
            stopped = true
        }

        override fun updateProps(props: Bundle) {
            this.props = props
        }

        override fun isRunning(): Boolean = started && !stopped
    }

    private class FakeHost(private val activity: Activity) : NativeFabric.Host {
        val created = ArrayList<Pair<String, Bundle>>()
        val surfaces = ArrayList<FakeSurface>()

        override fun createSurface(
            context: Context,
            moduleName: String,
            props: Bundle,
        ): NativeFabric.Surface {
            created.add(moduleName to props)
            val surface = FakeSurface(View(activity))
            surfaces.add(surface)

            return surface
        }

        override fun activityContext(): Context = activity
    }

    private lateinit var activity: Activity
    private lateinit var host: FakeHost

    @Before
    fun setUp() {
        NativeFabric.unmountAll()
        activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        activity.setContentView(FrameLayout(activity))
        ActivityTracker.onActivityResumed(activity)
        host = FakeHost(activity)
        NativeFabric.useHost(host)
    }

    @Test
    fun mountAcceptsAJavaViewHandleAsTheContainer() {
        val container = FrameLayout(activity)
        val containerHandle = NativeJava.handleFor(container)

        NativeFabric.mount(containerHandle, "MyComponent", "{}")

        assertEquals(1, container.childCount)
        assertEquals(host.surfaces.single().view(), container.getChildAt(0))
    }

    @Test
    fun mountStartsTheSurfaceAndAttachesItsView() {
        val handle = NativeFabric.mount("{}", "MyComponent", """{"title":"hello"}""")

        assertTrue(JSONObject(handle).getString("id").startsWith("surface-"))
        assertEquals(1, host.created.size)
        assertEquals("MyComponent", host.created[0].first)
        assertEquals("hello", host.created[0].second.getString("title"))
        assertTrue(host.surfaces[0].started)
        assertEquals(1, NativeFabric.mountedCount())
        assertTrue(host.surfaces[0].view().parent != null)
    }

    @Test
    fun mountRejectsAnEmptyModuleName() {
        assertThrows(IllegalArgumentException::class.java) {
            NativeFabric.mount("{}", "", "{}")
        }
    }

    @Test
    fun mountRejectsAnOversizedModuleName() {
        assertThrows(IllegalArgumentException::class.java) {
            NativeFabric.mount("{}", "a".repeat(200), "{}")
        }
    }

    @Test
    fun updateForwardsNewProps() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")

        NativeFabric.update(handle, """{"count":7}""")

        assertEquals(7, host.surfaces[0].props?.getInt("count"))
    }

    @Test
    fun unmountStopsTheSurfaceAndDetachesItsView() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")
        val view = host.surfaces[0].view()

        NativeFabric.unmount(handle)

        assertTrue(host.surfaces[0].stopped)
        assertEquals(null, view.parent)
        assertEquals(0, NativeFabric.mountedCount())
    }

    @Test
    fun operationsOnAnUnmountedSurfaceAreRejected() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")
        NativeFabric.unmount(handle)

        assertThrows(IllegalArgumentException::class.java) {
            NativeFabric.update(handle, "{}")
        }
    }

    @Test
    fun unmountingTwiceIsHarmless() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")
        NativeFabric.unmount(handle)
        NativeFabric.unmount(handle)

        assertEquals(0, NativeFabric.mountedCount())
    }

    @Test
    fun setSizeAppliesTheMaximumSizeAndTheMinimumFloor() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")
        val view = host.surfaces[0].view()

        NativeFabric.setSize(handle, """{"width":10,"height":20}""", """{"width":120,"height":48}""")

        assertEquals(120, view.layoutParams.width)
        assertEquals(48, view.layoutParams.height)
        assertEquals(10, view.minimumWidth)
        assertEquals(20, view.minimumHeight)
    }

    @Test
    fun setFrameSizesTheSurfaceView() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")
        val view = host.surfaces[0].view()

        NativeFabric.setFrame(handle, """{"x":0,"y":0,"width":64,"height":0}""")

        assertEquals(64, view.layoutParams.width)
        assertEquals(0, view.layoutParams.height)
    }

    @Test
    fun measureRejectsAnUnlaidSurfaceView() {
        val handle = NativeFabric.mount("{}", "MyComponent", "{}")

        assertThrows(IllegalStateException::class.java) {
            NativeFabric.measure(handle)
        }
    }

    @Test
    fun measureRejectsAnUnknownHandle() {
        assertThrows(IllegalArgumentException::class.java) {
            NativeFabric.measure("""{"id":"surface-999"}""")
        }
    }

    @Test
    fun unmountAllDetachesEverySurface() {
        NativeFabric.mount("{}", "First", "{}")
        NativeFabric.mount("{}", "Second", "{}")

        NativeFabric.unmountAll()

        assertEquals(0, NativeFabric.mountedCount())
        assertTrue(host.surfaces.all { it.stopped })
    }

    @Test
    fun propsCarryEveryScalarKind() {
        val props = NativeFabric.bundle(
            JSONObject(
                """{"text":"a","count":2,"ratio":1.5,"flag":true,"missing":null}""",
            ),
        )

        assertEquals("a", props.getString("text"))
        assertEquals(2, props.getInt("count"))
        assertEquals(1.5, props.getDouble("ratio"), 0.0001)
        assertTrue(props.getBoolean("flag"))
        assertEquals(null, props.getString("missing"))
    }

    @Test
    fun propsCarryNestedObjectsAndArrays() {
        val props = NativeFabric.bundle(
            JSONObject(
                """{"user":{"id":"7"},"tags":["a","b"],"sizes":[1,2],"rows":[{"k":"v"}]}""",
            ),
        )

        assertEquals("7", props.getBundle("user")?.getString("id"))
        assertEquals(listOf("a", "b"), props.getStringArray("tags")?.toList())
        assertEquals(listOf(1, 2), props.getIntArray("sizes")?.toList())
        assertEquals("v", props.getParcelableArrayList<Bundle>("rows")?.get(0)?.getString("k"))
    }


    @Test
    fun mountWithoutAHostIsRejected() {
        NativeFabric.useHost(
            object : NativeFabric.Host {
                override fun createSurface(
                    context: Context,
                    moduleName: String,
                    props: Bundle,
                ): NativeFabric.Surface = throw IllegalStateException("no react host")

                override fun activityContext(): Context = activity
            },
        )

        assertThrows(IllegalStateException::class.java) {
            NativeFabric.mount("{}", "MyComponent", "{}")
        }
        assertFalse(NativeFabric.mountedCount() > 0)
    }
}
