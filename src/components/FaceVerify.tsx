import { useRef, useEffect, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { ScanFace, AlertCircle } from "lucide-react";

interface FaceVerifyProps {
  storedDescriptor: number[];
  onSuccess: () => void;
  onSkip?: () => void;
  threshold?: number;
}

const MODELS_URL = "/models";

export const FaceVerify = ({ storedDescriptor, onSuccess, onSkip, threshold = 0.5 }: FaceVerifyProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifiedRef = useRef(false); // prevent onSuccess firing multiple times
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "verifying" | "failed">("loading");
  const [detected, setDetected] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const load = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
      setModelsLoaded(true);
      setStatus("ready");
    };
    load();
  }, []);

  const stopCamera = useCallback(() => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
      streamRef.current = stream;
      // Video is always in the DOM now, assign directly
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("verifying");

      // Auto-detect and verify in a loop
      detectionRef.current = setInterval(async () => {
        if (!videoRef.current) return;
        const result = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        setDetected(!!result);

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          if (result) {
            const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
            const resized = faceapi.resizeResults(result, dims);
            faceapi.draw.drawDetections(canvasRef.current, resized);
          }
        }

        if (result && !verifiedRef.current) {
          const stored = new Float32Array(storedDescriptor);
          const distance = faceapi.euclideanDistance(result.descriptor, stored);
          if (distance <= threshold) {
            verifiedRef.current = true;
            stopCamera();
            onSuccess();
          }
        }
      }, 300);
    } catch {
      setStatus("failed");
    }
  }, [storedDescriptor, threshold, onSuccess, stopCamera]);

  useEffect(() => {
    if (modelsLoaded) startCamera();
    return () => stopCamera();
  }, [modelsLoaded, startCamera, stopCamera]);

  const retry = () => {
    setAttempts(a => a + 1);
    setStatus("ready");
    stopCamera();
    setTimeout(() => startCamera(), 200);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-80 h-60 bg-muted rounded-xl overflow-hidden border-2 border-border flex items-center justify-center">
        {/* Always keep video in DOM so srcObject can be assigned immediately */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${status === "verifying" ? "block" : "hidden"}`}
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${status === "verifying" ? "block" : "hidden"}`}
          width={320}
          height={240}
        />

        {status === "loading" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ScanFace className="h-10 w-10 animate-pulse" />
            <p className="text-sm">Loading face models...</p>
          </div>
        )}
        {status === "ready" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ScanFace className="h-10 w-10 animate-pulse" />
            <p className="text-sm">Starting camera...</p>
          </div>
        )}
        {status === "verifying" && (
          <>
            <div className={`absolute top-2 right-2 h-3 w-3 rounded-full ${detected ? "bg-primary" : "bg-secondary"} animate-pulse`} />
            <div className="absolute bottom-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full bg-black/50 text-white">
              {detected ? "Comparing face..." : "Look at the camera"}
            </div>
          </>
        )}
        {status === "failed" && (
          <div className="flex flex-col items-center gap-2 text-destructive px-4 text-center">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm">Camera access denied or not available</p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {status === "verifying"
          ? "Hold still — we're verifying your face automatically"
          : status === "loading"
          ? "Preparing face recognition..."
          : "Camera error. Try again or skip."}
      </p>

      <div className="flex gap-2">
        {(status === "failed") && (
          <Button variant="outline" size="sm" onClick={retry}>Retry</Button>
        )}
        {onSkip && attempts >= 2 && (
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip face verification</Button>
        )}
      </div>
    </div>
  );
};
