using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace LyconWindows;

/// <summary>
/// Lycon Shields — URL-based ad/tracker blocker for WebView2.
///
/// Uses a simplified EasyList parser: each rule is either a domain-anchor
/// pattern or a regex. Rules are loaded from a cached copy of EasyList
/// stored under %LOCALAPPDATA%\Lycon\lycon-data\easylist.txt.
/// </summary>
public class LyconShieldsService
{
    private readonly string _filterListPath;
    private readonly List<BlockRule> _rules = new();
    private bool _loaded;

    public bool IsEnabled { get; set; } = true;
    public int TotalBlocked { get; private set; }

    public LyconShieldsService()
    {
        var dataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Lycon", "lycon-data");
        Directory.CreateDirectory(dataDir);
        _filterListPath = Path.Combine(dataDir, "easylist.txt");
    }

    /// <summary>
    /// Loads (or downloads) the EasyList filter rules.
    /// Safe to call multiple times.
    /// </summary>
    public async Task InitializeAsync()
    {
        if (_loaded) return;
        try
        {
            if (!File.Exists(_filterListPath) || new FileInfo(_filterListPath).Length < 10000)
            {
                await DownloadFilterListAsync();
            }
            ParseFilterList(File.ReadAllText(_filterListPath));
            _loaded = true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Lycon Shields] init failed: {ex.Message}");
            _loaded = false;
        }
    }

    private async Task DownloadFilterListAsync()
    {
        using var http = new HttpClient();
        http.Timeout = TimeSpan.FromSeconds(30);
        var text = await http.GetStringAsync("https://easylist.to/easylist/easylist.txt");
        await File.WriteAllTextAsync(_filterListPath, text);
    }

    private void ParseFilterList(string text)
    {
        foreach (var line in text.Split('\n'))
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("!") || trimmed.StartsWith("["))
                continue;
            // Skip element-hiding rules (##) — those need cosmetic filtering, not URL blocking
            if (trimmed.Contains("##")) continue;
            // Skip exception rules (@@) for now
            if (trimmed.StartsWith("@@")) continue;

            try
            {
                var rule = BlockRule.Parse(trimmed);
                if (rule != null) _rules.Add(rule);
            }
            catch { /* skip invalid rules */ }
        }
        System.Diagnostics.Debug.WriteLine($"[Lycon Shields] loaded {_rules.Count} rules");
    }

    /// <summary>
    /// Returns true if the given URL should be blocked.
    /// </summary>
    public bool ShouldBlock(string url)
    {
        if (!_loaded || string.IsNullOrEmpty(url)) return false;
        // Don't block the Lycon UI itself
        if (url.StartsWith("https://lycon.app/") || url.StartsWith("about:")) return false;
        foreach (var rule in _rules)
        {
            if (rule.Matches(url)) return true;
        }
        return false;
    }

    public void IncrementBlockedCount() => TotalBlocked++;
}

/// <summary>
/// A single URL-blocking rule parsed from EasyList syntax.
/// Supports: plain substring, domain||pattern, regex /pattern/.
/// </summary>
public class BlockRule
{
    private readonly Regex? _regex;
    private readonly string _substring;
    private readonly string? _domainAnchor;

    private BlockRule(Regex? regex, string substring, string? domainAnchor)
    {
        _regex = regex;
        _substring = substring;
        _domainAnchor = domainAnchor;
    }

    public static BlockRule? Parse(string rule)
    {
        // Domain anchor: ||example.com^
        if (rule.StartsWith("||"))
        {
            var rest = rule.Substring(2).TrimEnd('^', '*', '|');
            // Strip any path/regex chars
            var domain = rest.Split('/', '^', '*', '|')[0];
            if (string.IsNullOrEmpty(domain)) return null;
            return new BlockRule(null, domain, domain);
        }
        // Regex: /pattern/
        if (rule.StartsWith("/") && rule.EndsWith("/") && rule.Length > 2)
        {
            try
            {
                var pattern = rule.Substring(1, rule.Length - 2);
                return new BlockRule(new Regex(pattern, RegexOptions.IgnoreCase), "", null);
            }
            catch { return null; }
        }
        // Plain substring (skip if too short or contains weird chars)
        if (rule.Length < 4) return null;
        if (rule.Any(c => char.IsWhiteSpace(c))) return null;
        return new BlockRule(null, rule, null);
    }

    public bool Matches(string url)
    {
        if (_regex != null) return _regex.IsMatch(url);
        if (_domainAnchor != null)
        {
            // Match the domain part of the URL
            try
            {
                var uri = new Uri(url);
                if (uri.Host.EndsWith(_domainAnchor, StringComparison.OrdinalIgnoreCase)) return true;
                if (url.Contains(_domainAnchor, StringComparison.OrdinalIgnoreCase)) return true;
                return false;
            }
            catch
            {
                return url.Contains(_domainAnchor, StringComparison.OrdinalIgnoreCase);
            }
        }
        return url.Contains(_substring, StringComparison.OrdinalIgnoreCase);
    }
}
