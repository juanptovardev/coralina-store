"use client";

import { useState } from "react";
import { uploadProductImage } from "@/lib/image-upload";

const SAFE_URL_PREFIX = /^(https:\/\/images\.pexels\.com\/|\/uploads\/products\/)/i;
const IMAGE_EXT = /\.(webp|jpe?g|png|gif|avif)$/i;

function kb(bytes: number): string {
  return (bytes / 1024).toFixed(0);
}

/** Campo de subida de imágenes con autocompresión + modo URL opcional. */
export function ImageUploadField({
  onUploaded,
  label,
  showPreview,
  currentUrl,
  className,
  allowUrl = true,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  showPreview?: boolean;
  currentUrl?: string;
  className?: string;
  allowUrl?: boolean;
}) {
  const [phase, setPhase] = useState<"compressing" | "uploading" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [urlInput, setUrlInput] = useState("");

  async function handleFile(file: File) {
    setError("");
    setDone("");
    setPhase("compressing");
    const res = await uploadProductImage(file, { onPhase: (p) => setPhase(p) });
    setPhase(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(
      res.info?.compressed
        ? `${kb(res.info.finalBytes)} KB (antes ${kb(res.info.originalBytes)} KB)`
        : "Imagen subida",
    );
    onUploaded(res.url);
  }

  function addUrl() {
    const url = urlInput.trim();
    setError("");
    setDone("");
    if (!url) return;
    onUploaded(url);
    setUrlInput("");
  }

  const trimmedUrl = urlInput.trim();
  const urlSuspicious =
    trimmedUrl.length > 0 && !SAFE_URL_PREFIX.test(trimmedUrl) && !IMAGE_EXT.test(trimmedUrl);

  return (
    <div className={className}>
      {label ? <label className="admin-label">{label}</label> : null}
      <div className="flex gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="admin-input shrink-0 text-xs"
          disabled={phase !== null}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {phase && (
          <span className="self-center text-xs opacity-60">
            {phase === "compressing" ? "Comprimiendo…" : "Subiendo…"}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {done && <p className="mt-1 text-xs text-[#2f6b5e]">{done}</p>}
      {showPreview && currentUrl ? (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="" className="h-20 rounded object-cover" />
        </div>
      ) : null}
      {allowUrl && (
        <>
          <div className="mt-2 flex gap-2">
            <input
              className="admin-input"
              placeholder="o pega una URL (https://…)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addUrl();
              }}
            />
            <button className="dash-btn shrink-0 text-xs" onClick={addUrl}>
              Añadir
            </button>
          </div>
          {urlSuspicious && (
            <p className="mt-1 text-[0.7rem] opacity-50">
              Ojo: por CSP del sitio, las URLs externas solo funcionan con images.pexels.com
            </p>
          )}
        </>
      )}
    </div>
  );
}
