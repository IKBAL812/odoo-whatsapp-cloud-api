"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import { Paperclip, X, Image as ImageIcon, File } from "@phosphor-icons/react";

type AttachmentPickerProps = {
  onAttachmentSelect: (file: File, caption: string) => void;
  disabled?: boolean;
  externalFile?: File | null;
  onExternalFileProcessed?: () => void;
};

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB limit (WhatsApp limit)

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function AttachmentPicker({
  onAttachmentSelect,
  disabled,
  externalFile,
  onExternalFileProcessed
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
          className="text-white/60 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed p-2"
          title="Attach file"
        >
          <Paperclip className="size-5" weight="bold" />
        </button>
      )}

      {/* Preview modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Send Attachment</h3>
              <button
                onClick={handleCancel}
                className="text-white/60 hover:text-white"
              >
                <X className="size-6" weight="bold" />
              </button>
            </div>

            {/* Preview area */}
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
                  {error}
                </div>
              )}

              {previewUrl ? (
                <div className="flex justify-center mb-4">
                  <img
                    src={previewUrl}
                    alt={selectedFile.name}
                    className="max-h-96 object-contain rounded"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-4 mb-4">
                  <File className="size-12 text-gray-400" weight="fill" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{selectedFile.name}</p>
                    <p className="text-white/50 text-xs">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
              )}

              {/* Caption input */}
              <div>
                <label className="text-white/70 text-sm mb-2 block">
                  Caption (optional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="w-full bg-white/10 text-white placeholder-white/50 border border-white/20 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-white/70 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
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
