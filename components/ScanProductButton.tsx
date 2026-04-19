"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

const SCAN_BUTTON_LABEL = "Scansiona EAN / QR CODE";

type ScannerControls = {
  stop: () => void;
};

type ScanProductButtonProps = {
  onScan: (value: string) => void | Promise<void>;
  className?: string;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  disabled?: boolean;
  hint?: string;
};

export default function ScanProductButton({
  onScan,
  className,
  buttonClassName = "btn-secondary",
  buttonStyle,
  disabled,
  hint = "Inquadra un barcode EAN o un QR code con la fotocamera.",
}: ScanProductButtonProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Avvio fotocamera...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function startScanner() {
      setError(null);
      setStatus("Avvio fotocamera...");
      handledRef.current = false;

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Fotocamera non disponibile in questo browser.");
        setStatus("");
        return;
      }

      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result, scanError, activeControls) => {
            if (handledRef.current) return;

            if (result) {
              const value = result.getText().trim();
              if (!value) return;

              handledRef.current = true;
              activeControls.stop();
              controlsRef.current = null;
              setOpen(false);
              await onScanRef.current(value);
              return;
            }

            if (scanError && scanError.name !== "NotFoundException") {
              setStatus("Scanner attivo. Riprova avvicinando il codice.");
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("Scanner attivo. Inquadra il codice.");
      } catch (err) {
        console.error("Errore scanner prodotto:", err);
        setError(scannerErrorMessage(err));
        setStatus("");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  function closeScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`${buttonClassName}${className ? ` ${className}` : ""}`}
        style={buttonStyle}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Camera size={17} strokeWidth={2} />
        <span>{SCAN_BUTTON_LABEL}</span>
      </button>

      {open && (
        <div className="product-scanner-overlay" onClick={closeScanner}>
          <div className="product-scanner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="product-scanner-header">
              <div>
                <h2 className="product-scanner-title">{SCAN_BUTTON_LABEL}</h2>
                <p className="product-scanner-subtitle">{hint}</p>
              </div>

              <button
                type="button"
                className="product-scanner-close"
                onClick={closeScanner}
                aria-label="Chiudi scanner"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="product-scanner-video-wrap">
              <video
                ref={videoRef}
                className="product-scanner-video"
                muted
                playsInline
              />
              <div className="product-scanner-frame" />
            </div>

            {error ? (
              <div className="product-scanner-message product-scanner-message--error">
                {error}
              </div>
            ) : (
              <div className="product-scanner-message">{status}</div>
            )}

            <div className="product-scanner-actions">
              <button type="button" className="btn-secondary" onClick={closeScanner}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function scannerErrorMessage(err: unknown) {
  const name = err instanceof Error ? err.name : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Permesso fotocamera negato. Abilita la fotocamera per scansionare il codice.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nessuna fotocamera disponibile su questo dispositivo.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Fotocamera non accessibile. Verifica che non sia gia' in uso da un'altra app.";
  }

  return "Scanner non avviato. Controlla permessi fotocamera e riprova.";
}
