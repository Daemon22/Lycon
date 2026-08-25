package com.lycon.browser

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/**
 * JSON-file persistence for bookmarks, history, settings, downloads.
 *
 * All files live under /data/data/com.lycon.browser/files/lycon-data/
 * (returned by context.filesDir).
 */
class LyconDataService(private val context: Context) {

    private val dataDir = File(context.filesDir, "lycon-data").apply { mkdirs() }
    private val bookmarksFile = File(dataDir, "bookmarks.json")
    private val historyFile = File(dataDir, "history.json")
    private val settingsFile = File(dataDir, "settings.json")
    private val downloadsFile = File(dataDir, "downloads.json")

    // ----- Settings -----

    fun loadSettings(): JSONObject {
        val defaults = JSONObject().apply {
            put("theme", "dark")
            put("accent", "orange")
            put("searchEngine", "duckduckgo")
            put("shieldsEnabled", true)
            put("startupPage", "startpage")
            put("privateTabDefault", false)
            put("httpsOnly", true)
            put("sensitivity", "balanced")
            put("agentDefaultConnectorId", "")
        }
        if (!settingsFile.exists()) return defaults
        return try {
            val saved = JSONObject(settingsFile.readText())
            // Merge saved over defaults (defaults win for missing keys)
            for (key in defaults.keys()) {
                if (!saved.has(key)) saved.put(key, defaults.get(key))
            }
            saved
        } catch (e: Exception) {
            defaults
        }
    }

    fun updateSettings(patch: JSONObject): JSONObject {
        val current = loadSettings()
        for (key in patch.keys()) {
            current.put(key, patch.get(key))
        }
        settingsFile.writeText(current.toString(2))
        return current
    }

    // ----- Bookmarks -----

    fun listBookmarks(): JSONArray {
        if (!bookmarksFile.exists()) return JSONArray()
        return try { JSONArray(bookmarksFile.readText()) } catch (e: Exception) { JSONArray() }
    }

    fun addBookmark(bm: JSONObject): JSONArray {
        val list = listBookmarks()
        // Dedupe by URL
        val existing = (0 until list.length()).firstOrNull {
            list.getJSONObject(it).optString("url") == bm.optString("url")
        }
        if (existing == null) {
            bm.put("id", UUID.randomUUID().toString())
            bm.put("addedAt", System.currentTimeMillis())
            list.put(bm)
            bookmarksFile.writeText(list.toString())
        }
        return list
    }

    fun removeBookmark(id: String): JSONArray {
        val list = listBookmarks()
        val newList = JSONArray()
        for (i in 0 until list.length()) {
            val b = list.getJSONObject(i)
            if (b.optString("id") != id) newList.put(b)
        }
        bookmarksFile.writeText(newList.toString())
        return newList
    }

    // ----- History -----

    fun listHistory(): JSONArray {
        if (!historyFile.exists()) return JSONArray()
        return try { JSONArray(historyFile.readText()) } catch (e: Exception) { JSONArray() }
    }

    fun addHistory(entry: JSONObject): JSONArray {
        val list = listHistory()
        // Dedupe consecutive
        if (list.length() > 0) {
            val first = list.getJSONObject(0)
            if (first.optString("url") == entry.optString("url")) {
                first.put("visitedAt", entry.optLong("visitedAt"))
                if (!entry.optString("title").isNullOrEmpty()) first.put("title", entry.getString("title"))
                historyFile.writeText(list.toString())
                return list
            }
        }
        entry.put("id", UUID.randomUUID().toString())
        // Insert at front
        val newList = JSONArray()
        newList.put(entry)
        for (i in 0 until minOf(list.length(), 1999)) {
            newList.put(list.get(i))
        }
        historyFile.writeText(newList.toString())
        return newList
    }

    fun removeHistory(id: String): JSONArray {
        val list = listHistory()
        val newList = JSONArray()
        for (i in 0 until list.length()) {
            val h = list.getJSONObject(i)
            if (h.optString("id") != id) newList.put(h)
        }
        historyFile.writeText(newList.toString())
        return newList
    }

    fun clearHistory() {
        historyFile.writeText("[]")
    }

    // ----- Downloads -----

    fun listDownloads(): JSONArray {
        if (!downloadsFile.exists()) return JSONArray()
        return try { JSONArray(downloadsFile.readText()) } catch (e: Exception) { JSONArray() }
    }

    fun addDownload(record: JSONObject) {
        val list = listDownloads()
        // Insert at front, cap at 100
        val newList = JSONArray().put(record)
        for (i in 0 until minOf(list.length(), 99)) newList.put(list.get(i))
        downloadsFile.writeText(newList.toString())
    }

    fun clearDownloads() {
        downloadsFile.writeText("[]")
    }

    companion object {
        const val TAG = "LyconData"
    }
}
