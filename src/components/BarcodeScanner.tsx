import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { ScanBarcode, X } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (isbn: string) => void;
  onClose: () => void;
}

export const BarcodeScanner = ({ onScan, onClose }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const startScan = async () => {
      try {
        setScanning(true);
        setError(null);
        await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
          if (result) {
            const text = result.getText();
            // ISBN-13 starts with 978 or 979, ISBN-10 is 10 digits
            if (/^(978|979)\d{10}$/.test(text) || /^\d{9}[\dX]$/.test(text)) {
              onScan(text);
            }
          }
          if (err && !err.message?.includes("No MultiFormat Readers")) {
            console.error(err);
          }
        });
      } catch (e: any) {
        setError(e.message || "Camera access denied");
        setScanning(false);
      }
    };

    startScan();

    return () => {
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-32 border-2 border-primary rounded-lg opacity-70 animate-pulse" />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && <p className="text-xs text-muted-foreground">Point camera at a book barcode (ISBN)</p>}
      <Button variant="outline" size="sm" onClick={onClose}>
        <X className="h-4 w-4 mr-1.5" /> Cancel
      </Button>
    </div>
  );
};
