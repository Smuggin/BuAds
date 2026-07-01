"use client";

import { useEffect, useState } from "react";
import type { CreativeFormat } from "@/data/types";

interface Props {
  preview?: string;
  name: string;
  format: CreativeFormat;
  videoId?: string;
  permalinkUrl?: string;
  /** Fallback tile when there is no preview image. */
  fallback: { icon: string; color: string };
}

/** Embed URL for the creative's video. Prefers the Facebook video player
 *  (built from `video_id`, no extra permissions, plays the actual FB placement);
 *  falls back to the post permalink — Instagram `/p/` & `/reel/` via `/embed`,
 *  Facebook via the video plugin. null → nothing embeddable. */
function embedUrl(videoId?: string, permalink?: string): string | null {
  if (videoId) {
    const href = `https://www.facebook.com/watch/?v=${videoId}`;
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      href,
    )}&show_text=false`;
  }
  if (!permalink) return null;
  try {
    const u = new URL(permalink);
    if (u.hostname.includes("instagram.com")) {
      return `https://www.instagram.com${u.pathname.replace(/\/$/, "")}/embed`;
    }
    if (u.hostname.includes("facebook.com")) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        permalink,
      )}&show_text=false`;
    }
    return null;
  } catch {
    return null;
  }
}

/** The creative's head preview. For a playable post (video/reel with an
 *  embeddable permalink) it shows a play overlay and opens an inline player. */
export function CreativePlayer({ preview, name, format, videoId, permalinkUrl, fallback }: Props) {
  const [open, setOpen] = useState(false);
  const embed =
    format === "Video" || format === "Reels" ? embedUrl(videoId, permalinkUrl) : null;
  const playable = !!embed;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tile = preview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={preview}
      alt={name}
      loading="lazy"
      className="h-[92px] w-[92px] flex-shrink-0 rounded-[14px] object-cover"
    />
  ) : (
    <div
      className="flex h-[92px] w-[92px] flex-shrink-0 items-center justify-center rounded-[14px] text-[34px] text-white"
      style={{ background: fallback.color }}
    >
      {fallback.icon}
    </div>
  );

  if (!playable) return tile;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="เล่นวิดีโอ · Play video"
        className="group relative h-[92px] w-[92px] flex-shrink-0 overflow-hidden rounded-[14px]"
      >
        {tile}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/35">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 pl-[3px] text-[16px] text-ink shadow-sm">
            ▶
          </span>
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,29,.55)] p-6 backdrop-blur-[3px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-[400px] max-w-full flex-col overflow-hidden rounded-[16px] bg-card shadow-modal"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-2 px-[18px] py-[13px]">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-[-0.01em]">
                  วิดีโอครีเอทีฟ · Creative video
                </div>
                <div className="truncate text-[11.5px] text-muted-2">{name}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด · Close"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] border border-[#dde1e7] bg-card text-[15px] text-ink"
              >
                ✕
              </button>
            </div>
            <iframe
              src={embed}
              title={name}
              className="h-[640px] max-h-[72vh] w-full border-0 bg-[#000]"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              scrolling="no"
            />
            {permalinkUrl && (
              <a
                href={permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-t border-border-2 px-[18px] py-[11px] text-center text-[12px] font-medium text-[#3b6fe0] hover:underline"
              >
                เปิดในแอป · Open original →
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
