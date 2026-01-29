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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import "./QuizContainer.scss";
import { quizService, assessmentService, assessmentProgressService } from "../../API/services";
import type {
  AssessmentQuestion,
  QuestionSet,
  QuestionType,
} from "../../AssessmentTypes/AssessmentTypes";
import { useLocation } from "react-router-dom";
import Editor from "@monaco-editor/react";
import PreAssessmentScreen from "./PreAssessmentScreen";

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
    job_title?: string;
    description?: any;
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
const NOT_ANSWERED = "NOT_ANSWERED";

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
  const [_showWarning, setShowWarning] = useState(false);

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
  const [showPreAssessment, setShowPreAssessment] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  const [sessionStartedAnonymous, setSessionStartedAnonymous] =
    useState<boolean>(false);

  const [_requiresLoginToStart, setRequiresLoginToStart] =
    useState<boolean>(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showAutoSubmitWarning, setShowAutoSubmitWarning] = useState(false);

  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [screeningIndex, setScreeningIndex] = useState(0);
  const [debugResponse, setDebugResponse] = useState<any | null>(null);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);
  const [_usedFallback, setUsedFallback] = useState(false);
  const [startReturnedEmpty, setStartReturnedEmpty] = useState(false);
  const [problemAssessmentId, setProblemAssessmentId] = useState<string | null>(null);
  const isAdditionalQuestionStepRef = useRef(false);


  const [quizResult, setQuizResult] = useState<{
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    percentage: number;
    status: "Submitted" | "SubmissionFailed";
  } | null>(null);
  const [questionStatus, setQuestionStatus] = useState<Record<number, 'answered' | 'not-answered'>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [questionFilter, setQuestionFilter] = useState<'all' | 'answered' | 'unanswered' | 'marked'>('all');

  // Coding question language state
  const [codingLanguage, setCodingLanguage] = useState<string>("javascript");

  // Additional question / screening state
  const [additionalScreeningQuestion, setAdditionalScreeningQuestion] = useState<string | null>(null);
  const [additionalScreeningAnswer, setAdditionalScreeningAnswer] = useState<string>("");

  // Candidate identification (for anonymous flows)
  const [candidateEmail, setCandidateEmail] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);

  // Track expired questions (time expired and locked)
  const [expiredQuestions, setExpiredQuestions] = useState<Set<number>>(new Set());

  // Mutable refs for timing and current questions
  const questionTimeRef = useRef<number>(QUESTION_TIME_DEFAULT);
  const initialQuizDurationRef = useRef<number>(quizTimer);
  const mcqQuestionsRef = useRef<QuestionSet>(mcqQuestions);

  useEffect(() => {
    mcqQuestionsRef.current = mcqQuestions;
  }, [mcqQuestions]);

  useEffect(() => {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
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
          // Check if we're on a screening question
          // const isOnScreeningQuestion = !submitted && !!additionalScreeningQuestion && current === mcqQuestions.questions.length;
          const isOnScreeningQuestion = isAdditionalQuestionStepRef.current;
          console.log('Final Transcript:', finalTranscript, 'IsOnScreeningQuestion:', isOnScreeningQuestion);
          
          if (isOnScreeningQuestion) {
            setAdditionalScreeningAnswer((prev) => prev + finalTranscript);
          } else {
            setTextAnswer((prev) => prev + finalTranscript);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setToastMessage('Microphone access denied. Please allow microphone access.');
          setShowToast(true);
        } else if (event.error === 'no-speech') {
          setToastMessage('No speech detected. Please try again.');
          setShowToast(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

        recognitionRef.current = recognition;
      } else {
        console.warn('Speech recognition not supported in this browser');
      }
  }, []);

  /* ================= ROUTER ================= */
  const location = useLocation();
  // Avoid complex 'as' union types here to keep the parser happy
  const locationState = (location.state as LocationState) ?? null;

  const assessmentData = locationState ? locationState.assessment : null;
  const isAdminAssessment = Boolean(
    assessmentData?.question_set_id
  );

  const isAdditionalQuestionStep =
    !submitted && !!additionalScreeningQuestion && current === mcqQuestions.questions.length;

    useEffect(() => {
  isAdditionalQuestionStepRef.current = isAdditionalQuestionStep;
}, [isAdditionalQuestionStep]);  

  // Load saved progress on mount
  useEffect(() => {
    const email = locationState?.assessment?.candidate_info?.email || localStorage.getItem("userEmail");
    const name = locationState?.assessment?.candidate_info?.name || "";
    
    if (email) {
      setCandidateEmail(email);
      setCandidateName(name);
      
      // Try to load saved progress
      assessmentProgressService.loadProgress(email)
        .then((savedProgress) => {
          if (savedProgress && !savedProgress.is_completed) {
            // Restore saved state
            setCurrent(savedProgress.current_question_index);
            
            // Restore answers
            const restoredAnswers = Object.entries(savedProgress.answers).map(([qId, answer]) => ({
              question_id: parseInt(qId),
              selected_answer: answer as string,
            }));
            setAnswers(restoredAnswers);
            
            // Restore question status
            setQuestionStatus(savedProgress.question_status);
            
            // Restore expired questions
            setExpiredQuestions(new Set(savedProgress.expired_questions));
            
            // Restore timer
            if (savedProgress.remaining_time_seconds) {
              setQuizTimer(savedProgress.remaining_time_seconds);
            }
            if (savedProgress.initial_duration_seconds) {
              initialQuizDurationRef.current = savedProgress.initial_duration_seconds;
            }
            
            setToastMessage('Previous progress restored');
            setShowToast(true);
          }
        })
        .catch(() => {
          // No saved progress or error - start fresh
        });
    }
  }, [locationState]);

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
        console.log('Speech recognition started');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setToastMessage('Unable to start voice input. Please try again.');
        setShowToast(true);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleMarkForReview = useCallback(() => {
    setMarkedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(current)) {
        newSet.delete(current);
      } else {
        newSet.add(current);
      }
      return newSet;
    });
  }, [current]);

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

  // Keyboard shortcuts for question navigation
  useEffect(() => {
    if (!quizStarted || submitted) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch(e.key) {
        case 'ArrowLeft':
          if (current > 0) {
            navigateToQuestion(current - 1);
          }
          break;
        case 'ArrowRight':
          if (current < mcqQuestions.questions.length - 1) {
            navigateToQuestion(current + 1);
          }
          break;
        case 'm':
        case 'M':
          toggleMarkForReview();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [quizStarted, submitted, current, mcqQuestions.questions.length, navigateToQuestion, toggleMarkForReview]);

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

  // NOTE: login helper removed because it's currently unused; re-add if needed.

  const saveProgress = useCallback(async () => {
    if (!candidateEmail || !quizStarted || submitted) {
      return;
    }

    try {
      await assessmentProgressService.saveProgress({
        candidate_email: candidateEmail,
        candidate_name: candidateName || undefined,
        session_id: sessionId || undefined,
        question_set_id: mcqQuestions.question_set_id || undefined,
        assessment_title: locationState?.assessment?.title || mcqQuestions.skill || undefined,
        skill: mcqQuestions.skill || undefined,
        level: mcqQuestions.level || undefined,
        current_question_index: current,
        answers: answers.reduce((acc, ans) => {
          acc[ans.question_id] = ans.selected_answer;
          return acc;
        }, {} as Record<string, any>),
        question_status: questionStatus,
        expired_questions: Array.from(expiredQuestions),
        remaining_time_seconds: quizTimer,
        initial_duration_seconds: initialQuizDurationRef.current,
        total_questions: mcqQuestions.total_questions,
        is_completed: false,
      });
    } catch (error) {
      // Silent fail - don't disrupt quiz flow
    }
  }, [candidateEmail, candidateName, quizStarted, submitted, sessionId, mcqQuestions, locationState, current, answers, questionStatus, expiredQuestions, quizTimer]);

  const submitQuizAnswers = useCallback(async (
    answersToSubmit: {
      question_id: number;
      selected_answer: string;
    }[]
  ) => {
    try {
      setIsSubmitting(true);

      let score = 0;
      let submitSuccess = false;
      let submitErrorMessage: string | null = null;

      try {
        // Build full MCQ payload including NOT_ANSWERED sentinel for unanswered questions
        const allQuestionIds = mcqQuestions.questions.map((q: any) => (q.question_id ?? q.id));

        const providedMap = new Map<number, string>();
        answersToSubmit.forEach((a) => {
          if (a.question_id > 0) providedMap.set(a.question_id, a.selected_answer);
        });

        const payloadAnswers = allQuestionIds.map((qid: number) => {
          const existing = providedMap.get(qid);
          if (existing === undefined || (typeof existing === 'string' && existing.trim() === '')) {
            return { question_id: qid, selected_answer: NOT_ANSWERED };
          }
          return { question_id: qid, selected_answer: existing };
        });

        const res = await quizService.submitQuiz(
          sessionId,
          payloadAnswers,
          sessionStartedAnonymous
        );

        submitSuccess = true;
        score = res.score_percentage ?? 0;
        const correctCount = res.correct_answers ?? Math.round((score / 100) * payloadAnswers.length);
        
        const mcqCount = mcqQuestions.questions.filter(q => q.question_type === 'mcq').length;
        const mcqCorrectCount = correctCount; // Use the value from API or calculation        localStorage.setItem("latestScore", score.toString());
        localStorage.setItem(
          "quizResult",
          JSON.stringify({
            score,
            totalQuestions: mcqCount,
            correctAnswers: mcqCorrectCount,
            percentage: score,
            completedAt: new Date().toISOString(),
          })
        );
      } catch (apiError: any) {
        // swallow error but keep flow — submission may still proceed to screening handling
        console.warn("Submit API failed:", apiError);
        submitSuccess = false;
        submitErrorMessage = apiError?.response?.data?.error || apiError?.message || "Submission failed";
      }

      // Calculate MCQ-only statistics (exclude screening questions with negative IDs)
      const mcqCount = mcqQuestions.questions.filter(q => q.question_type === 'mcq').length;
      const mcqCorrectCount = Math.round((score / 100) * mcqCount);

      if (submitSuccess) {
        setQuizResult({
          score,
          totalQuestions: mcqCount,
          correctAnswers: mcqCorrectCount,
          percentage: score,
          status: "Submitted",
        });
      } else {
        setQuizResult({
          score,
          totalQuestions: mcqCount,
          correctAnswers: mcqCorrectCount,
          percentage: score,
          status: "SubmissionFailed",
        });
        setShowToast(true);
        setToastMessage(`Submission failed: ${submitErrorMessage}`);
      }

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

      // Mark progress as complete
      if (candidateEmail) {
        try {
          await assessmentProgressService.markComplete(candidateEmail);
        } catch (err) {
          // Silent fail
        }
      }

    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, sessionStartedAnonymous, screeningQuestions, locationState, candidateEmail]);

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

    // If current question requires a non-empty answer, prevent advancing when empty
    const proposedAnswer = currentQuestion.question_type === "mcq" ? selectedOption : textAnswer;
    if ((currentQuestion.question_type === "coding" || currentQuestion.question_type === "architecture") && (!proposedAnswer || proposedAnswer.trim() === "")) {
      setQuestionStatus(prev => ({ ...prev, [current]: 'not-answered' }));
      setShowToast(true);
      setToastMessage("This question is required. Please provide an answer before continuing.");
      return;
    }

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

    // If the question type requires non-nullable answers (coding/architecture), prevent advancing with empty answer
    if ((currentQuestion.question_type === "coding" || currentQuestion.question_type === "architecture") && (!answer || answer.trim() === "")) {
      setQuestionStatus(prev => ({ ...prev, [current]: 'not-answered' }));
      setShowToast(true);
      setToastMessage("This question is required. Please provide an answer before continuing.");
      return;
    }

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

  // Don't auto-start quiz - wait for pre-assessment screen
  useEffect(() => {
    if (!quizStarted && mcqQuestions.questions.length > 0 && !loading && !error && !showPreAssessment) {
      getQuizSessionId();
    }
  }, [mcqQuestions.questions.length, quizStarted, loading, error, showPreAssessment]);

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

        // Show auto-submit warning at 60 seconds
        if (newVal === 60 && !showAutoSubmitWarning) {
          setShowAutoSubmitWarning(true);
        }

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

            // Auto-save NOT_ANSWERED for the expired question if no answer exists
            const questions = mcqQuestionsRef.current.questions;
            const currentQuestion = questions[currentIdx];
            const currentQid = (currentQuestion as any).question_id ?? (currentQuestion as any).id;
            setAnswers(prev => {
              const exists = prev.some(a => a.question_id === currentQid);
              if (exists) return prev;
              return [
                ...prev,
                { question_id: currentQid, selected_answer: NOT_ANSWERED }
              ];
            });
            setQuestionStatus(prev => ({ ...prev, [currentIdx]: 'not-answered' }));

            const nextIdx = currentIdx + 1;

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
                // Reset coding language to default when changing questions
                setCodingLanguage(nextQuestion.meta?.language ?? "javascript");
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

  // Auto-save progress every 10 seconds and when answers change
  useEffect(() => {
    if (!quizStarted || submitted) return;

    const interval = setInterval(() => {
      saveProgress();
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [quizStarted, submitted, saveProgress]);

  // Save progress when answers change
  useEffect(() => {
    if (quizStarted && !submitted && answers.length > 0) {
      saveProgress();
    }
  }, [answers, quizStarted, submitted, saveProgress]);

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

  // Keyboard shortcuts for MCQ options (A, B, C, D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts if not typing in textarea or input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      const key = e.key.toUpperCase();
      const isMcq = question?.question_type === "mcq" || Array.isArray(question?.options);
      
      if (isMcq && question?.options) {
        const mcqOptions = Array.isArray(question.options)
          ? question.options
          : Object.entries(question.options).map(([option_id, text]) => ({
              option_id,
              text: String(text),
            }));

        // Map A-D to option indices
        const optionIndex = key.charCodeAt(0) - 65; // 'A' = 0, 'B' = 1, etc.
        
        if (optionIndex >= 0 && optionIndex < mcqOptions.length && optionIndex < 4) {
          e.preventDefault();
          setSelected(mcqOptions[optionIndex].option_id);
        }
      }

      // Ctrl+S to save (prevent browser save dialog)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveAndNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [question, saveAndNext]);

  /* ================================================================
     ✅ EARLY RETURNS AFTER ALL HOOKS
     ================================================================ */

  // Show pre-assessment screen before starting quiz
  if (showPreAssessment && !loading && !error && mcqQuestions.questions.length > 0) {
    const questionTypes = {
      mcq: mcqQuestions.questions.filter(q => q.question_type === 'mcq').length,
      coding: mcqQuestions.questions.filter(q => q.question_type === 'coding').length,
      architecture: mcqQuestions.questions.filter(q => q.question_type === 'architecture').length,
      screening: screeningQuestions.length + (additionalScreeningQuestion ? 1 : 0),
    };

    const totalQuestions = mcqQuestions.questions.length + screeningQuestions.length + (additionalScreeningQuestion ? 1 : 0);

    console.log('Pre-assessment data:', {
      mcqQuestionsCount: mcqQuestions.questions.length,
      screeningQuestionsCount: screeningQuestions.length,
      hasAdditionalScreening: !!additionalScreeningQuestion,
      totalQuestions,
      questionTypes,
      assessmentData,
    });

    const handleStartAssessment = () => {
      setShowPreAssessment(false);
      getQuizSessionId();
    };

    const handleSystemCheck = async () => {
      // Simple system check
      return {
        browser: true, // Modern browser assumed
        internet: navigator.onLine,
      };
    };

    return (
      <PreAssessmentScreen
        assessmentTitle={assessmentData?.title || `Assessment for ${assessmentData?.job_title || 'Staff Engineer'}`}
        duration={assessmentData?.duration_minutes || 30}
        totalQuestions={totalQuestions}
        questionTypes={questionTypes}
        candidateName={assessmentData?.candidate_info?.name || candidateName || undefined}
        candidateRole={assessmentData?.candidate_info?.current_role || assessmentData?.job_title}
        onStart={handleStartAssessment}
        onSystemCheck={handleSystemCheck}
      />
    );
  }

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><LinearProgress /></Box>;
  
  // Post-Submit Results Screen
  if (submitted && quizResult) {
    // Calculate MCQ-only statistics
    const mcqOnlyQuestions = mcqQuestions.questions.filter(q => q.question_type === 'mcq');
    const otherQuestions = mcqQuestions.questions.filter(q => q.question_type !== 'mcq');
    const hasMCQs = mcqOnlyQuestions.length > 0;
    const hasOtherTypes = otherQuestions.length > 0;
    
    // For MCQs, use the actual score; for display purposes
    const mcqPercentage = hasMCQs ? quizResult.percentage : 0;
    const passPercentage = 70;
    const mcqPassed = mcqPercentage >= passPercentage;

    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4
      }}>
        <Box sx={{ 
          maxWidth: '900px',
          width: '100%',
          background: 'white',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          animation: 'scaleIn 0.5s ease'
        }}>
          {/* Header */}
          <Box sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '48px 40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              fontSize: '72px',
              marginBottom: '16px',
              animation: 'scaleIn 0.8s ease'
            }}>
              ✅
            </Box>
            <Typography sx={{ 
              fontSize: '32px',
              fontWeight: 800,
              color: 'white',
              marginBottom: '8px',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Assessment Submitted Successfully!
            </Typography>
            <Typography sx={{ 
              fontSize: '18px',
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 500
            }}>
              Thank you for completing the assessment
            </Typography>
          </Box>

          {/* Content */}
          <Box sx={{ padding: '40px' }}>
            {/* MCQ Results Section */}
            {hasMCQs && (
              <>
                <Box sx={{ 
                  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '24px',
                  border: '2px solid #93c5fd'
                }}>
                  <Typography sx={{ 
                    fontSize: '20px', 
                    fontWeight: 700, 
                    color: '#1e40af', 
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    📝 Your MCQ Score (Auto-Evaluated)
                  </Typography>

                  {/* MCQ Score Display */}
                  <Box sx={{ 
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '24px'
                  }}>
                    <Box sx={{
                      width: '160px',
                      height: '160px',
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `6px solid ${mcqPassed ? '#10b981' : '#3b82f6'}`,
                    }}>
                      <Typography sx={{ 
                        fontSize: '42px',
                        fontWeight: 800,
                        color: mcqPassed ? '#10b981' : '#3b82f6',
                        lineHeight: 1
                      }}>
                        {mcqPercentage}%
                      </Typography>
                      <Typography sx={{ 
                        fontSize: '13px',
                        color: '#64748b',
                        fontWeight: 600,
                        marginTop: '6px'
                      }}>
                        {mcqPassed ? 'Passed ✓' : 'Completed'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* MCQ Stats */}
                  <Box sx={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 2,
                    marginBottom: '16px'
                  }}>
                    <Box sx={{ 
                      padding: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                        Total MCQs
                      </Typography>
                      <Typography sx={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6' }}>
                        {mcqOnlyQuestions.length}
                      </Typography>
                    </Box>

                    <Box sx={{ 
                      padding: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                        Correct
                      </Typography>
                      <Typography sx={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>
                        {quizResult.correctAnswers}
                      </Typography>
                    </Box>

                    <Box sx={{ 
                      padding: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                        Incorrect
                      </Typography>
                      <Typography sx={{ fontSize: '28px', fontWeight: 800, color: '#ef4444' }}>
                        {mcqOnlyQuestions.length - quizResult.correctAnswers}
                      </Typography>
                    </Box>
                  </Box>

                  {/* MCQ Performance Bar */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Typography sx={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                        MCQ Performance
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: '#1e293b', fontWeight: 700 }}>
                        {mcqPercentage}% (Pass: {passPercentage}%)
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={mcqPercentage} 
                      sx={{ 
                        height: 10, 
                        borderRadius: 5,
                        backgroundColor: '#e0e7ff',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 5,
                          background: mcqPassed
                            ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
                        }
                      }} 
                    />
                  </Box>
                </Box>
              </>
            )}

            {/* Other Question Types Under Review */}
            {hasOtherTypes && (
              <Box sx={{ 
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
                border: '2px solid #fcd34d'
              }}>
                <Typography sx={{ 
                  fontSize: '20px', 
                  fontWeight: 700, 
                  color: '#92400e', 
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  ⏳ Pending Human Review
                </Typography>
                
                <Typography sx={{ fontSize: '15px', color: '#78350f', marginBottom: '16px', lineHeight: 1.6 }}>
                  The following question types require manual evaluation by our expert team:
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {otherQuestions.filter(q => q.question_type === 'coding').length > 0 && (
                    <Box sx={{ 
                      padding: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ fontSize: '32px' }}>💻</Box>
                        <Box>
                          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                            Coding Questions
                          </Typography>
                          <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
                            Code quality, logic, and implementation
                          </Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ 
                        fontSize: '18px', 
                        fontWeight: 700, 
                        color: '#10b981',
                        background: '#d1fae5',
                        padding: '6px 16px',
                        borderRadius: '8px'
                      }}>
                        {otherQuestions.filter(q => q.question_type === 'coding').length}
                      </Typography>
                    </Box>
                  )}

                  {otherQuestions.filter(q => q.question_type === 'architecture').length > 0 && (
                    <Box sx={{ 
                      padding: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ fontSize: '32px' }}>🏗️</Box>
                        <Box>
                          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                            Architecture Questions
                          </Typography>
                          <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
                            System design and scalability
                          </Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ 
                        fontSize: '18px', 
                        fontWeight: 700, 
                        color: '#f59e0b',
                        background: '#fef3c7',
                        padding: '6px 16px',
                        borderRadius: '8px'
                      }}>
                        {otherQuestions.filter(q => q.question_type === 'architecture').length}
                      </Typography>
                    </Box>
                  )}

                  {otherQuestions.filter(q => q.question_type === 'screening').length > 0 && (
                    <Box sx={{ 
                      padding: '16px',
                      background: 'white',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ fontSize: '32px' }}>📋</Box>
                        <Box>
                          <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                            Screening Questions
                          </Typography>
                          <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
                            Text responses and explanations
                          </Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ 
                        fontSize: '18px', 
                        fontWeight: 700, 
                        color: '#8b5cf6',
                        background: '#ede9fe',
                        padding: '6px 16px',
                        borderRadius: '8px'
                      }}>
                        {otherQuestions.filter(q => q.question_type === 'screening').length}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* Next Steps */}
            <Box sx={{ 
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid #bae6fd',
              marginBottom: '24px'
            }}>
              <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#0369a1', marginBottom: '12px' }}>
                📧 What Happens Next?
              </Typography>
              <Box component="ul" sx={{ margin: 0, paddingLeft: '20px' }}>
                <Typography component="li" sx={{ fontSize: '14px', color: '#0c4a6e', marginBottom: '10px', lineHeight: 1.6 }}>
                  {hasOtherTypes ? (
                    <>Our expert team will carefully review your coding, architecture, and screening responses</>
                  ) : (
                    <>Our team will review your complete assessment</>
                  )}
                </Typography>
                <Typography component="li" sx={{ fontSize: '14px', color: '#0c4a6e', marginBottom: '10px', lineHeight: 1.6 }}>
                  You'll receive your <strong>complete results and detailed feedback via email</strong> within 2-3 business days
                </Typography>
                <Typography component="li" sx={{ fontSize: '14px', color: '#0c4a6e', marginBottom: '10px', lineHeight: 1.6 }}>
                  {mcqPassed && hasMCQs ? (
                    <>Congratulations on your MCQ performance! Qualified candidates will be contacted for next steps</>
                  ) : (
                    <>All candidates will be notified of their final results and next steps</>
                  )}
                </Typography>
                <Typography component="li" sx={{ fontSize: '14px', color: '#0c4a6e', lineHeight: 1.6 }}>
                  Keep an eye on your inbox (and spam folder) for updates
                </Typography>
              </Box>
            </Box>

            {/* Completion Info */}
            <Box sx={{ 
              textAlign: 'center',
              padding: '20px',
              background: '#f8fafc',
              borderRadius: '12px',
              marginBottom: '24px',
              border: '1px solid #e2e8f0'
            }}>
              <Typography sx={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                Assessment Submitted On
              </Typography>
              <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                {new Date().toLocaleString('en-US', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </Typography>
              {candidateName && (
                <Typography sx={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
                  Candidate: <strong>{candidateName}</strong>
                </Typography>
              )}
              {candidateEmail && (
                <Typography sx={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Email: {candidateEmail}
                </Typography>
              )}
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                href="/"
                sx={{
                  padding: '14px 36px',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                🏠 Return Home
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.print()}
                sx={{
                  padding: '14px 36px',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '16px',
                  borderWidth: '2px',
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderWidth: '2px',
                    borderColor: '#764ba2',
                    background: 'rgba(102, 126, 234, 0.05)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                🖨️ Print Confirmation
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }
  
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
            <Box 
              className={`timer-display ${quizTimer <= 60 ? 'critical' : quizTimer <= 300 ? 'warning' : ''}`}
              style={{ 
                background: quizTimer <= 300 
                  ? `linear-gradient(135deg, ${quizTimer <= 60 ? '#dc2626' : '#f97316'} 0%, ${quizTimer <= 60 ? '#991b1b' : '#ea580c'} 100%)` 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            >
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
            <Box sx={{ position: 'relative' }}>
              <textarea
                className="architecture-textarea"
                placeholder="Write your screening answer here... (or click the microphone to speak your answer)"
                value={additionalScreeningAnswer}
                onChange={(e) => setAdditionalScreeningAnswer(e.target.value)}
                style={{ minHeight: '300px', width: '100%', padding: '16px', fontSize: '14px', fontFamily: 'inherit', border: '1px solid #e0e4e8', borderRadius: '8px' }}
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
    if (quizResult.status === "SubmissionFailed") {
      return (
        <Box className="submission-screen">
          <Typography className="submitted-title" color="error">
            Submission Failed
          </Typography>

          <Typography className="submitted-text">
            There was an error submitting your answers. Please review the highlighted questions or retry submission.
          </Typography>

          <Typography sx={{ mt: 2, color: 'rgba(0,0,0,0.7)' }}>
            Status: {quizResult.status}
          </Typography>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={() => {
              setSubmitted(false);
              setQuizResult(null);
              setShowToast(false);
            }}>
              Return to Quiz
            </Button>
            <Button variant="outlined" onClick={() => {
              submitQuizAnswers(answers);
            }}>
              Retry Submission
            </Button>
          </Box>
        </Box>
      );
    }

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
  // Fix: Only count screeningQuestions.length (additionalScreeningQuestion is set from screeningQuestions[0])
  const totalScreeningQuestions = screeningQuestions.length > 0 ? screeningQuestions.length : (additionalScreeningQuestion ? 1 : 0);
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {/* Overall Timer */}
              <Box 
                className={`timer-display ${quizTimer <= 60 ? 'critical' : quizTimer <= 300 ? 'warning' : ''}`}
                style={{ 
                  background: quizTimer <= 300 
                    ? `linear-gradient(135deg, ${quizTimer <= 60 ? '#dc2626' : '#f97316'} 0%, ${quizTimer <= 60 ? '#991b1b' : '#ea580c'} 100%)` 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                <Typography className="timer-text">
                  ⏰ {formatTime(quizTimer)}
                </Typography>
                {quizTimer <= 300 && (
                  <Typography sx={{ fontSize: '11px', color: '#ffffff', fontWeight: 600, mt: 0.5 }}>
                    {quizTimer <= 60 ? '⚠️ FINAL MINUTE!' : 'Hurry up!'}
                  </Typography>
                )}
              </Box>
              
              {/* Question Timer */}
              <Box 
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  padding: '8px 16px',
                  backgroundColor: questionTimer <= 10 ? '#fee2e2' : '#f8fafc',
                  borderRadius: '12px',
                  border: questionTimer <= 10 ? '2px solid #ef4444' : '2px solid #e2e8f0',
                }}
              >
                <Typography sx={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  This Question
                </Typography>
                <Typography sx={{ 
                  fontSize: '16px', 
                  fontWeight: 700, 
                  color: questionTimer <= 10 ? '#dc2626' : '#667eea',
                  fontFamily: 'monospace',
                }}>
                  {Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Time Warning Banner */}
          {quizTimer <= 300 && quizTimer > 0 && (
            <Box 
              sx={{
                mb: 2,
                p: 2,
                backgroundColor: quizTimer <= 60 ? '#fee2e2' : '#fef3c7',
                borderRadius: '12px',
                border: quizTimer <= 60 ? '2px solid #dc2626' : '2px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                animation: quizTimer <= 60 ? 'pulse 2s infinite' : 'none',
              }}
            >
              <Typography sx={{ fontSize: '24px' }}>
                {quizTimer <= 60 ? '🚨' : '⚠️'}
              </Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 600, color: quizTimer <= 60 ? '#991b1b' : '#92400e', flex: 1 }}>
                {quizTimer <= 60 
                  ? 'Less than 1 minute remaining! Your assessment will auto-submit soon.'
                  : `Only ${Math.floor(quizTimer / 60)} minutes remaining. Please complete your answers.`
                }
              </Typography>
            </Box>
          )}

          {/* Question Content */}
          <Box className="question-section">
            {/* Mini Progress Dots */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 0.5, 
              marginBottom: '20px',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '12px'
            }}>
              {mcqQuestions.questions.map((_, idx) => (
                <Box
                  key={idx}
                  sx={{
                    width: idx === current ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    background: idx === current 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : questionStatus[idx] === 'answered'
                      ? '#10b981'
                      : '#cbd5e1',
                    transition: 'all 0.3s ease',
                    opacity: idx === current ? 1 : 0.6,
                  }}
                />
              ))}
            </Box>

            {/* Question Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography className="question-number">
                  Question {current + 1} of {mcqQuestions.questions.length}
                </Typography>
                <Box 
                  className="question-type-badge"
                  sx={{
                    background: question.question_type === 'mcq' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' :
                               question.question_type === 'coding' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                               question.question_type === 'architecture' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                               'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}
                >
                  {question.question_type === 'mcq' ? '📝 MCQ' :
                   question.question_type === 'coding' ? '💻 Coding' :
                   question.question_type === 'architecture' ? '🏗️ Architecture' : '📋 Screening'}
                </Box>
                {(question as any).difficulty && (
                  <Box 
                    sx={{
                      background: (question as any).difficulty === 'easy' ? '#dcfce7' :
                                 (question as any).difficulty === 'medium' ? '#fef3c7' : '#fee2e2',
                      color: (question as any).difficulty === 'easy' ? '#166534' :
                             (question as any).difficulty === 'medium' ? '#92400e' : '#991b1b',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      border: `1.5px solid ${(question as any).difficulty === 'easy' ? '#86efac' :
                                             (question as any).difficulty === 'medium' ? '#fcd34d' : '#fca5a5'}`
                    }}
                  >
                    {(question as any).difficulty}
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#f1f5f9', padding: '8px 14px', borderRadius: '10px' }}>
                <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  ⏱️ Time spent:
                </Typography>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  {Math.floor((getQuestionDuration(question.question_type) - questionTimer) / 60)}:{((getQuestionDuration(question.question_type) - questionTimer) % 60).toString().padStart(2, '0')}
                </Typography>
              </Box>
            </Box>
            
            {/* Question Text */}
            <Box className="question-text-container">
              <Typography className="question-text">
                {question.question_text}
              </Typography>
            </Box>
            
            {/* Question Metadata */}
            {((question.meta as any)?.skill || (question.meta as any)?.topic) && (
              <Box sx={{ display: 'flex', gap: 1, marginTop: '16px', flexWrap: 'wrap' }}>
                {(question.meta as any)?.skill && (
                  <Box sx={{ 
                    background: '#ede9fe', 
                    color: '#6b21a8', 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    border: '1px solid #c4b5fd'
                  }}>
                    🎯 {(question.meta as any).skill}
                  </Box>
                )}
                {(question.meta as any)?.topic && (
                  <Box sx={{ 
                    background: '#dbeafe', 
                    color: '#1e40af', 
                    padding: '4px 10px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    border: '1px solid #93c5fd'
                  }}>
                    📚 {(question.meta as any).topic}
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Answer Options */}
          <Box className="answer-section">
            {/* Section Header */}
            <Box sx={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #f1f5f9' }}>
              <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                 Your Response
              </Typography>
              <Typography sx={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {question.question_type === 'mcq' ? 'Select the most appropriate answer' :
                 question.question_type === 'coding' ? 'Write clean, efficient code with proper comments' :
                 question.question_type === 'architecture' ? 'Describe your design approach and considerations' :
                 'Provide a detailed text response'}
              </Typography>
            </Box>

            {question.question_type === "screening" && (
              <Box className="text-answer-container">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                  Your Answer

                  </Typography>
                  <Typography sx={{ 
                    fontSize: '13px', 
                    color: textAnswer.length > 500 ? '#ef4444' : '#94a3b8',
                    fontWeight: textAnswer.length > 500 ? 600 : 400
                  }}>
                    {textAnswer.length} / 1000 characters
                  </Typography>
                </Box>
                <textarea
                  className="text-answer-field"
                  placeholder="Write your answer here... Be clear and concise."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  maxLength={1000}
                />
                {textAnswer.length === 0 && (
                  <Typography sx={{ fontSize: '12px', color: '#94a3b8', mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    💡 Tip: Provide specific examples and details to support your answer
                  </Typography>
                )}
              </Box>
            )}

            {isMcq && (
              <Box>
                <RadioGroup
                  value={selectedOption}
                  onChange={(e) => setSelected(e.target.value)}
                  className="options-group"
                >
                  {mcqOptions.map((opt, idx) => (
                    <Box 
                      key={opt.option_id} 
                      className={`option-item ${selectedOption === opt.option_id ? 'selected' : ''}`}
                    >
                      <FormControlLabel
                        value={opt.option_id}
                        control={<Radio />}
                        label={
                          <Box className="option-label">
                            <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                            <span className="option-text">{opt.text}</span>
                          </Box>
                        }
                      />
                    </Box>
                  ))}
                </RadioGroup>
                <Box sx={{ 
                  marginTop: '16px', 
                  padding: '12px 16px', 
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #ede9fe 100%)', 
                  borderRadius: '10px',
                  border: '1px solid #e0e7ff'
                }}>
                  <Typography sx={{ fontSize: '12px', color: '#4338ca', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    ⌨️ Keyboard shortcut: Press {mcqOptions.map((_, idx) => String.fromCharCode(65 + idx)).slice(0, 4).join(', ')} keys to select options quickly
                  </Typography>
                </Box>
              </Box>
            )}

            {question.question_type === "coding" && (() => {
              const constraints = question.meta?.constraints ?? [];
              const supportedLanguages = ['javascript', 'python', 'typescript', 'java', 'cpp', 'go'];

              return (
                <Box className="coding-section">
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                      Code Editor
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '13px', color: '#94a3b8' }}>Language:</Typography>
                      <select
                        value={codingLanguage}
                        onChange={(e) => setCodingLanguage(e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '13px',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        {supportedLanguages.map(lang => (
                          <option key={lang} value={lang}>
                            {lang.charAt(0).toUpperCase() + lang.slice(1)}
                          </option>
                        ))}
                      </select>
                    </Box>
                  </Box>

                  {constraints.length > 0 && (
                    <Box className="constraints">
                      <Typography className="constraints-title">📋 Constraints:</Typography>
                      <ul>
                        {constraints.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </Box>
                  )}

                  <Box sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <Editor
                      height="400px"
                      language={codingLanguage}
                      value={textAnswer}
                      onChange={(v) => setTextAnswer(v || "")}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: "on",
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        renderLineHighlight: 'all',
                        tabSize: 2,
                      }}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Box sx={{ 
                      padding: '8px 12px', 
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
                      borderRadius: '8px',
                      border: '1px solid #bae6fd',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5
                    }}>
                      <Typography sx={{ fontSize: '12px', color: '#0369a1', fontWeight: 500 }}>
                        ⌨️ Shortcuts: Ctrl+S to save • Ctrl+/ to comment
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>
                      {textAnswer.split('\n').length} lines
                    </Typography>
                  </Box>
                </Box>
              );
            })()}

            {question.question_type === "architecture" && (() => {
              const focusAreas = question.meta?.focus_areas ?? [];

              return (
                <Box className="architecture-section">
                  {focusAreas.length > 0 && (
                    <Box className="focus-areas">
                      <Typography className="focus-title">🎯 Focus Areas:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {focusAreas.map((f, i) => (
                          <Box 
                            key={i}
                            sx={{
                              padding: '6px 12px',
                              backgroundColor: '#f1f5f9',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {f}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  <Box sx={{ position: 'relative', mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                        System Design Answer
                      </Typography>
                      <Typography sx={{ fontSize: '13px', color: textAnswer.length > 1500 ? '#ef4444' : '#94a3b8' }}>
                        {textAnswer.length} / 2000 characters
                      </Typography>
                    </Box>
                    <textarea
                      className="architecture-textarea"
                      placeholder="Describe your system design approach here...
                      
✓ Components & Architecture
✓ Data Flow & Storage
✓ Scalability Strategy
✓ Reliability & Fault Tolerance
✓ Trade-offs & Alternatives

You can also use voice input by clicking the microphone button."
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      maxLength={2000}
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
                  {!speechSupported && (
                    <Typography sx={{ fontSize: '12px', color: '#94a3b8', mt: 1 }}>
                      💡 Voice input not available in this browser
                    </Typography>
                  )}
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
              startIcon={<span>←</span>}
            >
              Previous
            </Button>
            
            <Button
              variant="outlined"
              className="nav-btn mark-btn"
              onClick={toggleMarkForReview}
              startIcon={<span>{markedForReview.has(current) ? '🚩' : '⚐'}</span>}
              sx={{
                borderColor: markedForReview.has(current) ? '#f59e0b' : '#cbd5e1',
                color: markedForReview.has(current) ? '#f59e0b' : '#64748b',
                fontWeight: 600,
                '&:hover': {
                  borderColor: '#f59e0b',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                },
              }}
              title="Mark for Review (Press M)"
            >
              {markedForReview.has(current) ? 'Marked' : 'Mark'}
            </Button>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                {current + 1} / {mcqQuestions.questions.length}
              </Typography>
            </Box>

            <Button
              variant="contained"
              className="nav-btn save-next-btn"
              onClick={saveAndNext}
              endIcon={<span>→</span>}
            >
              {current === mcqQuestions.questions.length - 1 ? 'Save' : 'Save & Next'}
            </Button>
            
            {current === mcqQuestions.questions.length - 1 && !additionalScreeningQuestion && screeningQuestions.length === 0 && (
              <Button
                variant="contained"
                className="nav-btn submit-btn"
                onClick={() => setSubmitted(true)}
                sx={{
                  bgcolor: '#10b981 !important',
                  '&:hover': { bgcolor: '#059669 !important' },
                }}
              >
                Submit Test
              </Button>
            )}
          </Box>

          {/* Progress Bar */}
          <Box sx={{ mt: 2, px: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                Overall Progress
              </Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#667eea' }}>
                {Math.round((attemptedCount / mcqQuestions.questions.length) * 100)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={(attemptedCount / mcqQuestions.questions.length) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#e2e8f0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                },
              }}
            />
          </Box>

          {/* Quick Actions */}
          {notAttemptedCount > 0 && (
            <Box sx={{ mt: 2, px: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => {
                  const firstUnanswered = mcqQuestions.questions.findIndex((_q, idx) => 
                    questionStatus[idx] !== 'answered' && !expiredQuestions.has(idx)
                  );
                  if (firstUnanswered !== -1) {
                    navigateToQuestion(firstUnanswered);
                  }
                }}
                sx={{
                  textTransform: 'none',
                  borderColor: '#667eea',
                  color: '#667eea',
                  fontWeight: 600,
                  fontSize: '12px',
                  py: 1,
                  '&:hover': {
                    borderColor: '#5568d3',
                    backgroundColor: 'rgba(102, 126, 234, 0.05)',
                  },
                }}
                startIcon={<span>🎯</span>}
              >
                Jump to First Unanswered
              </Button>
            </Box>
          )}
        </Box>

        {/* Right Sidebar - Question Grid */}
        <Box className="quiz-sidebar">
          <Box className="candidate-info">
            <Box className="avatar-circle">
              <Typography className="avatar-text"></Typography>
            </Box>
          </Box>

          {/* Time Summary */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', mb: 2 }}>
              ⏱️ Time Summary
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                  Total Time
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#667eea', fontFamily: 'monospace' }}>
                  {assessmentData?.duration_minutes || 30} min
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                  Time Remaining
                </Typography>
                <Typography sx={{ 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  color: quizTimer <= 300 ? '#dc2626' : quizTimer <= 600 ? '#f59e0b' : '#10b981',
                  fontFamily: 'monospace',
                }}>
                  {formatTime(quizTimer)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                  Avg per Question
                </Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#64748b', fontFamily: 'monospace' }}>
                  {Math.floor(quizTimer / (mcqQuestions.questions.length - current))}s
                </Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={((((assessmentData?.duration_minutes || 30) * 60) - quizTimer) / ((assessmentData?.duration_minutes || 30) * 60)) * 100}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: '#e2e8f0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: quizTimer <= 300 ? '#dc2626' : quizTimer <= 600 ? '#f59e0b' : '#667eea',
                },
              }}
            />
            <Typography sx={{ fontSize: '11px', color: '#94a3b8', mt: 1, textAlign: 'center' }}>
              {Math.round(((((assessmentData?.duration_minutes || 30) * 60) - quizTimer) / ((assessmentData?.duration_minutes || 30) * 60)) * 100)}% time elapsed
            </Typography>
          </Box>

          {/* Section-wise Progress */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', mb: 2 }}>
              Section Progress
            </Typography>
            {['mcq', 'coding', 'architecture', 'screening'].map(type => {
              const sectionQuestions = mcqQuestions.questions.filter(q => q.question_type === type);
              if (sectionQuestions.length === 0) return null;
              
              const sectionAnswered = sectionQuestions.filter((q) => {
                const globalIdx = mcqQuestions.questions.indexOf(q);
                return questionStatus[globalIdx] === 'answered';
              }).length;
              
              const sectionLabel = type === 'mcq' ? 'MCQ' : 
                                 type === 'coding' ? 'Coding' :
                                 type === 'architecture' ? 'Architecture' : 'Screening';
              
              const sectionColor = type === 'mcq' ? '#3b82f6' :
                                  type === 'coding' ? '#8b5cf6' :
                                  type === 'architecture' ? '#ec4899' : '#f59e0b';
              
              return (
                <Box key={type} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {sectionLabel}
                    </Typography>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: sectionColor }}>
                      {sectionAnswered}/{sectionQuestions.length}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(sectionAnswered / sectionQuestions.length) * 100}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 2,
                        backgroundColor: sectionColor,
                      },
                    }}
                  />
                </Box>
              );
            })}
          </Box>

          {/* Question Palette */}
          <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', mb: 2, px: 2 }}>
            Question Palette
          </Typography>

          {/* Filter Chips */}
          <Box sx={{ px: 2, mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {[
              { value: 'all', label: 'All', count: mcqQuestions.questions.length },
              { value: 'answered', label: 'Answered', count: attemptedCount },
              { value: 'unanswered', label: 'Unanswered', count: notAttemptedCount },
              { value: 'marked', label: 'Marked', count: markedForReview.size },
            ].map(filter => (
              <Button
                key={filter.value}
                size="small"
                onClick={() => setQuestionFilter(filter.value as any)}
                sx={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 600,
                  backgroundColor: questionFilter === filter.value ? '#667eea' : '#f1f5f9',
                  color: questionFilter === filter.value ? 'white' : '#64748b',
                  border: 'none',
                  '&:hover': {
                    backgroundColor: questionFilter === filter.value ? '#5568d3' : '#e2e8f0',
                  },
                }}
              >
                {filter.label} ({filter.count})
              </Button>
            ))}
          </Box>

          {/* Question Grid */}
          <Box className="question-grid">
            {mcqQuestions.questions.map((q, idx) => {
              const status = questionStatus[idx] || 'not-visited';
              const isCurrentQuestion = idx === current;
              const isExpired = expiredQuestions.has(idx);
              const isMarked = markedForReview.has(idx);
              
              // Apply filter
              if (questionFilter === 'answered' && status !== 'answered') return null;
              if (questionFilter === 'unanswered' && status === 'answered') return null;
              if (questionFilter === 'marked' && !isMarked) return null;
              
              // Get question type icon
              const typeIcon = q.question_type === 'mcq' ? '📝' :
                             q.question_type === 'coding' ? '💻' :
                             q.question_type === 'architecture' ? '🏗️' : '📋';
              
              return (
                <Button
                  key={idx}
                  className={`grid-question-btn ${
                    isCurrentQuestion ? 'current' : ''
                  } ${status} ${isExpired ? 'expired' : ''} ${isMarked ? 'marked' : ''}`}
                  onClick={() => navigateToQuestion(idx)}
                  disabled={isExpired}
                  title={`${typeIcon} Question ${idx + 1} - ${q.question_type.toUpperCase()}${isMarked ? ' (Marked for Review)' : ''}${isExpired ? ' (Time Expired)' : ''}`}
                  sx={{
                    position: 'relative',
                    '&.marked::after': {
                      content: '"🚩"',
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      fontSize: '12px',
                    }
                  }}
                >
                  {isExpired ? '🔒' : idx + 1}
                </Button>
              );
            })}
          </Box>

          {/* Summary */}
          <Box className="summary-section">
            <Typography className="summary-title">Legend</Typography>
            <Box className="summary-item">
              <Box className="summary-indicator current" sx={{ border: '2px solid #667eea' }}></Box>
              <Typography className="summary-text">Current</Typography>
            </Box>
            <Box className="summary-item">
              <Box className="summary-indicator answered"></Box>
              <Typography className="summary-text">Answered ({attemptedCount})</Typography>
            </Box>
            <Box className="summary-item">
              <Box className="summary-indicator not-answered"></Box>
              <Typography className="summary-text">Not Answered ({notAttemptedCount})</Typography>
            </Box>
            {markedForReview.size > 0 && (
              <Box className="summary-item">
                <Box className="summary-indicator" sx={{ backgroundColor: '#f59e0b', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-6px', right: '-6px', fontSize: '10px' }}>🚩</span>
                </Box>
                <Typography className="summary-text">Marked ({markedForReview.size})</Typography>
              </Box>
            )}
            {expiredQuestions.size > 0 && (
              <Box className="summary-item">
                <Box className="summary-indicator expired" sx={{ backgroundColor: '#94a3b8' }}></Box>
                <Typography className="summary-text">Expired ({expiredQuestions.size})</Typography>
              </Box>
            )}
            {hasScreeningQuestions && (
              <Box className="summary-item" sx={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e0e4e8' }}>
                <Box className="summary-indicator" sx={{ backgroundColor: '#f59e0b' }}></Box>
                <Typography className="summary-text">{totalScreeningQuestions} Screening Question{totalScreeningQuestions > 1 ? 's' : ''}</Typography>
              </Box>
            )}
          </Box>

          {/* Jump to Question */}
          <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: '12px', mt: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#64748b', mb: 1 }}>
              Quick Navigation
            </Typography>
            <select
              value={current}
              onChange={(e) => navigateToQuestion(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '2px solid #e2e8f0',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {mcqQuestions.questions.map((q, idx) => {
                const typeLabel = q.question_type === 'mcq' ? 'MCQ' :
                                q.question_type === 'coding' ? 'Coding' :
                                q.question_type === 'architecture' ? 'Architecture' : 'Screening';
                const statusLabel = questionStatus[idx] === 'answered' ? '✓' : '○';
                return (
                  <option key={idx} value={idx}>
                    {statusLabel} Q{idx + 1}: {typeLabel}
                  </option>
                );
              })}
            </select>
          </Box>

          {/* Keyboard Shortcuts Helper */}
          <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: '12px', mt: 2, border: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#475569', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              ⌨️ Keyboard Shortcuts
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[
                { key: '←', action: 'Previous Question' },
                { key: '→', action: 'Next Question' },
                { key: 'M', action: 'Mark for Review' },
              ].map(({ key, action }) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                    {action}
                  </Typography>
                  <Box sx={{ 
                    fontSize: '10px', 
                    fontWeight: 700, 
                    color: '#475569',
                    backgroundColor: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontFamily: 'monospace',
                  }}>
                    {key}
                  </Box>
                </Box>
              ))}
            </Box>
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

      {/* Auto-Submit Warning Dialog */}
      <Dialog
        open={showAutoSubmitWarning}
        onClose={() => setShowAutoSubmitWarning(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          color: 'white',
          fontWeight: 700,
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          ⚠️ Time Running Out!
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Typography variant="body1" sx={{ mb: 2, fontSize: '16px', fontWeight: 500 }}>
            Your assessment will be automatically submitted in <strong style={{ color: '#dc2626' }}>{formatTime(quizTimer)}</strong>.
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            • Make sure you've answered all questions
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            • Review your responses if time permits
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            • Your progress is being saved automatically
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setShowAutoSubmitWarning(false)}
            variant="outlined"
            sx={{ 
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            I Understand
          </Button>
          <Button 
            onClick={() => {
              setShowAutoSubmitWarning(false);
              submitQuizAnswers(answers);
            }}
            variant="contained"
            sx={{ 
              borderRadius: '8px',
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Submit Now
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default QuizContainer;
