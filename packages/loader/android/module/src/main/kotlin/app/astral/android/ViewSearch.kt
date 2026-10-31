package app.astral.android

import android.view.View
import android.view.ViewGroup
import org.json.JSONObject

data class ViewSearch(
    val maxDepth: Int,
    val maxNodes: Int,
    val maxResults: Int,
    val attachedOnly: Boolean,
    val stopAtMatch: Boolean,
    val ancestors: Boolean,
) {
    companion object {
        fun from(options: JSONObject) = ViewSearch(
            maxDepth = options.optInt("maxDepth", 64),
            maxNodes = options.optInt("maxNodes", 4_000),
            maxResults = options.optInt("maxResults", 1_000),
            attachedOnly = options.optBoolean("attachedOnly", false),
            stopAtMatch = options.optBoolean("stopAtMatch", false),
            ancestors = options.optString("direction") == "ancestors",
        )
    }

    fun run(root: View, target: Class<*>): List<View> = if (ancestors) {
        ancestorsOf(root, target)
    } else {
        descendantsOf(root, target)
    }

    private fun accepts(view: View, target: Class<*>): Boolean =
        target.isInstance(view) && (!attachedOnly || view.isAttachedToWindow)

    private fun ancestorsOf(root: View, target: Class<*>): List<View> {
        val found = mutableListOf<View>()
        var current = root.parent as? View
        var depth = 1

        while (current != null && depth <= maxDepth && found.size < maxResults) {
            if (accepts(current, target)) {
                found.add(current)
                if (stopAtMatch) break
            }
            current = current.parent as? View
            depth++
        }

        return found
    }

    private fun descendantsOf(root: View, target: Class<*>): List<View> {
        val found = mutableListOf<View>()
        val queue = ArrayDeque<Pair<View, Int>>()
        var visited = 0

        queue.addLast(root to 0)

        while (queue.isNotEmpty() && visited < maxNodes && found.size < maxResults) {
            val (view, depth) = queue.removeFirst()
            visited++

            val matched = accepts(view, target)

            if (matched) found.add(view)

            if ((matched && stopAtMatch) || depth >= maxDepth || view !is ViewGroup) continue

            for (index in 0 until view.childCount) queue.addLast(view.getChildAt(index) to depth + 1)
        }

        return found
    }
}
