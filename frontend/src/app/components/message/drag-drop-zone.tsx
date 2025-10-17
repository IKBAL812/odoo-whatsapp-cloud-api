"use client";

import { useState, useCallback, DragEvent, ReactNode, useRef } from "react";
import { Upload } from "@phosphor-icons/react";

type DragDropZoneProps = {
  onFilesDrop: (files: File[]) => void;
  children: ReactNode;
  disabled?: boolean;
};

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB limit

export default function DragDropZone({
  onFilesDrop,
  children,
  disabled,
}: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Check if dragged items contain files
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        dragCounterRef.current += 1;
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Show copy cursor
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setIsDragging(false);
      dragCounterRef.current = 0;

      // Get files from drop
      const files = Array.from(e.dataTransfer.files);

      if (files.length === 0) {
        return;
      }

      // Filter valid files (media files only, within size limit)
      const validFiles = files.filter((file) => {
        const isValidType =
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          file.type.startsWith("audio/") ||
          file.type === "application/pdf" ||
          file.type.includes("document") ||
          file.type.includes("word") ||
          file.type.includes("sheet") ||
          file.type.includes("presentation") ||
          file.type === "text/plain";

        const isValidSize = file.size <= MAX_FILE_SIZE;

        return isValidType && isValidSize;
      });

      if (validFiles.length > 0) {
        onFilesDrop(validFiles);
      }
    },
    [disabled, onFilesDrop]
  );

  return (
    <div
      className="relative w-full h-full flex flex-col flex-1 min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-[rgb(var(--bg-primary)/0.8)] backdrop-blur-sm flex items-center justify-center z-[9999] pointer-events-none">
          <div className="bg-[rgb(var(--accent-primary)/0.2)] border-2 border-[rgb(var(--accent-primary))] border-dashed rounded-2xl p-12 flex flex-col items-center gap-4">
            <div className="bg-[rgb(var(--accent-primary)/0.3)] rounded-full p-6">
              <Upload
                className="size-16 text-[rgb(var(--accent-primary))]"
                weight="bold"
              />
            </div>
            <div className="text-center">
              <p className="text-[rgb(var(--text-primary))] text-xl font-semibold mb-2">
                Drop files here
              </p>
              <p className="text-[rgb(var(--text-secondary)/var(--text-secondary-opacity))] text-sm">
                Images, videos, documents up to 16MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
