package app.unbound.android

import android.app.Activity
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class NativeUITest {
    @Before
    fun useJvmColorParser() {
        NativeUI.colorParser = { value -> runCatching { Color.parseColor(value) }.getOrNull() }
    }

    @Test
    fun lookupReturnsHandlesForMatchingViewsWithinTheResultLimit() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val container = LinearLayout(activity)
        container.addView(TextView(activity).apply { text = "First" })
        container.addView(TextView(activity).apply { text = "Second" })
        activity.setContentView(container)
        ActivityTracker.onActivityResumed(activity)

        val response = JSONArray(NativeUI.lookup("""{"role":"text","maxResults":1}"""))

        assertEquals(1, response.length())
        assertEquals(true, response.getJSONObject(0).getString("id").isNotEmpty())
    }

    @Test
    fun snapshotReturnsTextAndGenerationScopedParentHandles() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val container = LinearLayout(activity)
        val label = TextView(activity).apply { text = "Target message" }
        container.addView(label)
        activity.setContentView(container)
        ActivityTracker.onActivityResumed(activity)

        val handle = JSONArray(NativeUI.lookup("""{"role":"text"}""")).getJSONObject(0)
        val snapshot = JSONObject(
            NativeUI.snapshot("""{"role":"text","root":${handle}}"""),
        )
        val node = snapshot.getJSONArray("nodes").getJSONObject(0)

        assertEquals(ActivityTracker.generation, snapshot.getLong("generation"))
        assertEquals("Target message", node.getJSONObject("attributes").getString("text"))
        assertEquals(handle.getString("id"), node.getJSONObject("id").getString("id"))
    }

    @Test
    fun snapshotRejectsAHandleFromAnEarlierActivityGeneration() {
        val firstActivity = Robolectric.buildActivity(Activity::class.java).setup().get()
        firstActivity.setContentView(TextView(firstActivity).apply { text = "First" })
        ActivityTracker.onActivityResumed(firstActivity)
        val handle = JSONArray(NativeUI.lookup("""{"role":"text"}""")).getJSONObject(0)

        val secondActivity = Robolectric.buildActivity(Activity::class.java).setup().get()
        secondActivity.setContentView(TextView(secondActivity).apply { text = "Second" })
        ActivityTracker.onActivityResumed(secondActivity)

        assertThrows(IllegalArgumentException::class.java) {
            NativeUI.snapshot("""{"role":"text","root":${handle}}""")
        }
    }

    @Test
    fun measureReturnsTheCurrentLaidOutFrame() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val label = TextView(activity).apply { text = "Measured" }
        activity.setContentView(label)
        ActivityTracker.onActivityResumed(activity)
        label.layout(0, 0, 120, 40)
        val handle = JSONArray(NativeUI.lookup("""{"role":"text"}""")).getJSONObject(0)

        val measured = JSONObject(NativeUI.measureView(handle.toString()))

        assertEquals(120.0, measured.getDouble("width"), 0.0)
        assertEquals(40.0, measured.getDouble("height"), 0.0)
    }

    @Test
    fun measureRejectsAHandleFromAnEarlierActivityGeneration() {
        val firstActivity = Robolectric.buildActivity(Activity::class.java).setup().get()
        firstActivity.setContentView(TextView(firstActivity).apply { text = "First" })
        ActivityTracker.onActivityResumed(firstActivity)
        val handle = JSONArray(NativeUI.lookup("""{"role":"text"}""")).getJSONObject(0)

        val secondActivity = Robolectric.buildActivity(Activity::class.java).setup().get()
        secondActivity.setContentView(TextView(secondActivity).apply { text = "Second" })
        ActivityTracker.onActivityResumed(secondActivity)

        assertThrows(IllegalArgumentException::class.java) {
            NativeUI.measureView(handle.toString())
        }
    }

    @Test
    fun frameUpdateValidatesAndAppliesBoundedDimensions() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val label = TextView(activity).apply { text = "Resizable" }
        activity.setContentView(label)
        ActivityTracker.onActivityResumed(activity)
        val handle = JSONArray(NativeUI.lookup("""{"role":"text"}""")).getJSONObject(0)

        NativeUI.setViewFrame(
            handle.toString(),
            """{"x":20,"y":30,"width":80,"height":24}""",
        )

        assertEquals(80, label.layoutParams.width)
        assertEquals(24, label.layoutParams.height)
        assertThrows(IllegalArgumentException::class.java) {
            NativeUI.setViewFrame(handle.toString(), """{"x":0,"y":0,"width":0,"height":24}""")
        }
    }

    @Test
    fun mountUpdateAndUnmountManageNativeViewsWithinTheirContainer() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        activity.setContentView(FrameLayout(activity))
        ActivityTracker.onActivityResumed(activity)

        val container = JSONObject(NativeUI.mountView("", "View", "{}"))
        val text = JSONObject(
            NativeUI.mountView(container.toString(), "Text", """{"text":"Before"}"""),
        )
        NativeUI.updateView(text.toString(), """{"text":"After","textColor":"#FFFFFF"}""")

        val matching = JSONArray(
            NativeUI.lookup("""{"role":"text","attributes":{"text":"After"}}"""),
        )

        assertEquals(1, matching.length())
        NativeUI.unmountView(text.toString())
        assertEquals(
            0,
            JSONArray(NativeUI.lookup("""{"role":"text","attributes":{"text":"After"}}""")).length(),
        )
        NativeUI.unmountView(container.toString())
    }

    @Test
    fun mountRejectsUnsupportedModulesAndProperties() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        activity.setContentView(FrameLayout(activity))
        ActivityTracker.onActivityResumed(activity)

        assertThrows(IllegalArgumentException::class.java) {
            NativeUI.mountView("", "Unknown", "{}")
        }
        assertThrows(IllegalArgumentException::class.java) {
            NativeUI.mountView("", "Text", """{"unknown":true}""")
        }
    }

    @Test
    fun imageMountSupportsUriScalingAndRoundedClipping() {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        activity.setContentView(FrameLayout(activity))
        ActivityTracker.onActivityResumed(activity)

        val handle = JSONObject(
            NativeUI.mountView(
                "",
                "Image",
                """{"sourceUri":"","scaleType":"centerCrop","borderRadius":18,"contentDescription":"native-image-test"}""",
            ),
        )
        val image = findImageView(activity.window.decorView)
        val mounted = JSONArray(
            NativeUI.lookup(
                """{"role":"image","attributes":{"contentDescription":"native-image-test"}}""",
            ),
        )

        assertEquals(1, mounted.length())
        assertEquals(ImageView.ScaleType.CENTER_CROP, image?.scaleType)
        assertEquals(true, image?.clipToOutline)
        assertEquals(true, NativeImageLoader.isSupportedSource("https://cdn.discordapp.com/avatar.png"))
        assertEquals(false, NativeImageLoader.isSupportedSource("http://cdn.discordapp.com/avatar.png"))
        NativeUI.unmountView(handle.toString())
        assertEquals(null, image?.parent)
        assertEquals(
            0,
            JSONArray(
                NativeUI.lookup(
                    """{"role":"image","attributes":{"contentDescription":"native-image-test"}}""",
                ),
            ).length(),
        )
    }

    @Test
    fun imageSourceRejectsUntrustedAndUnsupportedSchemes() {
        assertEquals(false, NativeImageLoader.isSupportedSource("https://example.com/image.png"))
        assertEquals(false, NativeImageLoader.isSupportedSource("https://cdn.discordapp.com:444/image.png"))
        assertEquals(false, NativeImageLoader.isSupportedSource("https://cdn.discordapp.com.evil.test/image.png"))
        assertEquals(false, NativeImageLoader.isSupportedSource("content://"))
        assertEquals(false, NativeImageLoader.isSupportedSource("data:image/png;base64,abc"))
        assertEquals(true, NativeImageLoader.isSupportedSource("file:///tmp/image.png"))
        assertEquals(true, NativeImageLoader.isSupportedSource("content://media/asset/1"))
    }

    private fun findImageView(view: View): ImageView? {
        if (view is ImageView) return view
        if (view !is ViewGroup) return null

        for (index in 0 until view.childCount) {
            findImageView(view.getChildAt(index))?.let { return it }
        }

        return null
    }

    @Test
    fun activityTrackerClearsPausedActivitiesAndTracksTheNextResume() {
        val firstActivity = Robolectric.buildActivity(Activity::class.java).setup().get()
        ActivityTracker.onActivityResumed(firstActivity)
        val firstGeneration = ActivityTracker.generation

        ActivityTracker.onActivityPaused(firstActivity)

        assertEquals(null, ActivityTracker.currentActivity())

        val secondActivity = Robolectric.buildActivity(Activity::class.java).setup().get()
        ActivityTracker.onActivityResumed(secondActivity)

        assertEquals(secondActivity, ActivityTracker.currentActivity())
        assertEquals(firstGeneration + 1, ActivityTracker.generation)
        ActivityTracker.onActivityPaused(secondActivity)
    }
}
