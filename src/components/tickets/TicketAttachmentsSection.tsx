import React, { useState, useEffect, useRef } from "react";
import { Paperclip, Image as ImageIcon, Video, Trash2, Copy, Check, X, Upload, Maximize2 } from "lucide-react";
import { AttachmentService, type TicketAttachment } from "../../lib/tickets/attachmentService";
import { useAuth } from "../../context/AuthContext";

export interface TicketAttachmentsSectionProps {
  ticketId: string;
}

export function TicketAttachmentsSection({ ticketId }: TicketAttachmentsSectionProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<TicketAttachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachmentService = React.useMemo(() => new AttachmentService(), []);

  const loadAttachments = React.useCallback(() => {
    if (!user) return;
    try {
      const list = attachmentService.listAttachments(ticketId, user.id);
      setAttachments(list);
    } catch (err) {
      console.error("Failed to load attachments:", err);
    }
  }, [attachmentService, ticketId, user]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        try {
          attachmentService.addAttachment(
            {
              ticketId,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              dataUrl,
            },
            user.id
          );
          loadAttachments();
        } catch (err) {
          console.error("Failed to add attachment:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      handleFiles(e.clipboardData.files);
    }
  };

  const handleDelete = (id: string) => {
    if (!user) return;
    try {
      attachmentService.deleteAttachment(id, user.id);
      loadAttachments();
      if (previewMedia?.id === id) setPreviewMedia(null);
    } catch (err) {
      console.error("Failed to delete attachment:", err);
    }
  };

  const handleCopyMarkdown = (att: TicketAttachment) => {
    const md = `![${att.file_name}](${att.data_url})`;
    navigator.clipboard.writeText(md).then(() => {
      setCopiedId(att.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      data-testid="ticket-attachments-section"
      onPaste={handlePaste}
      tabIndex={0}
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        outline: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Paperclip size={14} color="var(--accent-blue)" />
          <h3
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 700,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: 0,
            }}
          >
            Attachments {attachments.length > 0 && `(${attachments.length})`}
          </h3>
        </div>

        <button
          type="button"
          data-testid="upload-attachment-btn"
          className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          style={{ height: "26px", fontSize: "var(--text-xs)", gap: "4px", padding: "0 8px" }}
        >
          <Upload size={12} />
          <span>Upload Media</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            if (e.target) e.target.value = "";
          }}
        />
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: isDragging ? "2px dashed var(--accent-blue)" : "1px dashed var(--border-subtle)",
          backgroundColor: isDragging ? "var(--accent-blue-subtle)" : "var(--bg-app)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "var(--text-xs)",
          cursor: "pointer",
          marginBottom: attachments.length > 0 ? "var(--space-4)" : 0,
          transition: "all var(--transition-fast)",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <ImageIcon size={14} />
          <span>Drag & drop images or videos here, or paste (Cmd+V)</span>
        </div>
      </div>

      {/* Attachments Grid */}
      {attachments.length > 0 && (
        <div
          data-testid="attachments-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "10px",
          }}
        >
          {attachments.map((att) => {
            const isVideo = att.file_type.startsWith("video/");
            return (
              <div
                key={att.id}
                data-testid={`attachment-card-${att.id}`}
                style={{
                  position: "relative",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-card)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all var(--transition-fast)",
                }}
              >
                {/* Media Preview Box */}
                <div
                  style={{
                    height: "90px",
                    backgroundColor: "#0F172A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative",
                  }}
                  onClick={() => setPreviewMedia(att)}
                >
                  {isVideo ? (
                    <video
                      src={att.data_url}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <img
                      src={att.data_url}
                      alt={att.file_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}

                  {isVideo && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.3)",
                      }}
                    >
                      <Video size={20} color="#FFFFFF" />
                    </div>
                  )}

                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      borderRadius: "var(--radius-sm)",
                      padding: "2px",
                      color: "#FFFFFF",
                      display: "flex",
                    }}
                  >
                    <Maximize2 size={11} />
                  </div>
                </div>

                {/* Footer Info & Actions */}
                <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={att.file_name}
                  >
                    {att.file_name}
                  </span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    {formatFileSize(att.file_size)}
                  </span>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", marginTop: "4px" }}>
                    <button
                      type="button"
                      data-testid={`copy-md-${att.id}`}
                      className="btn-ghost"
                      style={{ height: "22px", padding: "0 4px", fontSize: "var(--text-xs)" }}
                      onClick={() => handleCopyMarkdown(att)}
                      title="Copy Markdown embed link"
                    >
                      {copiedId === att.id ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-att-${att.id}`}
                      className="btn-ghost"
                      style={{ height: "22px", padding: "0 4px", fontSize: "var(--text-xs)", color: "var(--color-danger)" }}
                      onClick={() => handleDelete(att.id)}
                      title="Delete attachment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Media Modal */}
      {previewMedia && (
        <div
          data-testid="media-lightbox"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={() => setPreviewMedia(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                color: "#FFFFFF",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{previewMedia.file_name}</span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPreviewMedia(null)}
                style={{ color: "#FFFFFF" }}
              >
                <X size={18} />
              </button>
            </div>

            {previewMedia.file_type.startsWith("video/") ? (
              <video
                data-testid="lightbox-video"
                src={previewMedia.data_url}
                controls
                autoPlay
                style={{ maxWidth: "85vw", maxHeight: "75vh", borderRadius: "var(--radius-md)" }}
              />
            ) : (
              <img
                data-testid="lightbox-image"
                src={previewMedia.data_url}
                alt={previewMedia.file_name}
                style={{ maxWidth: "85vw", maxHeight: "75vh", objectFit: "contain", borderRadius: "var(--radius-md)" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
