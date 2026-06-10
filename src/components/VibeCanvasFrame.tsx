"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Vibe, VibeParams } from "@/data/vibes";

interface Props {
  vibe: Vibe;
  params: VibeParams;
  playing: boolean;
  fft: number[];
}

const BLOCKED_PATTERNS = [
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bnavigator\.sendBeacon\b/i,
  /\bWebSocket\b/i,
  /\bEventSource\b/i,
  /\bWorker\b/i,
  /\bSharedWorker\b/i,
  /\bnew\s+Image\b/i,
  /<img\b/i,
  /\bsrc\s*=\s*["']https?:/i,
  /url\(\s*["']?https?:/i,
  /<script[^>]+src=/i,
  /\bimport\s*\(/i,
  /\bimport\s+.*from\b/i,
  /\bdocument\.cookie\b/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\bindexedDB\b/i,
  /\bwindow\.open\b/i,
  /\btop\./i,
  /\bparent\./i,
  /\blocation\s*=/i,
  /\blocation\.(href|assign|replace|reload)\b/i,
  /<meta[^>]+http-equiv=["']?refresh/i,
  /<a\b[^>]+href=["']?https?:/i,
];

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; worker-src 'none'; child-src 'none'; frame-src 'none'; media-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none'";

export function isSafeVisualCode(code: string) {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length > 24000) return false;
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function withRuntimeBridge(code: string) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  const withCsp = code.includes("<head>") ? code.replace("<head>", `<head>${meta}`) : `${meta}${code}`;

  return withCsp.replace(
    "</body>",
    `<script>
window.__VIBELIVE_READY__ = true;
window.addEventListener("error", function (event) {
  document.documentElement.dataset.vibeError = event.message || "runtime-error";
});
</script></body>`,
  );
}

export default function VibeCanvasFrame({ vibe, params, playing, fft }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [readyDoc, setReadyDoc] = useState<string | null>(null);
  const [failedDoc, setFailedDoc] = useState<string | null>(null);

  const srcDoc = useMemo(() => {
    if (!vibe.visualCode || !isSafeVisualCode(vibe.visualCode)) return null;
    return withRuntimeBridge(vibe.visualCode);
  }, [vibe.visualCode]);

  const ready = readyDoc === srcDoc;
  const failed = failedDoc === srcDoc;

  useEffect(() => {
    if (!srcDoc || !ready || failed) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "vibelive:update",
        payload: {
          palette: vibe.palette,
          params,
          fft,
          playing,
        },
      },
      "*",
    );
  }, [failed, fft, params, playing, ready, srcDoc, vibe.palette]);

  if (!srcDoc || failed) return null;

  return (
    <iframe
      ref={iframeRef}
      key={srcDoc}
      className="vibe-canvas-frame"
      title={`${vibe.name} AI visual`}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      onLoad={() => setReadyDoc(srcDoc)}
      onError={() => setFailedDoc(srcDoc)}
    />
  );
}
