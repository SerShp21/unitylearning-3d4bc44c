import { useState, useEffect, useCallback, useRef } from "react";
import * as faceapi from "face-api.js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FaceVerify } from "@/components/FaceVerify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Bot, CheckCircle, Clock, ScanFace, Users as UsersIcon, BookOpen,
  Award, FileText, Play, Square, ChevronRight, Loader2, Camera, X, AlertCircle,
} from "lucide-react";

type Step = "teacher_verify" | "class_detected" | "attendance" | "topic_input" | "lecturing" | "quiz" | "grading" | "results";

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

interface StudentProfile {
  user_id: string;
  full_name: string;
  face_id: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  book_title: string | null;
  book_author: string | null;
  book_publisher: string | null;
}

const MODELS_URL = "/models";
const KAHOOT_COLORS = ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"];
const KAHOOT_SHAPES = ["▲", "◆", "●", "■"];

const STEP_LABELS: Record<Step, string> = {
  teacher_verify: "Verify Teacher",
  class_detected: "Detect Class",
  attendance: "Attendance",
  topic_input: "Set Topic",
  lecturing: "Lecture",
  quiz: "Quiz",
  grading: "Grade",
  results: "Complete",
};
const STEPS: Step[] = ["teacher_verify", "class_detected", "attendance", "topic_input", "lecturing", "quiz", "grading", "results"];

const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

