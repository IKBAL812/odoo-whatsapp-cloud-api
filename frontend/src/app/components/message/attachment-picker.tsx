"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { Paperclip, X, File } from "@phosphor-icons/react";

type AttachmentPickerProps = {
  onAttachmentSelect: (file: File, caption: string) => void;
  disabled?: boolean;
  externalFile?: File | null;
  onExternalFileProcessed?: () => void;
};

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB limit (WhatsApp limit)

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function AttachmentPicker({
  onAttachmentSelect,
  disabled,
  externalFile,
  onExternalFileProcessed,
}: AttachmentPickerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle external file from drag and drop
  useEffect(() => {
    if (externalFile) {
      handleFileSelection(externalFile);
      onExternalFileProcessed?.();
    }
  }, [externalFile, onExternalFileProcessed]);

  const handleFileSelection = (file: File) => {
    setError(null);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`);
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    handleFileSelection(file);
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setCaption("");
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (!selectedFile) {
      return;
    }

    onAttachmentSelect(selectedFile, caption);
    handleCancel();
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        disabled={disabled}
      />

      {/* Attachment button */}
      {!selectedFile && (
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={disabled}
          className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] disabled:opacity-50 disabled:cursor-not-allowed p-2"
          title="Attach file"
        >
          <Paperclip className="size-5" weight="bold" />
        </button>
      )}

      {/* Preview modal */}
      {selectedFile && (
        <div
          className="fixed inset-0 bg-[rgb(var(--bg-overlay)/var(--bg-overlay-opacity))] flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
        >
          <div className="bg-[rgb(var(--bg-primary))] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border-primary)/var(--border-primary-opacity))]">
              <h3 className="text-[rgb(var(--text-primary))] font-semibold">
                Send Attachment
              </h3>
              <button
                onClick={handleCancel}
                className="text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))]"
              >
                <X className="size-6" weight="bold" />
              </button>
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {error && (
                <div className="bg-[rgb(var(--status-error)/0.2)] border border-[rgb(var(--status-error))] text-[rgb(var(--status-error))] px-4 py-2 rounded mb-4">
                  {error}
                </div>
              )}

              {previewUrl ? (
                <div className="flex justify-center mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={selectedFile.name}
                    className="max-h-96 object-contain rounded"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-[rgb(var(--bg-secondary)/var(--bg-secondary-opacity))] rounded-lg p-4 mb-4">
                  <File
                    className="size-12 text-[rgb(var(--text-secondary))]"
                    weight="fill"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[rgb(var(--text-primary))] text-sm truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] text-xs">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              )}

              {/* Caption input */}
              <div>
                <label className="text-[rgb(var(--text-secondary)/var(--text-tertiary-opacity))] text-sm mb-2 block">
                  Caption (optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full bg-[rgb(var(--bg-input)/var(--bg-input-opacity))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-secondary))] border border-[rgb(var(--border-primary)/var(--border-primary-opacity))] rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-primary))] resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-[rgb(var(--border-primary)/var(--border-primary-opacity))]">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="px-6 py-2 bg-[rgb(var(--accent-primary))] hover:bg-[rgb(var(--status-success))] text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!!error}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
