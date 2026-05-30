// frontend/components/chat/ErrorBanner.tsx

"use client";

import { IconInfo } from "@/components/icons/Icons";

interface ErrorBannerProps {
  error?: string | null;
}

export default function ErrorBanner({ error = null }: ErrorBannerProps) {
  if (!error) {
    return null;
  }

  return (
    <div className="banner banner--error" role="alert">
      <span className="banner-ic">
        <IconInfo size={16} />
      </span>
      <div className="banner-body">{error}</div>
    </div>
  );
}