const Robot = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("teacher_verify");
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [timetableEntryId, setTimetableEntryId] = useState<string | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentProfile[]>([]);
  const [presentStudents, setPresentStudents] = useState<StudentProfile[]>([]);
  const presentIdsRef = useRef<Set<string>>(new Set());
  const enrolledRef = useRef<StudentProfile[]>([]);
  const [topic, setTopic] = useState("");
  const [lectureStart, setLectureStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedForQuiz, setSelectedForQuiz] = useState<StudentProfile[]>([]);
  const [studentScores, setStudentScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherDescriptor, setTeacherDescriptor] = useState<number[] | null>(null);

  // Attendance camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  // Load face models
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL)
      .then(() => faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL))
      .then(() => faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL))
      .then(() => setModelsLoaded(true))
      .catch(() => toast.error("Failed to load face models"));
  }, []);

  // Load teacher descriptor
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("face_id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.face_id) setTeacherDescriptor(JSON.parse(data.face_id));
    });
  }, [user]);

  // Keep refs in sync
  useEffect(() => { enrolledRef.current = enrolledStudents; }, [enrolledStudents]);

  // Lecture timer
  useEffect(() => {
    if (step !== "lecturing" || !lectureStart) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - lectureStart.getTime()) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [step, lectureStart]);

  const stopCamera = useCallback(() => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    detectionRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─── AUTO-DETECT CLASS ───
  const detectClass = async () => {
    const now = new Date();
    const jsDay = now.getDay(); // 0=Sun
    const timetableDay = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon
    const currentTime = now.toTimeString().slice(0, 5);

    const { data: entries } = await supabase
      .from("timetable_entries")
      .select("*, classes(id, name, subject, book_title, book_author, book_publisher)")
      .eq("day_of_week", timetableDay);

    if (!entries?.length) { toast.error("No classes scheduled for today"); return false; }

    const current = entries.find((e: any) => currentTime >= e.start_time && currentTime <= e.end_time);
    const next = [...entries].sort((a: any, b: any) => a.start_time.localeCompare(b.start_time)).find((e: any) => e.start_time > currentTime);
    const entry = current || next || entries[0];
    const cls = (entry as any).classes;
    if (!cls) { toast.error("Could not detect class"); return false; }

    setClassInfo(cls);
    setTimetableEntryId(entry.id);

    const { data: enrollments } = await supabase.from("class_enrollments").select("student_id").eq("class_id", cls.id);
    if (enrollments?.length) {
      const ids = enrollments.map((e: any) => e.student_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, face_id").in("user_id", ids);
      setEnrolledStudents(profiles || []);
    }
    return true;
  };

  // ─── TEACHER VERIFIED ───
  const handleTeacherVerified = async () => {
    toast.success("Teacher identity confirmed!");
    setLoading(true);
    const ok = await detectClass();
    setLoading(false);
    if (ok) setStep("class_detected");
  };

  // ─── ATTENDANCE SCANNING ───
  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 } });
      streamRef.current = stream;
      setScanning(true);
      setScanStatus("Ready — ask next student to face the camera");

      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play();
        }
      }, 100);

      detectionRef.current = setInterval(async () => {
        if (!videoRef.current || cooldownRef.current) return;
        const result = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks(true)
          .withFaceDescriptor();

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          if (result) {
            const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
            faceapi.draw.drawDetections(canvasRef.current, faceapi.resizeResults(result, dims));
          }
        }

        if (!result) { setScanStatus("Scanning... Position face in frame"); return; }

        let bestMatch: StudentProfile | null = null;
        let bestDist = Infinity;
        for (const s of enrolledRef.current) {
          if (!s.face_id || presentIdsRef.current.has(s.user_id)) continue;
          try {
            const stored = new Float32Array(JSON.parse(s.face_id));
            const d = faceapi.euclideanDistance(result.descriptor, stored);
            if (d < bestDist) { bestDist = d; bestMatch = s; }
          } catch { }
        }

        if (bestMatch && bestDist <= 0.45) {
          cooldownRef.current = true;
          presentIdsRef.current.add(bestMatch.user_id);
          setPresentStudents(prev => [...prev, bestMatch!]);
          setScanStatus(`✓ ${bestMatch.full_name} — Present!`);
          toast.success(`${bestMatch.full_name} marked present`);
          setTimeout(() => { cooldownRef.current = false; setScanStatus("Ready — next student"); }, 2500);
        } else {
          setScanStatus("Face not recognized — try again");
        }
      }, 600);
    } catch { toast.error("Camera access denied"); }
  };

  // ─── SAVE ATTENDANCE ───
  const saveAttendance = async () => {
    if (!classInfo || !user) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const records = enrolledStudents.map(s => ({
      class_id: classInfo.id,
      student_id: s.user_id,
      date: today,
      status: presentIdsRef.current.has(s.user_id) ? "present" : "absent",
      timetable_entry_id: timetableEntryId,
      marked_by: user.id,
    }));

    const { error } = await supabase.from("attendance").insert(records);
    if (error) { toast.error("Failed to save attendance: " + error.message); }
    else { toast.success(`Attendance saved — ${presentStudents.length}/${enrolledStudents.length} present`); }
    stopCamera();
    setLoading(false);
    setStep("topic_input");
  };

  // ─── END LECTURE → GENERATE QUIZ ───
  const endLecture = async () => {
    setLoading(true);
    const quizCount = Math.max(1, Math.ceil(presentStudents.length * 0.1));
    const numQuestions = Math.max(3, Math.min(10, Math.ceil(presentStudents.length * 0.3)));

    // Randomly select students
    const shuffled = [...presentStudents].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(1, Math.ceil(presentStudents.length * 0.1)));
    setSelectedForQuiz(selected);

    // Initialize scores
    const scores: Record<string, number> = {};
    selected.forEach(s => { scores[s.user_id] = 0; });
    setStudentScores(scores);

    try {
      const { data, error } = await supabase.functions.invoke("robot-ai", {
        body: {
          action: "generate_quiz",
          topic,
          class_name: classInfo?.name || "",
          book_info: classInfo ? { title: classInfo.book_title, author: classInfo.book_author, publisher: classInfo.book_publisher } : null,
          num_questions: numQuestions,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setQuizQuestions(data.questions || []);
      setCurrentQ(0);
      setShowAnswer(false);
      setStep("quiz");
    } catch (e: any) {
      toast.error("Failed to generate quiz: " + (e.message || "Unknown error"));
    }
    setLoading(false);
  };

  // ─── SAVE GRADES + GENERATE PDF ───
  const finishSession = async () => {
    if (!classInfo || !user) return;
    setSaving(true);

    // Save grades
    const gradeRecords = selectedForQuiz.map(s => ({
      class_id: classInfo.id,
      student_id: s.user_id,
      title: `Robot Quiz: ${topic}`,
      score: studentScores[s.user_id] || 0,
      max_score: quizQuestions.length,
      timetable_entry_id: timetableEntryId,
      graded_by: user.id,
      notes: `Auto-graded by Robot. ${studentScores[s.user_id] || 0}/${quizQuestions.length} correct.`,
    }));

    const { error: gradeErr } = await supabase.from("grades").insert(gradeRecords);
    if (gradeErr) toast.error("Failed to save grades: " + gradeErr.message);
    else toast.success("Grades saved!");

    // Generate lecture PDF
    try {
      const { data, error } = await supabase.functions.invoke("robot-ai", {
        body: {
          action: "generate_lecture",
          topic,
          class_name: classInfo.name,
          book_info: { title: classInfo.book_title, author: classInfo.book_author, publisher: classInfo.book_publisher },
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const html = data.html || "<p>No content generated</p>";
      const blob = new Blob([html], { type: "text/html" });
      const fileName = `lecture_${topic.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.html`;
      const filePath = `${classInfo.id}/${fileName}`;

      const { error: uploadErr } = await supabase.storage.from("lectures").upload(filePath, blob, { contentType: "text/html" });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("lectures").getPublicUrl(filePath);

      const { error: lectureErr } = await supabase.from("lectures").insert({
        class_id: classInfo.id,
        title: `Lecture: ${topic}`,
        file_url: urlData.publicUrl,
        file_name: fileName,
        file_type: "text/html",
        uploaded_by: user.id,
      });
      if (lectureErr) throw lectureErr;
      toast.success("Lecture notes generated and saved!");
    } catch (e: any) {
      toast.error("Failed to generate lecture notes: " + (e.message || "Unknown error"));
    }

    setSaving(false);
    setStep("results");
  };

  // ─── RENDER HELPERS ───
  const stepIndex = STEPS.indexOf(step);

  const renderProgress = () => (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1 shrink-0">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            i < stepIndex ? "bg-primary text-primary-foreground" :
            i === stepIndex ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
            "bg-muted text-muted-foreground"
          }`}>
            {i < stepIndex ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );

  const renderTeacherVerify = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ScanFace className="h-5 w-5" /> Teacher Verification</CardTitle>
        <CardDescription>Verify your identity to start the Robot session</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {!teacherDescriptor ? (
          <div className="text-center text-muted-foreground py-8">
            <AlertCircle className="h-10 w-10 mx-auto mb-2" />
            <p>No face ID found for your account. Please set up Face ID first.</p>
          </div>
        ) : (
          <FaceVerify storedDescriptor={teacherDescriptor} onSuccess={handleTeacherVerified} threshold={0.45} />
        )}
        {loading && <div className="flex items-center gap-2 mt-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Detecting class...</div>}
      </CardContent>
    </Card>
  );

  const renderClassDetected = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Class Detected</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <p className="text-lg font-semibold">{classInfo?.name}</p>
          <p className="text-sm text-muted-foreground">Subject: {classInfo?.subject || "N/A"}</p>
          {classInfo?.book_title && (
            <p className="text-sm text-muted-foreground">📖 {classInfo.book_title} by {classInfo.book_author || "Unknown"}</p>
          )}
          <p className="text-sm text-muted-foreground">Enrolled students: {enrolledStudents.length}</p>
        </div>
        <Button onClick={() => setStep("attendance")} className="w-full">
          <ChevronRight className="h-4 w-4 mr-2" /> Start Attendance
        </Button>
      </CardContent>
    </Card>
  );

  const renderAttendance = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5" /> Student Attendance</CardTitle>
        <CardDescription>Students come one-by-one to face the camera</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative w-80 h-60 mx-auto bg-muted rounded-xl overflow-hidden border-2 border-border">
          <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? "block" : "hidden"}`} muted playsInline />
          <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${scanning ? "block" : "hidden"}`} width={320} height={240} />
          {!scanning && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Camera className="h-10 w-10" />
              <p className="text-sm">Press Start to begin scanning</p>
            </div>
          )}
          {scanning && (
            <div className="absolute bottom-2 left-2 right-2 text-xs font-medium px-2 py-1 rounded bg-black/60 text-white text-center">
              {scanStatus}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-center">
          {!scanning ? (
            <Button onClick={startScanning} disabled={!modelsLoaded}>
              <Camera className="h-4 w-4 mr-2" /> {modelsLoaded ? "Start Scanning" : "Loading models..."}
            </Button>
          ) : (
            <Button variant="outline" onClick={stopCamera}><Square className="h-4 w-4 mr-2" /> Pause</Button>
          )}
        </div>

        <div className="bg-muted rounded-lg p-3">
          <p className="text-sm font-medium mb-2">Present: {presentStudents.length} / {enrolledStudents.length}</p>
          <div className="flex flex-wrap gap-1.5">
            {presentStudents.map(s => (
              <Badge key={s.user_id} variant="default" className="text-xs">{s.full_name}</Badge>
            ))}
            {enrolledStudents.filter(s => !presentIdsRef.current.has(s.user_id)).map(s => (
              <Badge key={s.user_id} variant="secondary" className="text-xs opacity-50">{s.full_name}</Badge>
            ))}
          </div>
        </div>

        <Button onClick={saveAttendance} disabled={loading} className="w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Finish Attendance ({presentStudents.length} present)
        </Button>
      </CardContent>
    </Card>
  );

  const renderTopicInput = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Lecture Topic</CardTitle>
        <CardDescription>Enter today's lecture topic for {classInfo?.name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Introduction to Photosynthesis"
          className="text-lg"
        />
        <Button onClick={() => { setLectureStart(new Date()); setStep("lecturing"); }} disabled={!topic.trim()} className="w-full">
          <Play className="h-4 w-4 mr-2" /> Start Lecture
        </Button>
      </CardContent>
    </Card>
  );

  const renderLecturing = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Lecture in Progress</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 py-8">
        <div className="text-6xl font-mono font-bold text-primary">{formatTime(elapsed)}</div>
        <div className="text-center">
          <p className="text-lg font-medium">{topic}</p>
          <p className="text-sm text-muted-foreground">{classInfo?.name} • {presentStudents.length} students present</p>
        </div>
        <Button variant="destructive" size="lg" onClick={endLecture} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Square className="h-5 w-5 mr-2" />}
          End Lecture & Start Quiz
        </Button>
      </CardContent>
    </Card>
  );

  const renderQuiz = () => {
    const q = quizQuestions[currentQ];
    if (!q) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Question {currentQ + 1} / {quizQuestions.length}
          </CardTitle>
          <CardDescription>
            Selected students: {selectedForQuiz.map(s => s.full_name).join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-xl font-semibold text-center py-4 px-2">{q.question}</div>
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                className={`p-4 rounded-lg text-white font-bold text-left transition-all ${KAHOOT_COLORS[i]} ${
                  showAnswer && i === q.correct_index ? "ring-4 ring-primary scale-105" : ""
                } ${showAnswer && i !== q.correct_index ? "opacity-40" : ""}`}
              >
                <span className="text-2xl mr-2">{KAHOOT_SHAPES[i]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-center pt-2">
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)} size="lg">Reveal Answer</Button>
            ) : currentQ < quizQuestions.length - 1 ? (
              <Button onClick={() => { setCurrentQ(c => c + 1); setShowAnswer(false); }} size="lg">
                Next Question <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => setStep("grading")} size="lg">
                Grade Students <Award className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderGrading = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" /> Grade Selected Students</CardTitle>
        <CardDescription>Enter how many questions each student answered correctly (out of {quizQuestions.length})</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {selectedForQuiz.map(s => (
          <div key={s.user_id} className="flex items-center gap-3 bg-muted rounded-lg p-3">
            <div className="flex-1 font-medium">{s.full_name}</div>
            <Input
              type="number"
              min={0}
              max={quizQuestions.length}
              value={studentScores[s.user_id] ?? 0}
              onChange={e => setStudentScores(prev => ({ ...prev, [s.user_id]: Math.min(quizQuestions.length, Math.max(0, parseInt(e.target.value) || 0)) }))}
              className="w-20 text-center"
            />
            <span className="text-sm text-muted-foreground">/ {quizQuestions.length}</span>
          </div>
        ))}
        <Button onClick={finishSession} disabled={saving} className="w-full mt-4" size="lg">
          {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
          Save Grades & Generate Lecture Notes
        </Button>
      </CardContent>
    </Card>
  );

  const renderResults = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-primary" /> Session Complete!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{presentStudents.length}</p>
            <p className="text-xs text-muted-foreground">Students Present</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{enrolledStudents.length - presentStudents.length}</p>
            <p className="text-xs text-muted-foreground">Absent</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{selectedForQuiz.length}</p>
            <p className="text-xs text-muted-foreground">Quizzed</p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{quizQuestions.length}</p>
            <p className="text-xs text-muted-foreground">Questions</p>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-3">
          <p className="text-sm font-medium mb-2">Quiz Scores:</p>
          {selectedForQuiz.map(s => (
            <div key={s.user_id} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
              <span>{s.full_name}</span>
              <span className="font-mono">{studentScores[s.user_id] || 0}/{quizQuestions.length} ({Math.round(((studentScores[s.user_id] || 0) / quizQuestions.length) * 100)}%)</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground text-center">✅ Attendance saved • ✅ Grades recorded • ✅ Lecture notes uploaded</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="w-full">Start New Session</Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Classroom Robot</h1>
      </div>
      {renderProgress()}
      {step === "teacher_verify" && renderTeacherVerify()}
      {step === "class_detected" && renderClassDetected()}
      {step === "attendance" && renderAttendance()}
      {step === "topic_input" && renderTopicInput()}
      {step === "lecturing" && renderLecturing()}
      {step === "quiz" && renderQuiz()}
      {step === "grading" && renderGrading()}
      {step === "results" && renderResults()}
    </div>
  );
};

export default Robot;
