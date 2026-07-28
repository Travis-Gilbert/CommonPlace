import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useApp } from "./state/store";
import { Sidebar } from "./components/Sidebar";
import { Omnibox } from "./components/Omnibox";
import { WebviewStage } from "./components/WebviewStage";
import { ChatRail } from "./components/ChatRail";
import { Settings } from "./components/Settings";
import { isTauri } from "./lib/commands";

export default function App() {
  const { state, actions } = useApp();

  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen("pet:open-settings", () => {
      actions.openSettings(true);
      const window = getCurrentWindow();
      void window.show();
      void window.setFocus();
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [actions]);

  return (
    <div className="app">
      <div className={"shell" + (state.railVisible ? " shell--rail" : "")}>
        <Sidebar />
        <main className="main">
          <Omnibox />
          <WebviewStage />
        </main>
        {state.railVisible && <ChatRail />}
      </div>
      {state.settingsOpen && <Settings />}
    </div>
  );
}
