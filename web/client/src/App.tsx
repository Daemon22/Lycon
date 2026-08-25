import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LyconThemeProvider } from "./contexts/LyconThemeContext";
import Download from "./pages/Download";
import Home from "./pages/Home";
import Privacy from "./pages/Privacy";
import Security from "./pages/Security";

/** Lycon Browser: public routes share the native-matched theme and browser product vocabulary. */
export default function App() {
  return (
    <ErrorBoundary>
      <LyconThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/download" component={Download} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/security" component={Security} />
          </Switch>
        </TooltipProvider>
      </LyconThemeProvider>
    </ErrorBoundary>
  );
}
