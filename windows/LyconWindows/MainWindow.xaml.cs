using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json;
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

        // Keyboard-shortcut support (e.g. Ctrl+Shift+A to open the intelligence
        // panel → 'agents:openRequested') is not available via the WinUI 3
        // Window.KeyboardAccelerators API in the WindowsAppSDK 1.7 projection.
        // The event can still be triggered programmatically or via an
        // invoke('agents:openRequested') call routed through the bridge.

        // Restore window state
        var state = _dataService.LoadWindowState();
        if (state != null)
        {
            try
            {
                this.AppWindow.Resize(new Windows.Graphics.SizeInt32
                {
                    Width = (int)state.Width,
                    Height = (int)state.Height
                });
                if (state.X >= 0 && state.Y >= 0)
                {
                    this.AppWindow.Move(new Windows.Graphics.PointInt32(state.X, state.Y));
                }
                if (state.Maximized)
                {
                    var presenter = this.AppWindow.Presenter as OverlappedPresenter;
                    presenter?.Maximize();
                }
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

        // Initialise the shields service so ad-blocking / HTTPS-upgrades work.
        // Previously InitializeAsync was never awaited, leaving _loaded == false
        // and ShouldBlock() always returning false (shields effectively dead).
        await _shields.InitializeAsync();

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

    private void Core_DownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        // Route the download through Lycon's download manager
        // KnownFolders.Downloads is not projected by WindowsAppSDK 1.7; use the
        // user's Downloads folder directly via Environment.SpecialFolder.
        var downloadsFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
        if (!Directory.Exists(downloadsFolder))
            Directory.CreateDirectory(downloadsFolder);
        // WebView2 1.0.3405.78 no longer exposes ResultFileName/FileName directly
        // on the DownloadStarting event args; derive the filename from the URL.
        var downloadUrl = e.DownloadOperation.Uri ?? "";
        var filename = "";
        try { filename = Path.GetFileName(new Uri(downloadUrl).AbsolutePath); } catch { }
        if (string.IsNullOrWhiteSpace(filename))
            filename = "lycon-download.bin";
        var savePath = Path.Combine(downloadsFolder, Path.GetFileName(filename));

        var op = e.DownloadOperation;
        var record = new
        {
            id = Guid.NewGuid().ToString("N"),
            url = e.DownloadOperation.Uri ?? "",
            filename = Path.GetFileName(savePath),
            savePath,
            total = 0L,
            received = 0L,
            state = "progressing",
            startTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            @private = false,
        };
        _bridge.SendEvent("downloads:new", record);

        op.StateChanged += (s, _) =>
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

    // Event-handler delegates use `object sender` because the event args
    // types come from the WebView2 core namespace, not the XAML control
    // type. This keeps the handlers decoupled from the host control type
    // and avoids any dependency on colliding projections.

    private void BrowserWebView_NavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args)
    {
        // HTTPS-Only mode: upgrade http:// to https://
        if ((_dataService.LoadSettings().HttpsOnly ?? false) && args.Uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
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

    private void BrowserWebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        // Could update loading state here
    }

    private void BrowserWebView_WebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
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
            Width = this.AppWindow.ClientSize.Width,
            Height = this.AppWindow.ClientSize.Height,
            X = this.AppWindow.Position.X,
            Y = this.AppWindow.Position.Y,
            Maximized = (this.AppWindow.Presenter as OverlappedPresenter)?.State
                        == OverlappedPresenterState.Maximized,
        };
        _dataService.SaveWindowState(state);
    }

    /// <summary>
    /// Sends an event payload to the JS side via postMessage.
    /// </summary>
    public void SendEventToJs(string eventType, object? payload)
    {
        if (!_webviewReady) return;
        var json = JsonConvert.SerializeObject(new
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
    public void Minimize()
    {
        var presenter = this.AppWindow.Presenter as OverlappedPresenter;
        presenter?.Minimize();
    }

    /// <summary>Toggle maximize/restore.</summary>
    public void Maximize()
    {
        var presenter = this.AppWindow.Presenter as OverlappedPresenter;
        if (presenter == null) return;
        if (presenter.State == OverlappedPresenterState.Maximized)
            presenter.Restore();
        else
            presenter.Maximize();
    }
}

public class WindowState
{
    public double Width { get; set; } = 1280;
    public double Height { get; set; } = 800;
    public int X { get; set; } = -1;
    public int Y { get; set; } = -1;
    public bool Maximized { get; set; }
}
