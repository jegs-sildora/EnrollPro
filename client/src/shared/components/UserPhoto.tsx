import React, { useState } from "react";
import { User } from "lucide-react";
import { cn, getImageUrl } from "@/shared/lib/utils";

interface UserPhotoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  photo: string | null | undefined;
  fallbackIcon?: React.ReactNode;
  containerClassName?: string;
  onEnlarge?: () => void;
  children?: React.ReactNode;
}

/**
 * A consistent component for displaying student or teacher photos.
 * Handles loading, error states, and standardizes image URL fetching.
 */
export function UserPhoto({
  photo,
  fallbackIcon,
  containerClassName,
  className,
  alt = "User photo",
  onEnlarge,
  children,
  ...props
}: UserPhotoProps) {
  const [error, setError] = useState(false);
  const imageUrl = getImageUrl(photo);

  const showFallback = !imageUrl || error;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted flex items-center justify-center shrink-0",
        onEnlarge && imageUrl && !error && "cursor-zoom-in hover:opacity-90 transition-opacity",
        containerClassName
      )}
      onClick={onEnlarge && imageUrl && !error ? onEnlarge : undefined}
    >
      {showFallback ? (
        fallbackIcon || <User className="w-1/2 h-1/2 text-muted-foreground/40" />
      ) : (
        <img
          src={imageUrl}
          alt={alt}
          className={cn("w-full h-full object-cover", className)}
          onError={() => setError(true)}
          {...props}
        />
      )}
      {children}
    </div>
  );
}
