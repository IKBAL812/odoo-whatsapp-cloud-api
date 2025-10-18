"use client";

import { UserIcon } from "@phosphor-icons/react";
import Image from "next/image";
import { PropsWithChildren, useState, useEffect, useRef } from "react";
import { useTheme } from "@/app/context/theme-provider";
import { generateAvatarColor } from "@/app/lib/avatar-colors";

export default function Profile({
  children,
  size,
  url,
  alt = "profile",
  seed,
}: PropsWithChildren<{
  size?: string;
  url?: string;
  alt?: string;
  seed?: number;
}>) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);

  const sizeClass =
    {
      6: "w-6 h-6",
      7: "w-7 h-7",
      8: "w-8 h-8",
      10: "w-10 h-10",
      11: "w-11 h-11",
      12: "w-12 h-12",
    }[size ?? 7] ?? "w-7 h-7";

  // Reset states when URL changes and check if image is already cached
  useEffect(() => {
    if (url && url.length > 0) {
      setImageError(false);
      setImageLoaded(false);

      // Check if image is already loaded (from cache)
      // Navigate through Next.js Image component structure to find the underlying img element
      const imgElement = imageContainerRef.current?.querySelector(
        "img"
      ) as HTMLImageElement | null;
      if (imgElement && imgElement.complete) {
        setImageLoaded(true);
      }
    } else {
      setImageLoaded(false);
    }
  }, [url]);

  // Generate background color when theme or seed changes
  useEffect(() => {
    if (seed !== undefined && seed !== null) {
      const color = generateAvatarColor(seed, theme);
      setBackgroundColor(color);
    } else {
      setBackgroundColor(null);
    }
  }, [seed, theme]);

  const renderDefaultAvatar = () => {
    // Use colored background if seed is provided
    const bgStyle = backgroundColor
      ? { backgroundColor }
      : undefined;
    const bgClass = backgroundColor
      ? ""
      : "bg-[rgb(var(--text-secondary))]";

    return (
      <div
        className={`w-full h-full ${bgClass} overflow-hidden flex justify-center items-center`}
        style={bgStyle}
      >
        <UserIcon
          className={`text-[rgb(var(--bg-primary))] size-8`}
          weight="fill"
        />
      </div>
    );
  };

  const renderLoadingSkeleton = () => (
    <div className="w-full h-full bg-[rgb(var(--text-secondary)/0.3)] overflow-hidden flex justify-center items-center animate-pulse">
      <UserIcon
        className={`text-[rgb(var(--bg-primary)/0.5)] size-8`}
        weight="fill"
      />
    </div>
  );

  const renderAvatar = () => {
    // No URL provided - show default avatar
    if (!url || url.length === 0) {
      return renderDefaultAvatar();
    }

    // Image failed to load - show default avatar
    if (imageError) {
      return renderDefaultAvatar();
    }

    // Image is loading (not cached, not loaded yet)
    const isLoading = !imageLoaded;

    return (
      <div ref={imageContainerRef} className="w-full h-full relative">
        {/* Show loading skeleton while image loads */}
        {isLoading && renderLoadingSkeleton()}

        {/* Next.js Image component with proper error handling */}
        <Image
          src={url}
          alt={alt}
          fill
          className={`object-cover transition-opacity duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          unoptimized={true}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
        />
      </div>
    );
  };

  return (
    <section
      className={`${sizeClass} overflow-hidden relative flex justify-center items-center rounded-full cursor-pointer`}
    >
      {children ?? renderAvatar()}
    </section>
  );
}
