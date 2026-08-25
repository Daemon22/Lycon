using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace LyconWindows;

/// <summary>
/// Handles JSON persistence for bookmarks, history, settings, downloads, and window state.
/// All files live under %LOCALAPPDATA%\Lycon\lycon-data\.
/// </summary>
public class LyconDataService
{
    private readonly string _dataDir;
    private readonly string _bookmarksFile;
    private readonly string _historyFile;
    private readonly string _settingsFile;
    private readonly string _downloadsFile;
    private readonly string _windowStateFile;

    private LyconSettings? _cachedSettings;

    public LyconDataService(string dataDir)
    {
        _dataDir = dataDir;
        Directory.CreateDirectory(dataDir);
        _bookmarksFile = Path.Combine(dataDir, "bookmarks.json");
        _historyFile = Path.Combine(dataDir, "history.json");
        _settingsFile = Path.Combine(dataDir, "settings.json");
        _downloadsFile = Path.Combine(dataDir, "downloads.json");
        _windowStateFile = Path.Combine(dataDir, "window-state.json");
    }

    // ----- Settings -----

    public LyconSettings LoadSettings()
    {
        if (_cachedSettings != null) return _cachedSettings;
        try
        {
            if (File.Exists(_settingsFile))
            {
                var json = File.ReadAllText(_settingsFile);
                _cachedSettings = JsonConvert.DeserializeObject<LyconSettings>(json) ?? DefaultSettings();
            }
            else
            {
                _cachedSettings = DefaultSettings();
            }
        }
        catch
        {
            _cachedSettings = DefaultSettings();
        }
        return _cachedSettings;
    }

    public LyconSettings SaveSettings(LyconSettings settings)
    {
        _cachedSettings = settings;
        File.WriteAllText(_settingsFile, JsonConvert.SerializeObject(settings, Formatting.Indented));
        return settings;
    }

    public LyconSettings UpdateSettings(LyconSettings patch)
    {
        var current = LoadSettings();
        // Merge patch into current (only set non-null properties)
        if (patch.Theme != null) current.Theme = patch.Theme;
        if (patch.Accent != null) current.Accent = patch.Accent;
        if (patch.SearchEngine != null) current.SearchEngine = patch.SearchEngine;
        if (patch.ShieldsEnabled.HasValue) current.ShieldsEnabled = patch.ShieldsEnabled.Value;
        if (patch.StartupPage != null) current.StartupPage = patch.StartupPage;
        if (patch.PrivateTabDefault.HasValue) current.PrivateTabDefault = patch.PrivateTabDefault.Value;
        if (patch.HttpsOnly.HasValue) current.HttpsOnly = patch.HttpsOnly.Value;
        return SaveSettings(current);
    }

    private static LyconSettings DefaultSettings() => new LyconSettings
    {
        Theme = "dark",
        Accent = "orange",
        SearchEngine = "duckduckgo",
        ShieldsEnabled = true,
        StartupPage = "startpage",
        PrivateTabDefault = false,
        HttpsOnly = true,
    };

    // ----- Bookmarks -----

    public List<LyconBookmark> LoadBookmarks()
    {
        try
        {
            if (File.Exists(_bookmarksFile))
                return JsonConvert.DeserializeObject<List<LyconBookmark>>(File.ReadAllText(_bookmarksFile)) ?? new();
        }
        catch { }
        return new List<LyconBookmark>();
    }

    public List<LyconBookmark> AddBookmark(LyconBookmark bm)
    {
        var list = LoadBookmarks();
        if (!list.Exists(b => b.Url == bm.Url))
        {
            bm.Id = Guid.NewGuid().ToString("N");
            bm.AddedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            list.Add(bm);
            SaveBookmarks(list);
        }
        return list;
    }

    public List<LyconBookmark> RemoveBookmark(string id)
    {
        var list = LoadBookmarks();
        list.RemoveAll(b => b.Id == id);
        SaveBookmarks(list);
        return list;
    }

    private void SaveBookmarks(List<LyconBookmark> list) =>
        File.WriteAllText(_bookmarksFile, JsonConvert.SerializeObject(list, Formatting.Indented));

