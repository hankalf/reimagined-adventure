"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Camera QR scanner. Uses the browser's BarcodeDetector when available (Chrome on Android/macOS/ChromeOS)
 * and falls back to jsQR decoding frames from a canvas everywhere else. Works for both the QR code on the
 * employee's confirmation page and any QR/2D code containing the confirmation code.
 */
export function Scanner({ onDecoded, onError }: { onDecoded: (text: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Starting camera…");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let jsqr: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;
    let detector: Detector | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError("This browser can't access the camera. Use Chrome or Safari over HTTPS, or type the code.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch {
        onError("Camera permission was denied or no camera is available. You can still type the code.");
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (Ctor) {
        try {
          detector = new Ctor({ formats: ["qr_code"] });
          setStatus("Point the camera at the QR code");
        } catch {
          detector = null;
        }
      }
      if (!detector) {
        const mod = await import("jsqr");
        jsqr = mod.default as typeof jsqr;
        setStatus("Point the camera at the QR code");
      }

      timer = setInterval(async () => {
        if (stopped || !video || video.readyState < 2) return;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            const hit = codes.find((c) => c.rawValue);
            if (hit) onDecoded(hit.rawValue);
            return;
          }
          const canvas = canvasRef.current;
          if (!canvas || !jsqr) return;
          const w = Math.min(640, video.videoWidth || 640);
          const h = Math.round(w * ((video.videoHeight || 480) / (video.videoWidth || 640)));
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const result = jsqr(img.data, w, h);
          if (result?.data) onDecoded(result.data);
        } catch {
          // ignore a bad frame
        }
      }, 180);
    }

    void start();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDecoded, onError]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-black">
      <div className="relative">
        <video ref={videoRef} muted playsInline className="max-h-[50vh] w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-48 w-48 rounded-xl border-4 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="px-4 py-2 text-center text-xs text-slate-300">{status}</p>
    </div>
  );
}
