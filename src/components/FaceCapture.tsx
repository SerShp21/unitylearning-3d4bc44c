import { useRef, useEffect, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Check, RefreshCw, ScanFace } from "lucide-react";

interface FaceCaptureProps {
  onCapture: (descriptor: number[]) => void;
  onCancel?: () => void;
  label?: string;
}

const MODELS_URL = "/models";

export const FaceCapture = ({ onCapture, onCancel, label = "Capture Face" }: FaceCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [detected, setDetected] = useState(false);
  const [captured, setCaptured] = useState(false);
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        if (!cancelled) setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face models:", err);
        toast.error("Failed to load face recognition models");
      }
    };

    loadModels();
    return () => { cancelled = true; };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCapturing(true);
      startDetectionLoop();
    } catch {
      toast.error("Could not access camera. Please allow camera access.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCapturing(false);
    setDetected(false);
  }, []);

  const startDetectionLoop = () => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    detectionRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true);
      setDetected(!!detection);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (detection) {
          const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
          const resized = faceapi.resizeResults(detection, dims);
          faceapi.draw.drawDetections(canvas, resized);
        }
      }
    }, 200);
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    const result = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (!result) {
      toast.error("No face detected. Please look directly at the camera.");
      return;
    }

    const descriptor = Array.from(result.descriptor);
    stopCamera();
    setCaptured(true);
    onCapture(descriptor);
    toast.success("Face captured successfully!");
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-80 h-60 bg-muted rounded-xl overflow-hidden border-2 border-dashed border-border flex items-center justify-center">
        {capturing ? (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" width={320} height={240} />
            <div className={`absolute top-2 right-2 h-3 w-3 rounded-full ${detected ? "bg-primary" : "bg-muted-foreground"} animate-pulse`} />
            <div className={`absolute bottom-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${detected ? "bg-primary/80 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {detected ? "Face detected ✓" : "Position your face..."}
            </div>
          </>
        ) : captured ? (
          <div className="flex flex-col items-center gap-2 text-primary">
            <Check className="h-12 w-12" />
            <p className="text-sm font-medium">Face captured!</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ScanFace className="h-12 w-12" />
            <p className="text-sm">{modelsLoaded ? "Ready to capture" : "Loading models..."}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!capturing && !captured && (
          <Button onClick={startCamera} disabled={!modelsLoaded}>
            <Camera className="h-4 w-4 mr-2" />
            {modelsLoaded ? label : "Loading..."}
          </Button>
        )}
        {capturing && (
          <>
            <Button variant="outline" onClick={stopCamera}>
              Cancel
            </Button>
            <Button onClick={captureFace} disabled={!detected}>
              <ScanFace className="h-4 w-4 mr-2" />
              {detected ? "Capture" : "Waiting for face..."}
            </Button>
          </>
        )}
        {captured && (
          <Button variant="outline" onClick={() => { setCaptured(false); startCamera(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retake
          </Button>
        )}
        {onCancel && !capturing && (
          <Button variant="ghost" onClick={onCancel}>Skip</Button>
        )}
      </div>
    </div>
  );
};
