import { useEffect, useRef, useState } from "react";
import * as QRCode from "qrcode";
import { getInviteUrl } from "../lib/session";

/** Generates a QR locally; no room link is sent to a third-party QR service. */
export function JoinQrCode({ code, compact = false }: { code: string; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const url = getInviteUrl(code);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setFailed(false);
    QRCode.toCanvas(canvas, url, {
      width: 188,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#252320", light: "#fffdf5" },
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className={`tv-join-qr${compact ? " tv-join-qr--compact" : ""}`} aria-label={`Join room ${code} by scanning the QR code`}>
      <div className="tv-join-qr-image">
        {failed ? <span>QR unavailable</span> : <canvas ref={canvasRef} role="img" aria-label="Scannable invite link" />}
      </div>
      {!compact && <div className="tv-join-qr-copy">
        <strong>Scan to join</strong>
        <span>Open your camera, scan, and enter the game.</span>
      </div>}
    </div>
  );
}
