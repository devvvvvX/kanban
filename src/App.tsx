import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { ProjectProvider } from "./context/ProjectContext";
import { TicketProvider } from "./context/TicketContext";
import { QueryProvider } from "./context/QueryContext";
import { TabProvider } from "./context/TabContext";
import { TodoProvider } from "./context/TodoContext";
import { FocusProvider } from "./context/FocusContext";
import { AppShell } from "./components/layout/AppShell";
import { AuthModal } from "./components/auth/AuthModal";

function KanbanAppContent() {
  const { user, isLoading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Disable default context menu (prevents browser reload menu in Tauri webview)
  // and intercept Cmd+R / Ctrl+R to trigger clean in-app data refresh instead of webview reload
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (!isTextInput) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "r") ||
        e.key === "F5"
      ) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("kanban:refresh"));
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--bg-app)",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
      }}>
        Initializing local secure workspace...
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <ProjectProvider>
        <TicketProvider>
          <TabProvider>
            <QueryProvider>
              <TodoProvider>
                <FocusProvider>
                  <AppShell onOpenAuth={() => setAuthModalOpen(true)} />
                  <AuthModal
                    key={user ? user.id : "logged-out"}
                    isOpen={authModalOpen || !user}
                    onClose={() => setAuthModalOpen(false)}
                  />
                </FocusProvider>
              </TodoProvider>
            </QueryProvider>
          </TabProvider>
        </TicketProvider>
      </ProjectProvider>
    </WorkspaceProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <KanbanAppContent />
    </AuthProvider>
  );
}

export default App;
