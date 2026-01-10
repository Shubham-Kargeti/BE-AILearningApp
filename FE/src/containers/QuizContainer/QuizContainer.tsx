import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  LinearProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import "./QuizContainer.scss";
import { quizService, authService, assessmentService } from "../../API/services";
import type {
  AssessmentQuestion,
  QuestionSet,
  QuestionType,
} from "../../AssessmentTypes/AssessmentTypes";
import { useLocation } from "react-router-dom";
import Editor from "@monaco-editor/react";

type NormalizedMCQOption = {
  option_id: string;
  text: string;
};

interface LocationState {
  assessmentId?: string;
  assessment?: {
    question_set_id?: string;
    required_skills?: Record<string, string>;
    duration_minutes?: number;
    title?: string;
    candidate_info?: {
      name?: string;
      email?: string;
      current_role?: string;
      experience?: string;
    } | null;
    additional_screening_question?: string;
  };
}

const QUESTION_TIME_DEFAULT = 30;

const QuizContainer = () => {
  /* ================= CORE UI STATE ================= */
  const [current, setCurrent] = useState(0);
  const [selectedOption, setSelected] = useState("");
  const [textAnswer, setTextAnswer] = useState("");

  /* ================= TIMERS ================= */
  const [quizTimer, setQuizTimer] = useState<number>(300);
  const [questionTimer, setQuestionTimer] =
    useState<number>(QUESTION_TIME_DEFAULT);

  /* ================= SECURITY / RULE ENFORCEMENT ================= */
  const [leftFullscreenCount, setLeftFullscreenCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  /* ================= SUBMISSION ================= */
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [answers, setAnswers] = useState<
    { question_id: number; selected_answer: string }[]
  >([]);

  const [question, setQuestion] =
    useState<AssessmentQuestion | null>(null);

  const [mcqQuestions, setMcqQuestions] = useState<QuestionSet>({
    question_set_id: "",
    skill: "",
    level: "",
    total_questions: 0,
    created_at: "",
    questions: [],
  });

  /* ================= META STATE ================= */
  const [loading, setLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  const [sessionStartedAnonymous, setSessionStartedAnonymous] =
    useState<boolean>(false);

  const [requiresLoginToStart, setRequiresLoginToStart] =
    useState<boolean>(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [screeningIndex, setScreeningIndex] = useState(0);
  const [debugResponse, setDebugResponse] = useState<any | null>(null);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [startReturnedEmpty, setStartReturnedEmpty] = useState(false);
  const [problemAssessmentId, setProblemAssessmentId] = useState<string | null>(null);

  const [quizResult, setQuizResult] = useState<{
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    percentage: number;
    status: string;
  } | null>(null);

  const [additionalScreeningQuestion, setAdditionalScreeningQuestion] =
    useState<string | null>(null);

  const [additionalScreeningAnswer, setAdditionalScreeningAnswer] =
    useState<string>("");

  const [questionStatus, setQuestionStatus] = useState<{
    [key: number]: 'not-visited' | 'not-answered' | 'answered' | 'marked-for-review'
  }>({});

  const [expiredQuestions, setExpiredQuestions] = useState<Set<number>>(new Set());

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  /* ================= REFS ================= */
  const initialQuizDurationRef = useRef<number>(quizTimer);
  const recognitionRef = useRef<any>(null);
  const questionTimeRef = useRef<number>(QUESTION_TIME_DEFAULT);
  const mcqQuestionsRef = useRef(mcqQuestions);

  // Keep ref in sync with state
  useEffect(() => {
    mcqQuestionsRef.current = mcqQuestions;
  }, [mcqQuestions]);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setTextAnswer((prev) => prev + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {

        setIsListening(false);
        if (event.error === 'not-allowed') {
          setToastMessage('Microphone access denied. Please allow microphone access.');
          setShowToast(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  /* ================= ROUTER ================= */
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  const assessmentData = locationState?.assessment ?? null;
  const isAdminAssessment = Boolean(
    assessmentData?.question_set_id
  );

  const isAdditionalQuestionStep =
    !submitted && !!additionalScreeningQuestion && current === mcqQuestions.questions.length;

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage("Copied assessment id to clipboard");
      setShowToast(true);
    } catch (err) {

      setToastMessage("Failed to copy");
      setShowToast(true);
    }
  };

  const getQuestionDuration = useCallback((questionType: QuestionType | 'screening'): number => {
    switch (questionType) {
      case 'mcq':
        return 30; // 30 seconds
      case 'architecture':
        return 120; // 2 minutes
      case 'coding':
        return 600; // 10 minutes
      case 'screening':
        return 120; // 2 minutes
      default:
        return 30;
    }
  }, []);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {

      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const navigateToQuestion = useCallback((index: number) => {
    if (index < 0 || index >= mcqQuestions.questions.length) return;

    // Prevent navigation to expired questions
    if (expiredQuestions.has(index)) {

      setToastMessage(`Question ${index + 1} is locked - time expired`);
      setShowToast(true);
      return;
    }

    setCurrent(index);
    setQuestion(mcqQuestions.questions[index]);

    // Set question timer based on question type
    const questionDuration = getQuestionDuration(mcqQuestions.questions[index].question_type);
    questionTimeRef.current = questionDuration;
    setQuestionTimer(questionDuration);

    const existingAnswer = answers.find(
      (a) => a.question_id === ((mcqQuestions.questions[index] as any).question_id ?? (mcqQuestions.questions[index] as any).id)
    );

    if (existingAnswer) {
      if (mcqQuestions.questions[index].question_type === "mcq") {
        setSelected(existingAnswer.selected_answer);
        setTextAnswer("");
      } else {
        setTextAnswer(existingAnswer.selected_answer);
        setSelected("");
      }
    } else {
      setSelected("");
      setTextAnswer("");
    }

    setQuestionStatus(prev => {
      if (!prev[index]) {
        return { ...prev, [index]: 'not-answered' };
      }
      return prev;
    });
  }, [mcqQuestions.questions, answers, getQuestionDuration, expiredQuestions]);

  /* ================================================================
     ✅ ALL FUNCTIONS DEFINED BEFORE HOOKS
     ================================================================ */

  const getMCQsBasedOnProfile = async () => {
    try {
      const token = localStorage.getItem("authToken");
      setSessionStartedAnonymous(!token);
      setLoading(true);
      setError(null);

      let topic = "";
      let level = "intermediate";
      let subtopics: string[] = [];

      const userProfile = localStorage.getItem("userProfile");
      const profileData = userProfile ? JSON.parse(userProfile) : {};

      topic = profileData.topic || "";
      level = profileData.level || "intermediate";
      subtopics = profileData.subtopics || [];

      if (!topic) {
        setError("No topic specified for the quiz.");
        setLoading(false);
        return;
      }

      const res = await quizService.generateMCQs(
        topic,
        level,
        subtopics
      );

      const normalizedQuestions = (res.questions || []).map((q) => ({ ...(q as any), question_type: "mcq" as QuestionType })) as AssessmentQuestion[];
      setMcqQuestions({ ...res, questions: normalizedQuestions });
      setQuestion((normalizedQuestions[0] as AssessmentQuestion) ?? null);
      setLoading(false);
    } catch (err) {

      setError("Unable to load questions.");
      setLoading(false);
    }
  };

  const loadPreGeneratedQuestionSet = async () => {
    try {

      if (!assessmentData?.question_set_id) {
        setError("Invalid assessment link.");
        setLoading(false);
        return;
      }

      const res = await quizService.startQuiz(
        assessmentData.question_set_id,
        {
          candidate_name:
            assessmentData?.candidate_info?.name,
          candidate_email:
            assessmentData?.candidate_info?.email,
        }
      );

      setDebugResponse(res);

      const normalizedQuestions = (res.questions || []).map((q) => ({ ...(q as any), question_type: ((q as any).question_type ?? "mcq") as QuestionType })) as AssessmentQuestion[];
      let finalQuestions = normalizedQuestions;
      const startHadNoQuestions = !finalQuestions || finalQuestions.length === 0;
      if (startHadNoQuestions) {

        const fallback = (locationState?.assessment as any)?.questions ?? (assessmentData as any)?.questions ?? [];
        if (Array.isArray(fallback) && fallback.length > 0) {
          finalQuestions = (fallback || []).map((q: any) => ({ ...(q as any), question_type: ((q as any).question_type ?? "mcq") as QuestionType }));

          setUsedFallback(true);
          const aid = (locationState?.assessment as any)?.assessment_id || (assessmentData as any)?.assessment_id || (locationState?.assessmentId as any) || null;
          setProblemAssessmentId(aid ?? null);
        }
      }

      if (!finalQuestions || finalQuestions.length === 0) {
                const aid = (locationState?.assessment as any)?.assessment_id || (assessmentData as any)?.assessment_id || (locationState?.assessmentId as any) || null;
        setProblemAssessmentId(aid ?? null);
        setStartReturnedEmpty(true);
        setError("The assessment did not return any questions. Please refresh, retry, or contact the administrator.");
        setLoading(false);
        return;
      }
      const questionSet: QuestionSet = {
        question_set_id: res.question_set_id,
        skill: res.skill,
        level: res.level,
        total_questions: res.total_questions,
        created_at: res.started_at,
        questions: finalQuestions,
      };

      setMcqQuestions(questionSet);
      setQuestion((finalQuestions[0] as AssessmentQuestion) ?? null);
      setLoading(false);
    } catch (err) {

      setError(
        "Unable to load assessment. Please contact admin."
      );
      setLoading(false);
    }
  };

  const getQuizSessionId = async () => {
    if (!mcqQuestions.question_set_id) {
      setError("Questions not loaded. Please refresh and try again.");
      setToastMessage("Questions not loaded. Please refresh.");
      setShowToast(true);
      return;
    }

    try {
      const candidateEmail =
        locationState?.assessment?.candidate_info?.email;
      const currentUserEmail =
        localStorage.getItem("userEmail");

      if (
        candidateEmail &&
        currentUserEmail &&
        candidateEmail !== currentUserEmail
      ) {
        setRequiresLoginToStart(true);
        setError(
          "This assessment link is reserved for a specific candidate. Please login as the candidate to start."
        );
        setToastMessage(
          "Please login as the candidate to start the assessment."
        );
        setShowToast(true);
        return;
      }

      const candidateInfo: {
        candidate_name?: string;
        candidate_email?: string;
      } = {};

      if (locationState?.assessment?.candidate_info) {
        candidateInfo.candidate_name =
          locationState.assessment.candidate_info.name;
        candidateInfo.candidate_email =
          locationState.assessment.candidate_info.email;
      } else if (localStorage.getItem("userEmail")) {
        candidateInfo.candidate_email =
          localStorage.getItem("userEmail") as string;
      }

      const res = await quizService.startQuiz(
        mcqQuestions.question_set_id,
        candidateInfo
      );

      setDebugResponse(res);

      setSessionId(res.session_id);

      // Calculate total duration based on question types
      let calculatedDuration = 0;
      mcqQuestions.questions.forEach((q) => {
        calculatedDuration += getQuestionDuration(q.question_type);
      });

      // Add screening question time if exists
      if (locationState?.assessment?.additional_screening_question) {
        calculatedDuration += getQuestionDuration('screening');
      }

      const initialDuration = calculatedDuration || 300;

      initialQuizDurationRef.current = initialDuration;
      setQuizTimer(initialDuration);

      // Set initial question timer based on first question type
      const firstQuestionDuration = mcqQuestions.questions.length > 0
        ? getQuestionDuration(mcqQuestions.questions[0].question_type)
        : 30;

      questionTimeRef.current = firstQuestionDuration;
      setQuestionTimer(firstQuestionDuration);

      document.documentElement
        .requestFullscreen()
        .catch(() => { });
      document.addEventListener(
        "contextmenu",
        (e) => e.preventDefault()
      );

      setQuizStarted(true);

    } catch (error: any) {

      const status = error?.response?.status;

      if (status === 401) {
        setError(
          "You must be logged in to start this assessment."
        );
        setToastMessage(
          "Authentication required. Please login to continue."
        );
      } else if (status === 403) {
        setError(
          "Your account does not have permission to start this assessment."
        );
        setToastMessage(
          "Account inactive or unauthorized. Contact admin."
        );
        setRequiresLoginToStart(true);
      } else {
        setError(
          "Unable to start quiz. Please try again later."
        );
        setToastMessage(
          "Error starting quiz. Please try again."
        );
      }
      setShowToast(true);
    }
  };

  const loginAsCandidateAndStart = async () => {
    const candidateEmail =
      locationState?.assessment?.candidate_info?.email ||
      localStorage.getItem("userEmail");

    if (!candidateEmail) {
      window.location.href = "/login";
      return;
    }

    try {
      const res = await authService.login(candidateEmail);
      if (res?.access_token) {
        localStorage.setItem("authToken", res.access_token);
        localStorage.setItem("userEmail", candidateEmail);
        setRequiresLoginToStart(false);
        await getQuizSessionId();
      }
    } catch (err) {

    }
  };

  const submitQuizAnswers = useCallback(async (
    answersToSubmit: {
      question_id: number;
      selected_answer: string;
    }[]
  ) => {
    try {
      setIsSubmitting(true);

      let score = 0;
      let correctCount = 0;

      try {
        const res = await quizService.submitQuiz(
          sessionId,
          answersToSubmit,
          sessionStartedAnonymous
        );

        score = res.score_percentage ?? 0;
        correctCount =
          res.correct_answers ??
          Math.round((score / 100) * answersToSubmit.length);

        localStorage.setItem("latestScore", score.toString());
        localStorage.setItem(
          "quizResult",
          JSON.stringify({
            score,
            totalQuestions: answersToSubmit.length,
            correctAnswers: correctCount,
            percentage: score,
            completedAt: new Date().toISOString(),
          })
        );
      } catch (apiError) {

      }

      setQuizResult({
        score,
        totalQuestions: answersToSubmit.length,
        correctAnswers: correctCount,
        percentage: score,
        status: "Submitted",
      });

      try {
        if (screeningQuestions.length > 0) {
          const screeningAnswers = answersToSubmit
            .filter((a) => a.question_id < 0)
            .sort((a, b) => b.question_id - a.question_id)
            .map((a) => a.selected_answer);

          const assessmentId = (locationState?.assessment as any)?.assessment_id || (locationState?.assessmentId as string | undefined);
          const candidateSessionId = (locationState as any)?.candidateSessionId || localStorage.getItem("candidateSessionId");

          if (assessmentId && screeningAnswers.length > 0) {
            localStorage.setItem(`screeningAnswers_${assessmentId}`, JSON.stringify({ answers: screeningAnswers, ts: Date.now() }));
            try {
              await assessmentService.submitScreeningResponses(assessmentId, { answers: screeningAnswers, candidate_session_id: candidateSessionId || undefined });

            } catch (subErr) {

            }
          }
        }
      } catch (err) {

      }

    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, sessionStartedAnonymous, screeningQuestions, locationState]);

  const goNext = useCallback(() => {

    if (isAdditionalQuestionStep) {

      setAnswers((prev) => [
        ...prev,
        {
          question_id: -1 - screeningIndex,
          selected_answer: additionalScreeningAnswer,
        },
      ]);

      const nextIndex = screeningIndex + 1;

      if (nextIndex < screeningQuestions.length) {
        setScreeningIndex(nextIndex);
        setAdditionalScreeningQuestion(
          screeningQuestions[nextIndex]
        );
        setAdditionalScreeningAnswer("");
        return;
      }

      setSubmitted(true);
      return;
    }

    const currentQuestion = mcqQuestions.questions[current];
    if (!currentQuestion) return;

    const qid =
      (currentQuestion as any).question_id ??
      (currentQuestion as any).id;

    setAnswers((prev) => [
      ...prev,
      {
        question_id: qid,
        selected_answer:
          currentQuestion.question_type === "mcq"
            ? selectedOption
            : textAnswer,
      },
    ]);

    setSelected("");
    setTextAnswer("");

    if (current < mcqQuestions.questions.length - 1) {
      const nextIndex = current + 1;
      setCurrent(nextIndex);
      setQuestion(mcqQuestions.questions[nextIndex]);
      setQuestionTimer(questionTimeRef.current);

      const snapped = Math.max(
        0,
        initialQuizDurationRef.current -
        nextIndex * questionTimeRef.current
      );
      setQuizTimer(snapped);
    } else {

      // Check if there are any screening questions
      if (additionalScreeningQuestion || screeningQuestions.length > 0) {

        setCurrent((i) => i + 1);
      } else {

        setSubmitted(true);
      }
    }
  }, [
    current,
    screeningIndex,
    screeningQuestions,
    isAdditionalQuestionStep,
    additionalScreeningAnswer,
    mcqQuestions.questions,
    selectedOption,
    textAnswer
  ]);

  const saveAndNext = useCallback(() => {
    const currentQuestion = mcqQuestions.questions[current];
    if (!currentQuestion) return;

    const qid = (currentQuestion as any).question_id ?? (currentQuestion as any).id;
    const answer = currentQuestion.question_type === "mcq" ? selectedOption : textAnswer;

    if (answer.trim()) {
      setAnswers((prev) => {
        const filtered = prev.filter((a) => a.question_id !== qid);
        return [...filtered, { question_id: qid, selected_answer: answer }];
      });
      setQuestionStatus(prev => ({ ...prev, [current]: 'answered' }));
    } else {
      setQuestionStatus(prev => ({ ...prev, [current]: 'not-answered' }));
    }

    if (current < mcqQuestions.questions.length - 1) {
      navigateToQuestion(current + 1);
    } else {
      // Last question - trigger goNext to handle screening or submission

      goNext();
    }
  }, [current, mcqQuestions.questions, selectedOption, textAnswer, navigateToQuestion, goNext]);

  /* ================================================================
     ✅ ALL HOOKS AFTER FUNCTION DEFINITIONS
     ================================================================ */

  useEffect(() => {

    if (isAdminAssessment) {
      loadPreGeneratedQuestionSet();
    } else {
      getMCQsBasedOnProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start quiz when questions are loaded
  useEffect(() => {
    if (!quizStarted && mcqQuestions.questions.length > 0 && !loading && !error) {

      getQuizSessionId();
    }
  }, [mcqQuestions.questions.length, quizStarted, loading, error]);

  useEffect(() => {

    // Check for additional_screening_question in assessment
    if (locationState?.assessment?.additional_screening_question) {

      setAdditionalScreeningQuestion(locationState.assessment.additional_screening_question);
    }

    // Also check description for screening_questions array
    if (!((locationState?.assessment as any)?.description)) return;

    try {
      const raw = (locationState?.assessment as any)?.description;

      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : raw;

      if (Array.isArray(parsed.screening_questions)) {
        setScreeningQuestions(parsed.screening_questions);
        setScreeningIndex(0);

        setAdditionalScreeningQuestion(
          parsed.screening_questions[0]
        );

      }
    } catch (err) {

    }
  }, [locationState]);

  useEffect(() => {
    const handleExit = () => {
      if (!document.fullscreenElement) {
        setLeftFullscreenCount((prev) => prev + 1);
        setShowWarning(true);
      }
    };

    const handleTabChange = () => {
      if (document.hidden) {
        setLeftFullscreenCount((prev) => prev + 1);
        setShowWarning(true);
      }
    };

    document.addEventListener(
      "fullscreenchange",
      handleExit
    );
    document.addEventListener(
      "visibilitychange",
      handleTabChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleExit
      );
      document.removeEventListener(
        "visibilitychange",
        handleTabChange
      );
    };
  }, []);

  useEffect(() => {
    if (leftFullscreenCount >= 2) {
      alert("Quiz submitted due to rule violation.");
      window.location.href = "/app/dashboard";
    }
  }, [leftFullscreenCount]);

  useEffect(() => {
    const blockEvents = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey &&
          ["c", "v", "s", "u", "p"].includes(
            e.key.toLowerCase()
          )) ||
        e.key === "PrintScreen" ||
        e.key === "F12"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const disableCopy = (e: ClipboardEvent) =>
      e.preventDefault();
    const disableContext = (e: MouseEvent) =>
      e.preventDefault();

    document.addEventListener("keydown", blockEvents);
    document.addEventListener("copy", disableCopy);
    document.addEventListener("paste", disableCopy);
    document.addEventListener(
      "contextmenu",
      disableContext
    );

    return () => {
      document.removeEventListener(
        "keydown",
        blockEvents
      );
      document.removeEventListener("copy", disableCopy);
      document.removeEventListener("paste", disableCopy);
      document.removeEventListener(
        "contextmenu",
        disableContext
      );
    };
  }, []);

  useEffect(() => {
    if (!quizStarted || submitted) {

      return;
    }

    const interval = setInterval(() => {
      setQuizTimer((prev) => {
        const newVal = prev - 1;

        if (newVal <= 0) {

          setSubmitted(true);
          return 0;
        }
        return newVal;
      });

      setQuestionTimer((prevTime) => {
        const newTime = prevTime - 1;

        if (newTime <= 0) {

          // Auto-advance to next question when time expires
          setCurrent((currentIdx) => {
            // Mark current question as expired
            setExpiredQuestions(prev => {
              const newSet = new Set(prev);
              newSet.add(currentIdx);
              return newSet;
            });

            const nextIdx = currentIdx + 1;
            const questions = mcqQuestionsRef.current.questions;

            if (nextIdx < questions.length) {
              // Set the timer for the next question
              const nextQuestion = questions[nextIdx];
              const nextDuration = getQuestionDuration(nextQuestion.question_type);
              questionTimeRef.current = nextDuration;

              setTimeout(() => {
                setQuestionTimer(nextDuration);
                setQuestion(nextQuestion);
                setSelected("");
                setTextAnswer("");
              }, 0);
              
              return nextIdx;
            }
            return currentIdx;
          });
          return questionTimeRef.current;
        }
        return newTime;
      });
    }, 1000);

    return () => {

      clearInterval(interval);
    };
  }, [quizStarted, submitted, getQuestionDuration]);

  useEffect(() => {
    if (submitted && !quizResult && !isSubmitting) {
      submitQuizAnswers(answers);
    }
  }, [submitted, answers, quizResult, isSubmitting, submitQuizAnswers]);

  // Cleanup speech recognition on unmount or question change
  useEffect(() => {
    return () => {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    };
  }, [current, isListening]);

  /* ================================================================
     ✅ EARLY RETURNS AFTER ALL HOOKS
     ================================================================ */

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><LinearProgress /></Box>;
  
  if (error)
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        {startReturnedEmpty && problemAssessmentId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Admin action needed:</strong> The assessment <code>{problemAssessmentId}</code> returned no questions on start. Please republish or re-generate the question set from the admin panel.
            <Box sx={{ mt: 1, display: "flex", gap: 1, justifyContent: "center" }}>
              <Button size="small" variant="outlined" onClick={() => copyToClipboard(problemAssessmentId)}>Copy Assessment ID</Button>
              <Button size="small" variant="contained" component="a" href={`/app/assessment/${problemAssessmentId}/view`}>Open Assessment</Button>
            </Box>
          </Alert>
        )}
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mb: 2 }}>
          <Button variant="contained" onClick={() => {
            setError(null);
            setLoading(true);
            if (isAdminAssessment) {
              loadPreGeneratedQuestionSet();
            } else {
              getMCQsBasedOnProfile();
            }
          }}>Retry</Button>
          <Button variant="outlined" href="mailto:admin@example.com">Contact Admin</Button>
          {debugResponse && (
            <Button variant="text" onClick={() => setShowRawResponse((s) => !s)}>
              {showRawResponse ? "Hide Raw Response" : "Show Raw Response"}
            </Button>
          )}
        </Box>

        {showRawResponse && debugResponse && (
          <Box sx={{ textAlign: "left", maxWidth: "100%", overflow: "auto", bgcolor: "#0b1220", color: "#dfe7ef", p: 2, borderRadius: 1 }}>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{JSON.stringify(debugResponse, null, 2)}</pre>
          </Box>
        )}
      </Box>
    );

  if (!question && !loading && !error) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Alert severity="warning">
          No questions are available for this assessment. Please refresh the page or
          contact the administrator if the problem persists.
        </Alert>
        <Box sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", textAlign: "left", borderRadius: 1, fontSize: 12, fontFamily: "monospace" }}>
          <strong>DEBUG STATE:</strong>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify({
              loading,
              error,
              question: question ? "present" : "null",
              mcqQuestionsCount: mcqQuestions.questions.length,
              quizStarted,
              submitted,
              isAdditionalQuestionStep,
              debugResponse: debugResponse ? "present" : "null",
            }, null, 2)}
          </pre>
        </Box>
      </Box>
    );
  }

  if (isAdditionalQuestionStep) {

    return (
      <Box className="quiz-layout">
        <Box className="quiz-main-content">
          <Box className="quiz-top-header">
            <Box className="timer-display">
              <Typography className="timer-text">
                ⏰ {formatTime(quizTimer)}
              </Typography>
            </Box>
          </Box>

          <Box className="question-section">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Typography className="question-number">
                Screening Question
              </Typography>
              <Box className="question-timer">
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#667eea' }}>
                  ⏱ {Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')}
                </Typography>
              </Box>
            </Box>
            <Typography className="question-text">
              {additionalScreeningQuestion}
            </Typography>
          </Box>

          <Box className="answer-section">
            <Editor
              height="400px"
              language="javascript"
              value={additionalScreeningAnswer}
              onChange={(v) =>
                setAdditionalScreeningAnswer(v || "")
              }
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </Box>

          <Box className="navigation-buttons">
            <Button
              className="submit-btn"
              variant="contained"
              onClick={goNext}
              disabled={!additionalScreeningAnswer.trim()}
            >
              Submit Screening Answer
            </Button>
          </Box>
        </Box>

        <Box className="quiz-sidebar">
          <Typography className="sidebar-title">Assessment Progress</Typography>
          <Box className="summary-section">
            <Typography sx={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
              Final Screening Question
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  if (submitted && isSubmitting) {
    return (
      <Box className="submission-screen">
        <Typography className="submitted-title">
          Submitting Quiz...
        </Typography>
        <Typography className="submitted-text">
          The answers are submitted. Your admin will share the result soon.
        </Typography>
      </Box>
    );
  }

  if (submitted && quizResult && !isSubmitting) {
    return (
      <Box className="submission-screen">
        <Typography className="submitted-title">
          Quiz Submitted
        </Typography>

        <Typography className="submitted-text">
          Thank you for completing the assessment.
          Your responses have been recorded.
        </Typography>

        <Typography sx={{ mt: 2 }}>
          Status: {quizResult.status}
        </Typography>
      </Box>
    );
  }

  if (!question) return null;

  const isMcq =
    question.question_type === "mcq" ||
    Array.isArray(question.options);

  const mcqOptions: NormalizedMCQOption[] = isMcq
    ? Array.isArray(question.options)
      ? question.options
      : question.options
        ? Object.entries(question.options).map(
          ([option_id, text]) => ({
            option_id,
            text: String(text),
          })
        )
        : []
    : [];

  const attemptedCount = Object.values(questionStatus).filter(s => s === 'answered').length;
  const notAttemptedCount = mcqQuestions.questions.length - attemptedCount;
  const totalScreeningQuestions = screeningQuestions.length + (additionalScreeningQuestion ? 1 : 0);
  const hasScreeningQuestions = totalScreeningQuestions > 0;

  return (
    <>
      <Box className="quiz-layout">
        {/* Main Content Area */}
        <Box className="quiz-main-content">
          {/* Header with Timer */}
          <Box className="quiz-top-header">
            <Box className="test-info">
              <Typography className="test-name">
                {assessmentData?.title || mcqQuestions.skill || 'Assessment'}
              </Typography>
            </Box>
            <Box className="timer-display">
              <Typography className="timer-text">
                ⏰ {formatTime(quizTimer)}
              </Typography>
            </Box>
          </Box>

          {/* Question Content */}
          <Box className="question-section">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Typography className="question-number">
                Question {current + 1}
              </Typography>
              <Box className="question-timer">
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: questionTimer <= 10 ? '#ef4444' : '#667eea' }}>
                  ⏱ {Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')}
                </Typography>
              </Box>
            </Box>
            <Typography className="question-text">
              {question.question_text}
            </Typography>
          </Box>

          {/* Answer Options */}
          <Box className="answer-section">
            {question.question_type === "screening" && (
              <textarea
                className="text-answer-field"
                placeholder="Write your answer here..."
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
              />
            )}

            {isMcq && (
              <RadioGroup
                value={selectedOption}
                onChange={(e) => setSelected(e.target.value)}
                className="options-group"
              >
                {mcqOptions.map((opt, idx) => (
                  <Box key={opt.option_id} className="option-item">
                    <FormControlLabel
                      value={opt.option_id}
                      control={<Radio />}
                      label={
                        <Box className="option-label">
                          <span className="option-letter">{String.fromCharCode(65 + idx)}.</span>
                          <span className="option-text">{opt.text}</span>
                        </Box>
                      }
                    />
                  </Box>
                ))}
              </RadioGroup>
            )}

            {question.question_type === "coding" && (() => {
              const constraints = question.meta?.constraints ?? [];
              const language = question.meta?.language ?? "plaintext";

              return (
                <Box className="coding-section">
                  <Typography className="code-language">
                    Language: {language}
                  </Typography>

                  {constraints.length > 0 && (
                    <Box className="constraints">
                      <Typography className="constraints-title">Constraints:</Typography>
                      <ul>
                        {constraints.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}\n                      </ul>
                    </Box>
                  )}

                  <Editor
                    height="400px"
                    language={language}
                    value={textAnswer}
                    onChange={(v) => setTextAnswer(v || "")}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: "on",
                      automaticLayout: true,
                    }}
                  />
                </Box>
              );
            })()}

            {question.question_type === "architecture" && (() => {
              const focusAreas = question.meta?.focus_areas ?? [];

              return (
                <Box className="architecture-section">
                  {focusAreas.length > 0 && (
                    <Box className="focus-areas">
                      <Typography className="focus-title">Focus Areas:</Typography>
                      <ul>
                        {focusAreas.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </Box>
                  )}

                  <Box sx={{ position: 'relative' }}>
                    <textarea
                      className="architecture-textarea"
                      placeholder="Describe your system design, components, data flow, scalability, reliability, and trade-offs... (or click the microphone to speak your answer)"
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                    />
                    {speechSupported && (
                      <Button
                        onClick={isListening ? stopListening : startListening}
                        sx={{
                          position: 'absolute',
                          bottom: '12px',
                          right: '12px',
                          minWidth: '48px',
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: isListening ? '#ef4444' : '#667eea',
                          color: '#ffffff',
                          fontSize: '20px',
                          '&:hover': {
                            backgroundColor: isListening ? '#dc2626' : '#5568d3',
                          },
                          boxShadow: isListening ? '0 0 0 4px rgba(239, 68, 68, 0.2)' : '0 2px 8px rgba(102, 126, 234, 0.3)',
                          animation: isListening ? 'pulse 1.5s infinite' : 'none',
                        }}
                        title={isListening ? 'Stop recording' : 'Start voice input'}
                      >
                        {isListening ? '🔴' : '🎤'}
                      </Button>
                    )}
                  </Box>
                </Box>
              );
            })()}
          </Box>

          {/* Navigation Buttons */}
          <Box className="navigation-buttons">
            <Button
              variant="outlined"
              className="nav-btn prev-btn"
              onClick={() => navigateToQuestion(current - 1)}
              disabled={current === 0}
            >
              Previous
            </Button>
            <Button
              variant="contained"
              className="nav-btn save-next-btn"
              onClick={saveAndNext}
            >
              Save & Next
            </Button>
            {current === mcqQuestions.questions.length - 1 && !additionalScreeningQuestion && screeningQuestions.length === 0 && (
              <Button
                variant="contained"
                className="nav-btn submit-btn"
                onClick={() => setSubmitted(true)}
              >
                Submit Test
              </Button>
            )}
          </Box>
        </Box>

        {/* Right Sidebar - Question Grid */}
        <Box className="quiz-sidebar">
          <Box className="candidate-info">
            <Box className="avatar-circle">
              <Typography className="avatar-text"></Typography>
            </Box>
          </Box>

          {/* Question Grid */}
          <Box className="question-grid">
            {mcqQuestions.questions.map((_, idx) => {
              const status = questionStatus[idx] || 'not-visited';
              const isCurrentQuestion = idx === current;
              const isExpired = expiredQuestions.has(idx);
              
              return (
                <Button
                  key={idx}
                  className={`grid-question-btn ${
                    isCurrentQuestion ? 'current' : ''
                  } ${status} ${isExpired ? 'expired' : ''}`}
                  onClick={() => navigateToQuestion(idx)}
                  disabled={isExpired}
                  title={isExpired ? `Question ${idx + 1} - Time Expired (Locked)` : `Question ${idx + 1}`}
                >
                  {isExpired ? '🔒' : idx + 1}
                </Button>
              );
            })}
          </Box>

          {/* Summary */}
          <Box className="summary-section">
            <Typography className="summary-title">Overall Summary</Typography>
            <Box className="summary-item">
              <Box className="summary-indicator answered"></Box>
              <Typography className="summary-text">{attemptedCount} Attempted</Typography>
            </Box>
            <Box className="summary-item">
              <Box className="summary-indicator not-answered"></Box>
              <Typography className="summary-text">{notAttemptedCount} Not Attempted</Typography>
            </Box>
            {hasScreeningQuestions && (
              <Box className="summary-item" sx={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e4e8' }}>
                <Box className="summary-indicator" sx={{ backgroundColor: '#f59e0b' }}></Box>
                <Typography className="summary-text">{totalScreeningQuestions} Screening Question{totalScreeningQuestions > 1 ? 's' : ''}</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={showToast}
        autoHideDuration={3000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <Alert severity="error" variant="filled">
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default QuizContainer;
