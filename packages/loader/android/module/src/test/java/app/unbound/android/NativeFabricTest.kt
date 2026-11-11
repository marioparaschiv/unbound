package app.unbound.android

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
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
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeFabricTest {
    private class FakeView(context: Context) : View(context) {
        var layoutParamWrites = 0
        var minimumWidthWrites = 0
        var minimumHeightWrites = 0

        override fun setLayoutParams(params: ViewGroup.LayoutParams?) {
            layoutParamWrites += 1
            super.setLayoutParams(params)
        }

        override fun setMinimumWidth(minWidth: Int) {
            minimumWidthWrites += 1
            super.setMinimumWidth(minWidth)
        }

        override fun setMinimumHeight(minHeight: Int) {
            minimumHeightWrites += 1
            super.setMinimumHeight(minHeight)
        }
    }

    private class FakeSurface(private val view: View) : NativeFabric.Surface {
        var started = false
        var stopped = false
        var props: Bundle? = null
        var updateCalls = 0

        override fun view(): View = view
        override fun start() {
            started = true
        }

        override fun stop() {
            stopped = true
        }

        override fun updateProps(props: Bundle) {
            updateCalls += 1
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
            val surface = FakeSurface(FakeView(activity))
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

        assertTrue(NativeFabric.unmount(handle))
        assertFalse(NativeFabric.unmount(handle))
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
    fun matchesTheSharedNativeFabricConformanceVector() {
        val fixture = JSONObject(File(requireNotNull(System.getProperty("unbound.nativeFabricVectors"))).readText())
        val handle = NativeFabric.mount(
            "{}",
            fixture.getString("module"),
            fixture.getJSONObject("initialProperties").toString(),
        )
        val expected = fixture.getJSONObject("expected")
        val minimum = expected.getJSONObject("minimum")
        val maximum = expected.getJSONObject("maximum")
        val frame = expected.getJSONObject("frame")
        val trackingView = host.surfaces.single().view() as FakeView
        trackingView.layoutParamWrites = 0
        trackingView.minimumWidthWrites = 0
        trackingView.minimumHeightWrites = 0
        NativeFabric.update(handle, expected.getJSONObject("properties").toString())
        NativeFabric.setSize(handle, minimum.toString(), maximum.toString())
        assertEquals(expected.getInt("sizeCalls"), trackingView.layoutParamWrites)
        assertEquals(expected.getInt("sizeCalls"), trackingView.minimumWidthWrites)
        assertEquals(expected.getInt("sizeCalls"), trackingView.minimumHeightWrites)
        assertEquals(
            kotlin.math.ceil(maximum.getDouble("width") * trackingView.resources.displayMetrics.density).toInt(),
            trackingView.layoutParams.width,
        )
        NativeFabric.setFrame(handle, frame.toString())

        val view = host.surfaces.single().view()
        val density = view.resources.displayMetrics.density
        val expectedProperties = expected.getJSONObject("properties")
        val expectedCalls = fixture.getJSONObject("expected")
        assertEquals(expectedCalls.getInt("updateCalls"), host.surfaces.single().updateCalls)
        assertEquals(
            expectedCalls.getInt("sizeCalls") + expectedCalls.getInt("frameCalls"),
            trackingView.layoutParamWrites,
        )
        assertEquals(
            expectedProperties.getString("label"),
            host.surfaces.single().props?.getString("label"),
        )
        assertEquals(
            expectedProperties.getInt("revision"),
            host.surfaces.single().props?.getInt("revision"),
        )
        assertEquals(
            kotlin.math.ceil(expected.getJSONObject("minimum").getDouble("width") * density).toInt(),
            view.minimumWidth,
        )
        assertEquals((frame.getDouble("x") * density).toFloat(), view.translationX, 0.01f)
        assertEquals((frame.getDouble("y") * density).toFloat(), view.translationY, 0.01f)
        assertEquals(
            kotlin.math.ceil(frame.getDouble("width") * density).toInt(),
            view.layoutParams.width,
        )
        assertEquals(
            kotlin.math.ceil(frame.getDouble("height") * density).toInt(),
            view.layoutParams.height,
        )
        assertEquals(
            expectedCalls.getInt("frameCalls"),
            trackingView.layoutParamWrites - expectedCalls.getInt("sizeCalls"),
        )
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
