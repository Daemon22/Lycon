using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using Windows.Storage;

namespace LyconWindows;

/// <summary>
/// Main window hosts a WebView2 control that loads the shared Lycon UI bundle.
/// All native functionality is exposed to JS via a script-bridge pattern.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly LyconDataService _dataService;
    private readonly LyconBridge _bridge;
    private readonly LyconShieldsService _shields;
    private bool _webviewReady;

    public MainWindow()
    {
        this.InitializeComponent();

        // Persist data in %LOCALAPPDATA%\Lycon\lycon-data\
        var dataDir = Path.Combine(
            ApplicationData.Current.LocalFolder.Path,
            "lycon-data");
        Directory.CreateDirectory(dataDir);

        _dataService = new LyconDataService(dataDir);
        _shields = new LyconShieldsService();
        _bridge = new LyconBridge(_dataService, _shields, this);

        // Restore window state
        var state = _dataService.LoadWindowState();
        if (state != null)
        {
            try
            {
                this.Width = state.Width;
                this.Height = state.Height;
                if (state.X >= 0 && state.Y >= 0)
                {
                    var pos = this.AppWindow;
                    pos.Move(new Windows.Graphics.PointInt32(state.X, state.Y));
                }
                if (state.Maximized) this.Presenter.Maximize();
            }
            catch { /* ignore restore errors */ }
        }

        // Save window state on close
        this.Closed += MainWindow_Closed;

        _ = InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        await BrowserWebView.EnsureCoreWebView2Async();

        var core = BrowserWebView.CoreWebView2;
        core.Settings.AreDevToolsEnabled = true;
        core.Settings.AreDefaultContextMenusEnabled = true;
        core.Settings.IsStatusBarEnabled = true;
        core.Settings.AreBrowserAcceleratorKeysEnabled = true;

        // Set up download handling
        core.DownloadStarting += Core_DownloadStarting;

        // Set up popup handling — open new windows as new tabs within Lycon
        core.NewWindowRequested += Core_NewWindowRequested;

        // Inject the native bridge script BEFORE any page scripts run
        var bridgeScript = _bridge.GetBridgeInitScript();
        await core.AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript);

        // Load the shared Lycon UI bundle (index.html in Assets/lycon-ui/)
        var uiPath = Path.Combine(AppContext.BaseDirectory, "Assets", "lycon-ui", "index.html");
        core.SetVirtualHostNameToFolderMapping(
            "lycon.app",
            Path.Combine(AppContext.BaseDirectory, "Assets", "lycon-ui"),
            CoreWebView2HostResourceAccessKind.Allow);
        core.Navigate("https://lycon.app/index.html");

        _webviewReady = true;
    }

    private void Core_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        // Tell the renderer to open the URL in a new tab
        _bridge.SendEvent("tabs:openRequested", new { url = e.Uri });
        e.Handled = true;
    }

    private async void Core_DownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        // Route the download through Lycon's download manager
        var downloadsFolder = KnownFolders.Downloads.Path;
        var filename = e.ResultFileName;
        if (string.IsNullOrWhiteSpace(filename) || Path.GetFileName(filename) == "")
            filename = "lycon-download.bin";
        var savePath = Path.Combine(downloadsFolder, Path.GetFileName(filename));

        var op = e.DownloadOperation;
        var record = new
        {
            id = Guid.NewGuid().ToString("N"),
            url = e.Uri ?? "",
            filename = Path.GetFileName(savePath),
            savePath,
            total = 0L,
            received = 0L,
            state = "progressing",
            startTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            @private = false,
        };
        _bridge.SendEvent("downloads:new", record);

        op.StateChanged += async (s, _) =>
        {
            var state = s.State switch
            {
                CoreWebView2DownloadState.InProgress => "progressing",
                CoreWebView2DownloadState.Completed => "completed",
                CoreWebView2DownloadState.Interrupted => "interrupted",
                _ => "progressing",
            };
            var updated = new
            {
                record.id,
                record.url,
                record.filename,
                record.savePath,
                total = s.TotalBytesToReceive,
                received = s.BytesReceived,
                state,
                record.startTime,
                endTime = state != "progressing" ? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() : 0L,
                record.@private,
            };
            _bridge.SendEvent("downloads:progress", updated);
            if (state != "progressing")
            {
                _bridge.SendEvent("downloads:done", updated);
                _dataService.AddDownload(updated);
            }
        };
    }

    private void BrowserWebView_NavigationStarting(WebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationStartingEventArgs args)
    {
        // HTTPS-Only mode: upgrade http:// to https://
        if (_dataService.LoadSettings().HttpsOnly && args.Uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var uri = new Uri(args.Uri);
                if (uri.Host != "localhost" && uri.Host != "127.0.0.1")
                {
                    args.Cancel = true;
                    var upgraded = "https://" + args.Uri.Substring(7);
                    _bridge.SendEvent("https:upgraded", new { from = args.Uri, to = upgraded });
                    BrowserWebView.CoreWebView2.Navigate(upgraded);
                    return;
                }
            }
            catch { /* ignore malformed */ }
        }

        // Ad blocker — check URL against filter
        if (_shields.IsEnabled && _shields.ShouldBlock(args.Uri))
        {
            args.Cancel = true;
            _shields.IncrementBlockedCount();
            _bridge.SendEvent("shields:blocked", new
            {
                url = args.Uri,
                tabId = 0, // WebView2 doesn't have per-tab IDs in this single-webview model
                @private = false,
                filter = "easylist",
            });
        }
    }

    private void BrowserWebView_NavigationCompleted(WebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2NavigationCompletedEventArgs args)
    {
        // Could update loading state here
    }

    private void BrowserWebView_WebMessageReceived(WebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs args)
    {
        // Messages from JS arrive here. The bridge script in __lyconNative
        // posts messages for invoke() calls; we route them to the bridge.
        try
        {
            var json = args.TryGetWebMessageAsString();
            _bridge.HandleMessageFromJs(json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Lycon] WebMessage receive error: {ex.Message}");
        }
    }

    private void MainWindow_Closed(object sender, WindowEventArgs args)
    {
        var state = new WindowState
        {
            Width = this.Width,
            Height = this.Height,
            X = this.AppWindow.Position.X,
            Y = this.AppWindow.Position.Y,
            Maximized = false, // TODO: detect maximize state
        };
        _dataService.SaveWindowState(state);
    }

    /// <summary>
    /// Sends an event payload to the JS side via postMessage.
    /// </summary>
    public void SendEventToJs(string eventType, object payload)
    {
        if (!_webviewReady) return;
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            type = "lycon:event",
            @event = eventType,
            payload,
        });
        BrowserWebView.CoreWebView2.PostWebMessageAsJson(json);
    }

    /// <summary>
    /// Sends a raw JSON message to the JS side (used for invoke responses).
    /// </summary>
    public void SendEventToJsRaw(string json)
    {
        if (!_webviewReady) return;
        BrowserWebView.CoreWebView2.PostWebMessageAsJson(json);
    }

    /// <summary>Minimize the window.</summary>
    public void Minimize() => this.Presenter.Minimize();

    /// <summary>Toggle maximize/restore.</summary>
    public void Maximize()
    {
        if (this.Presenter.Kind == Microsoft.UI.Windowing.OverlappedPresenterKind.Maximized)
            this.Presenter.Restore();
        else
            this.Presenter.Maximize();
    }
}

internal class WindowState
{
    public double Width { get; set; } = 1280;
    public double Height { get; set; } = 820;
    public int X { get; set; } = -1;
    public int Y { get; set; } = -1;
    public bool Maximized { get; set; }
}
