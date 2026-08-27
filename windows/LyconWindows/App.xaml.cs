using Microsoft.UI.Xaml;

namespace LyconWindows;

/// <summary>
/// Entry point for the Lycon Windows app.
/// </summary>
public partial class App : Application
{
    private Window? _mainWindow;

    public App()
    {
        this.InitializeComponent();
    }

    /// <summary>
    /// The active main window (singleton for this app instance).
    /// </summary>
    public static new App Current => (App)Application.Current;

    public MainWindow? MainWindow => _mainWindow as MainWindow;

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _mainWindow = new MainWindow();
        _mainWindow.Activate();
    }
}
