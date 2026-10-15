"use client";

import { useEffect, useRef } from "react";

export function Logo({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.play().catch(() => {
        // Autoplay was blocked; we'll retry on the next trigger below.
      });
    };

    tryPlay();

    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("pointerdown", tryPlay, { once: true });

    return () => {
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("pointerdown", tryPlay);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      className={className}
      src="/logo-violet.mp4"
    />
  );
}
