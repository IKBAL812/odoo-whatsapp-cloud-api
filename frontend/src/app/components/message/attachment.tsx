"use client";

import { Attachment, AttachmentType } from "@/app/context/chats-provider";
import {
  DownloadSimple,
  File,
  FileAudio,
  FileDoc,
  FilePdf,
  FileVideo,
  Image as ImageIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/app/hooks/use-auth";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

type AttachmentDisplayProps = {
  attachment: Attachment;
  messageId?: string;
};

const getAttachmentType = (mimetype: string): AttachmentType => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
};

const getFileIcon = (mimetype: string) => {
  if (mimetype === "application/pdf") {
    return (
      <FilePdf
        className="size-8 text-[rgb(var(--status-error))]"
        weight="fill"
      />
    );
  }
  if (mimetype.startsWith("audio/")) {
    return (
      <FileAudio
        className="size-8 text-[rgb(var(--status-info))]"
        weight="fill"
      />
    );
  }
  if (mimetype.startsWith("video/")) {
    return (
      <FileVideo
        className="size-8 text-[rgb(var(--status-info))]"
        weight="fill"
      />
    );
  }
  if (mimetype.includes("word") || mimetype.includes("document")) {
    return (
      <FileDoc
        className="size-8 text-[rgb(var(--status-info))]"
        weight="fill"
      />
    );
  }
  if (mimetype.startsWith("image/")) {
    return (
      <ImageIcon
        className="size-8 text-[rgb(var(--status-success))]"
        weight="fill"
      />
    );
  }
  return (
    <File className="size-8 text-[rgb(var(--text-secondary))]" weight="fill" />
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function AttachmentDisplay({
  attachment,
}: AttachmentDisplayProps) {
  const { sessionId } = useAuth();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const attachmentType =
    attachment.type ?? getAttachmentType(attachment.mimetype);

  useEffect(() => {
    // Set portal root to document.body for full-screen overlay
    if (typeof document !== "undefined") {
      setPortalRoot(document.body);
    }
  }, []);

  // Proxy through Next.js API to avoid CORS issues
  const downloadUrl = `/api/attachments/download?url=${encodeURIComponent(attachment.url)}&session_id=${sessionId}`;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Fetch through Next.js proxy
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: {
          "x-session-id": sessionId || "",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Download failed: ${response.status}`
        );
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (error) {
      alert(
        `Failed to download file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  // Image attachment
  if (attachmentType === "image") {
    return (
      <>
        <div
          className="relative max-w-sm cursor-pointer group"
          onClick={() => setIsLightboxOpen(true)}
        >
          {!isImageLoaded && !imageError && (
            <div className="w-full h-48 bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg animate-pulse flex items-center justify-center">
              <ImageIcon className="size-12 text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]" />
            </div>
          )}
          {imageError && (
            <div className="w-full h-48 bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg flex flex-col items-center justify-center gap-2">
              <ImageIcon className="size-12 text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))]" />
              <p className="text-xs text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))]">
                Failed to load image
              </p>
              <button
                onClick={handleDownload}
                className="text-xs text-[rgb(var(--accent-primary))] hover:text-[rgb(var(--accent-primary)/0.8)] flex items-center gap-1"
              >
                <DownloadSimple className="size-4" />
                Download
              </button>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl}
            alt={attachment.name}
            className={`rounded-lg max-h-96 object-contain ${!isImageLoaded ? "hidden" : "block"}`}
            onLoad={() => setIsImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {isImageLoaded && (
            <div className="absolute inset-0 bg-[rgb(var(--bg-primary)/0)] group-hover:bg-[rgb(var(--bg-primary)/0.2)] transition-colors rounded-lg flex items-center justify-center">
              <button
                onClick={handleDownload}
                className="opacity-0 group-hover:opacity-100 transition-opacity bg-[rgb(var(--bg-primary)/0.6)] text-white p-2 rounded-full"
              >
                <DownloadSimple className="size-5" weight="bold" />
              </button>
            </div>
          )}
        </div>

        {/* Lightbox - Portal to body for full-screen coverage */}
        {isLightboxOpen &&
          portalRoot &&
          createPortal(
            <div
              className="fixed inset-0 bg-[rgb(var(--bg-primary)/0.95)] flex items-center justify-center p-4"
              style={{ zIndex: 9999 }}
              onClick={() => setIsLightboxOpen(false)}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={downloadUrl}
                  alt={attachment.name}
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="absolute top-4 right-4 bg-[rgb(var(--bg-primary)/0.7)] text-[rgb(var(--text-primary))] px-4 py-2 rounded-lg hover:bg-[rgb(var(--bg-primary)/0.9)] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleDownload}
                  className="absolute bottom-4 right-4 bg-[rgb(var(--accent-primary))] text-white px-4 py-2 rounded-lg hover:bg-[rgb(var(--accent-primary)/0.8)] flex items-center gap-2 transition-colors"
                >
                  <DownloadSimple className="size-5" weight="bold" />
                  Download
                </button>
              </div>
            </div>,
            portalRoot
          )}
      </>
    );
  }

  // Video attachment
  if (attachmentType === "video") {
    return (
      <div className="relative max-w-sm">
        <video
          controls
          className="rounded-lg max-h-96 w-full bg-[rgb(var(--bg-primary))]"
          preload="metadata"
        >
          <source src={downloadUrl} type={attachment.mimetype} />
          Your browser does not support the video tag.
        </video>
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 bg-[rgb(var(--bg-primary)/0.6)] text-white p-2 rounded-full hover:bg-[rgb(var(--bg-primary)/0.8)]"
          title="Download video"
        >
          <DownloadSimple className="size-4" weight="bold" />
        </button>
      </div>
    );
  }

  // Audio attachment
  if (attachmentType === "audio") {
    return (
      <div className="bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg p-4 max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <FileAudio
            className="size-8 text-[rgb(var(--status-info))]"
            weight="fill"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[rgb(var(--text-primary))] text-sm truncate">
              {attachment.name}
            </p>
            <p className="text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] text-xs">
              {formatFileSize(attachment.file_size)}
            </p>
          </div>
        </div>
        <audio controls className="w-full">
          <source src={downloadUrl} type={attachment.mimetype} />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  // Document attachment
  return (
    <div className="bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg p-4 max-w-sm hover:bg-[rgb(var(--bg-secondary)/var(--bg-quaternary-opacity))] transition-colors">
      <div className="flex items-center gap-3">
        {getFileIcon(attachment.mimetype)}
        <div className="flex-1 min-w-0">
          <p className="text-[rgb(var(--text-primary))] text-sm truncate">
            {attachment.name}
          </p>
          <p className="text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] text-xs">
            {formatFileSize(attachment.file_size)}
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="text-[rgb(var(--accent-primary))] hover:text-[rgb(var(--accent-primary)/0.8)] p-2"
          title="Download file"
        >
          <DownloadSimple className="size-5" weight="bold" />
        </button>
      </div>
    </div>
  );
}
