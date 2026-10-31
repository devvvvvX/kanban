import React, { useState, useRef } from "react";
import { Globe, ArrowLeft, ArrowRight, RotateCw, ExternalLink, ShieldCheck } from "lucide-react";
import { openInDefaultBrowser } from "../../utils/linkHandler";

interface WebviewTabProps {
  url: string;
  title?: string;
}

function toEmbeddableUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.includes("/watch")) {
        const v = parsed.searchParams.get("v");
        const t = parsed.searchParams.get("t");
        if (v) {
          return `https://www.youtube-nocookie.com/embed/${v}${t ? `?start=${parseInt(t, 10)}` : ""}`;
        }
      } else if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.replace(/^\/shorts\//, "");
        if (id) {
          return `https://www.youtube-nocookie.com/embed/${id}`;
        }
      } else if (parsed.pathname.startsWith("/embed/")) {
        return rawUrl;
      }
    }
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "");
      const t = parsed.searchParams.get("t");
      if (id) {
        return `https://www.youtube-nocookie.com/embed/${id}${t ? `?start=${parseInt(t, 10)}` : ""}`;
      }
    }
  } catch {}
  return rawUrl;
}

export const WebviewTab: React.FC<WebviewTabProps> = ({ url, title }) => {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const embedUrl = React.useMemo(() => toEmbeddableUrl(currentUrl), [currentUrl]);

  React.useEffect(() => {
    setCurrentUrl(url);
    setInputUrl(url);
    setIsLoading(true);
  }, [url]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = `https://${target}`;
    }
    setCurrentUrl(target);
    setIsLoading(true);
  };

  const handleReload = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = embedUrl;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-app)",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Browser Navigation Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => window.history.back()}
          className="btn-ghost"
          style={{ width: "28px", height: "28px", padding: 0, borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>

        <button
          type="button"
          onClick={() => window.history.forward()}
          className="btn-ghost"
          style={{ width: "28px", height: "28px", padding: 0, borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}
          title="Forward"
        >
          <ArrowRight size={14} />
        </button>

        <button
          type="button"
          onClick={handleReload}
          className="btn-ghost"
          style={{ width: "28px", height: "28px", padding: 0, borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}
          title="Reload"
        >
          <RotateCw size={14} className={isLoading ? "spin-animation" : ""} />
        </button>

        {/* Address Bar */}
        <form
          onSubmit={handleNavigate}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "0 10px",
            height: "30px",
          }}
        >
          <Globe size={13} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontFamily: "var(--font-mono, monospace)",
            }}
            placeholder="https://..."
          />
          <ShieldCheck size={13} style={{ color: "var(--accent-green)", flexShrink: 0 }} />
        </form>

        {/* Open in external browser button */}
        <button
          type="button"
          onClick={() => openInDefaultBrowser(currentUrl)}
          className="btn-ghost"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            height: "28px",
            padding: "0 10px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
          }}
          title="Open in default system browser"
        >
          <ExternalLink size={13} />
          <span>Open in Browser</span>
        </button>
      </div>

      {/* Webview Content Container */}
      <div style={{ flex: 1, position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={title || "Web View"}
          onLoad={() => setIsLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: "#FFFFFF",
          }}
        />

        {/* Subtle helper note at bottom if frame loading is restricted */}
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "12px",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            pointerEvents: "auto",
            zIndex: 10,
          }}
        >
          <span>If page restricts in-app embedding:</span>
          <button
            type="button"
            onClick={() => openInDefaultBrowser(currentUrl)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent-blue)",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
              fontSize: "var(--text-xs)",
            }}
          >
            Open externally
          </button>
        </div>
      </div>
    </div>
  );
};