    // ----- History -----

    public List<LyconHistoryEntry> LoadHistory()
    {
        try
        {
            if (File.Exists(_historyFile))
            {
                var list = JsonConvert.DeserializeObject<List<LyconHistoryEntry>>(File.ReadAllText(_historyFile)) ?? new();
                // Cap at 2000 entries
                if (list.Count > 2000) list = list.GetRange(0, 2000);
                return list;
            }
        }
        catch { }
        return new List<LyconHistoryEntry>();
    }

    public List<LyconHistoryEntry> AddHistory(LyconHistoryEntry entry)
    {
        var list = LoadHistory();
        // Dedupe consecutive
        if (list.Count > 0 && list[0].Url == entry.Url)
        {
            list[0].VisitedAt = entry.VisitedAt;
            if (!string.IsNullOrEmpty(entry.Title)) list[0].Title = entry.Title;
        }
        else
        {
            entry.Id = Guid.NewGuid().ToString("N");
            list.Insert(0, entry);
            if (list.Count > 2000) list = list.GetRange(0, 2000);
        }
        SaveHistory(list);
        return list;
    }

    public List<LyconHistoryEntry> RemoveHistory(string id)
    {
        var list = LoadHistory();
        list.RemoveAll(h => h.Id == id);
        SaveHistory(list);
        return list;
    }

    public void ClearHistory()
    {
        File.WriteAllText(_historyFile, "[]");
    }

    private void SaveHistory(List<LyconHistoryEntry> list) =>
        File.WriteAllText(_historyFile, JsonConvert.SerializeObject(list, Formatting.Indented));

    // ----- Downloads -----

    public List<dynamic> LoadDownloads()
    {
        try
        {
            if (File.Exists(_downloadsFile))
                return JsonConvert.DeserializeObject<List<dynamic>>(File.ReadAllText(_downloadsFile)) ?? new();
        }
        catch { }
        return new List<dynamic>();
    }

    public void AddDownload(dynamic record)
    {
        var list = LoadDownloads();
        list.Insert(0, record);
        if (list.Count > 100) list = list.GetRange(0, 100);
        File.WriteAllText(_downloadsFile, JsonConvert.SerializeObject(list, Formatting.Indented));
    }

    public void ClearDownloads() => File.WriteAllText(_downloadsFile, "[]");

    // ----- Window state -----

    public WindowState? LoadWindowState()
    {
        try
        {
            if (File.Exists(_windowStateFile))
                return JsonConvert.DeserializeObject<WindowState>(File.ReadAllText(_windowStateFile));
        }
        catch { }
        return null;
    }

    public void SaveWindowState(WindowState state) =>
        File.WriteAllText(_windowStateFile, JsonConvert.SerializeObject(state, Formatting.Indented));
}

// ----- Data classes -----

public class LyconSettings
{
    [JsonProperty("theme")] public string Theme { get; set; } = "dark";
    [JsonProperty("accent")] public string Accent { get; set; } = "orange";
    [JsonProperty("searchEngine")] public string SearchEngine { get; set; } = "duckduckgo";
    [JsonProperty("shieldsEnabled")] public bool ShieldsEnabled { get; set; } = true;
    [JsonProperty("startupPage")] public string StartupPage { get; set; } = "startpage";
    [JsonProperty("privateTabDefault")] public bool? PrivateTabDefault { get; set; } = false;
    [JsonProperty("httpsOnly")] public bool? HttpsOnly { get; set; } = true;
}

public class LyconBookmark
{
    [JsonProperty("id")] public string Id { get; set; } = "";
    [JsonProperty("url")] public string Url { get; set; } = "";
    [JsonProperty("title")] public string Title { get; set; } = "";
    [JsonProperty("favicon")] public string? Favicon { get; set; }
    [JsonProperty("addedAt")] public long AddedAt { get; set; }
}

public class LyconHistoryEntry
{
    [JsonProperty("id")] public string Id { get; set; } = "";
    [JsonProperty("url")] public string Url { get; set; } = "";
    [JsonProperty("title")] public string Title { get; set; } = "";
    [JsonProperty("visitedAt")] public long VisitedAt { get; set; }
}
