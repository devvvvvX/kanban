import { useEffect, useState, useCallback } from "react";
import { syncBroadcaster, type SyncEvent } from "../lib/mcp/syncBroadcast";
import { useProject } from "../context/ProjectContext";
import { useTickets } from "../context/TicketContext";

export interface McpToastNotification {
  id: string;
  message: string;
  timestamp: number;
}

export function useMcpSync(userId?: string) {
  const { refreshProjects, refreshEpics } = useProject();
  const { refreshTickets, refreshStates, refreshSubtaskProgress } = useTickets();
  const [activeToast, setActiveToast] = useState<McpToastNotification | null>(null);

  const handleSyncEvent = useCallback(
    (event: SyncEvent) => {
      if (!userId || event.userId !== userId) return;

      // 1. Refresh application state based on entity
      if (event.entityType === "project") {
        refreshProjects();
      } else if (event.entityType === "ticket") {
        refreshTickets();
        refreshStates();
        refreshSubtaskProgress();
      } else {
        refreshProjects();
        refreshTickets();
      }

      // 2. Generate user-friendly toast message
      let message = "🤖 MCP Agent modified workspace";
      if (event.eventType === "ticket_created") {
        const iden = event.payload?.identifier ? `${event.payload.identifier}: ` : "";
        message = `🤖 Agent created ticket ${iden}${event.payload?.title || ""}`;
      } else if (event.eventType === "ticket_updated") {
        const iden = event.payload?.identifier || "ticket";
        message = `🤖 Agent updated ${iden}`;
      } else if (event.eventType === "ticket_moved") {
        const iden = event.payload?.identifier || "ticket";
        message = `🤖 Agent moved ${iden} across workflow`;
      } else if (event.eventType === "project_created") {
        message = `🤖 Agent created project "${event.payload?.name || ""}"`;
      }

      const toast: McpToastNotification = {
        id: event.id || crypto.randomUUID(),
        message,
        timestamp: Date.now(),
      };

      setActiveToast(toast);

      // Auto dismiss after 4.5 seconds
      setTimeout(() => {
        setActiveToast((current) => (current?.id === toast.id ? null : current));
      }, 4500);
    },
    [userId, refreshProjects, refreshEpics, refreshTickets, refreshStates, refreshSubtaskProgress]
  );

  useEffect(() => {
    if (!userId) return;

    // 1. In-process and BroadcastChannel subscriber
    const unsubBroadcast = syncBroadcaster.subscribe(handleSyncEvent);

    // 2. SQLite polling listener for external process mutations (stdio MCP server)
    const unsubPoller = syncBroadcaster.startPoller(userId, handleSyncEvent, 1500);

    return () => {
      unsubBroadcast();
      unsubPoller();
    };
  }, [userId, handleSyncEvent]);

  return { activeToast, dismissToast: () => setActiveToast(null) };
}
