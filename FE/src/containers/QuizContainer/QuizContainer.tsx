import { useEffect, useState, useRef } from "react";
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
import { quizService, authService } from "../../API/services";
import type {
  AssessmentQuestion,
  QuestionSet,
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

const QuizContainer = () => {
  /* ================= CORE UI STATE ================= */
  const [, setShowModal] = useState(true);
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

  /**
   * IMPORTANT:
   * Question MUST be nullable to avoid runtime crashes
   */
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
  const [, setLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  const [sessionStartedAnonymous, setSessionStartedAnonymous] =
    useState<boolean>(false);

  const [requiresLoginToStart, setRequiresLoginToStart] =
    useState<boolean>(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [screeningQuestions, setScreeningQuestions] = useState<string[]>([]);
  const [screeningIndex, setScreeningIndex] = useState(0);


  const [quizResult, setQuizResult] = useState<{
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    percentage: number;
    status: string;
  } | null>(null);

  // ================= ADDITIONAL SCREENING QUESTION (FE ONLY) =================
  const [additionalScreeningQuestion, setAdditionalScreeningQuestion] =
    useState<string | null>(null);

  const [additionalScreeningAnswer, setAdditionalScreeningAnswer] =
    useState<string>("");


  /* ================= REFS ================= */
  const initialQuizDurationRef = useRef<number>(quizTimer);
  const questionTimeRef = useRef<number>(QUESTION_TIME_DEFAULT);

  /* ================= ROUTER ================= */
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  /* ================================================================
     Helper: normalize backend question/sets to `AssessmentQuestion`
     ================================================================ */
  const normalizeQuestion = (raw: any): AssessmentQuestion => {
    const q: any = { ...raw };

    if (!q.question_type) {
      if (q.type) q.question_type = q.type;
      else if (Array.isArray(q.options) || q.options)
        q.question_type = "mcq";
      else q.question_type = "screening";
    }

    return q as AssessmentQuestion;
  };

  const normalizeQuestionSet = (raw: any): QuestionSet => {
    return {
      question_set_id: raw.question_set_id ?? raw.id ?? "",
      skill: raw.skill ?? raw.topic ?? "",
      level: raw.level ?? "intermediate",
      total_questions: raw.total_questions ?? (raw.questions?.length ?? 0),
      created_at: raw.created_at ?? raw.started_at ?? "",
      questions: Array.isArray(raw.questions)
        ? raw.questions.map((q: any) => normalizeQuestion(q))
        : [],
    };
  };

  /**
   * Assessment resolution
   * Admin assessment is identified ONLY by question_set_id
   */
  const assessmentData = locationState?.assessment ?? null;
  const isAdminAssessment = Boolean(
    assessmentData?.question_set_id
  );

  console.log(
    "Assessment resolved:",
    assessmentData,
    "isAdminAssessment:",
    isAdminAssessment
  );

  /* ================================================================
 ADDITIONAL SCREENING QUESTION FLAG (INDEX-BASED)
 ================================================================ */
  const isAdditionalQuestionStep =
    !submitted &&
    !!additionalScreeningQuestion &&
    current === mcqQuestions.questions.length;
  console.log("SCREENING DEBUG", {
    additionalScreeningQuestion,
    current,
    dbQuestionsLength: mcqQuestions.questions.length,
    submitted,
    isAdditionalQuestionStep,
  });


  /* ================================================================
     NORMAL QUICK MCQ FLOW (STABLE – DO NOT TOUCH)
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

      const normalized = normalizeQuestionSet(res);
      setMcqQuestions(normalized);
      setQuestion(normalized.questions?.[0] ?? null);
      setLoading(false);
    } catch (err) {
      console.error("Error loading MCQs:", err);
      setError("Unable to load questions.");
      setLoading(false);
    }
  };

  /* ================================================================
     ADMIN / CANDIDATE ASSESSMENT FLOW (PRE-GENERATED)
     ================================================================ */
  const loadPreGeneratedQuestionSet = async () => {
    try {
      console.log(
        "Loading PRE-GENERATED QuestionSet:",
        assessmentData?.question_set_id
      );

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

      const normalized = normalizeQuestionSet(res);
      setMcqQuestions(normalized);
      setQuestion(normalized.questions?.[0] ?? null);
      setLoading(false);
    } catch (err) {
      console.error(
        "Error loading admin assessment:",
        err
      );
      setError(
        "Unable to load assessment. Please contact admin."
      );
      setLoading(false);
    }
  };

  /* ================= INITIAL LOAD ================= */
  useEffect(() => {
    console.log(
      "Init Quiz — isAdminAssessment =",
      isAdminAssessment
    );

    if (isAdminAssessment) {
      loadPreGeneratedQuestionSet();
    } else {
      getMCQsBasedOnProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 
  // ================= READ ADDITIONAL SCREENING QUESTION =================
  useEffect(() => {
    console.log("SCREENING: useEffect triggered");

    if (!locationState?.assessment?.description) return;

    try {
      const raw = locationState.assessment.description;
      console.log("SCREENING: Raw description", raw);

      const parsed =
        typeof raw === "string" ? JSON.parse(raw) : raw;

      console.log("SCREENING: Parsed description", parsed);

      if (Array.isArray(parsed.screening_questions)) {
        setScreeningQuestions(parsed.screening_questions);
        setScreeningIndex(0);

        setAdditionalScreeningQuestion(
          parsed.screening_questions[0]
        );

        console.log(
          "SCREENING SET (question):",
          parsed.screening_questions[0]
        );
      }
    } catch (err) {
      console.error("SCREENING: parse failed", err);
    }
  }, [locationState]);


  /* ================================================================
     START QUIZ SESSION
     ================================================================ */
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

      // Candidate-specific link enforcement
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

      setSessionId(res.session_id);

      const durationMinutes =
        locationState?.assessment?.duration_minutes ??
        assessmentData?.duration_minutes;

      const initialDuration =
        typeof durationMinutes === "number"
          ? durationMinutes * 60
          : 300;

      initialQuizDurationRef.current = initialDuration;
      setQuizTimer(initialDuration);

      const totalQuestions =
        mcqQuestions.questions.length || 10;

      const perQuestion = Math.max(
        1,
        Math.floor(initialDuration / totalQuestions)
      );

      questionTimeRef.current = perQuestion;
      setQuestionTimer(perQuestion);

      setShowModal(false);

      // Force fullscreen
      document.documentElement
        .requestFullscreen()
        .catch(() => { });
      document.addEventListener(
        "contextmenu",
        (e) => e.preventDefault()
      );

      setQuizStarted(true);
    } catch (error: any) {
      console.error("Error starting quiz:", error);
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
      console.error(
        "Candidate auto-login failed:",
        err
      );
    }
  };

  /* ================================================================
     FULLSCREEN & TAB VIOLATION GUARDS
     ================================================================ */
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

  /* ================================================================
     KEYBOARD / COPY PROTECTION
     ================================================================ */
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

  /* ================================================================
     GLOBAL & PER-QUESTION TIMERS
     ================================================================ */
  // useEffect(() => {
  //   if (!quizStarted) return;

  //   const interval = setInterval(() => {
  //     // Global quiz timer
  //     setQuizTimer((prev) => {
  //       if (prev <= 1) {
  //         setSubmitted(true);
  //         return 0;
  //       }
  //       return prev - 1;
  //     });

  //     // Per-question timer
  //     setQuestionTimer((prev) => {
  //       if (prev <= 1) {
  //         goNext();
  //         return questionTimeRef.current;
  //       }
  //       return prev - 1;
  //     });
  //   }, 1000);

  //   return () => clearInterval(interval);
  // }, [quizStarted]);
  useEffect(() => {
    if (!quizStarted) return;

    const interval = setInterval(() => {
      // ================= GLOBAL QUIZ TIMER =================
      setQuizTimer((prev) => {
        if (prev <= 1) {
          console.log("⏱ GLOBAL QUIZ TIMER EXPIRED", {
            prevTimerValue: prev,
            submittedBefore: submitted,
          });

          setSubmitted(true);
          return 0;
        }
        return prev - 1;
      });

      // ================= PER-QUESTION TIMER =================
      setQuestionTimer((prev) => {
        if (prev <= 1) {
          console.log("⏱ QUESTION TIMER EXPIRED", {
            prevTimerValue: prev,
            currentIndex: current,
            dbQuestionsLength: mcqQuestions.questions.length,
            hasScreeningQuestion: !!additionalScreeningQuestion,
            isAdditionalQuestionStep,
            submitted,
          });

          console.log("➡️ goNext() CALLED FROM TIMER");

          goNext();
          return questionTimeRef.current;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quizStarted]);




  useEffect(() => {
    if (submitted && !quizResult && !isSubmitting) {
      submitQuizAnswers(answers);
    }
  }, [submitted, answers, quizResult, isSubmitting]);


  const submitQuizAnswers = async (
    answers: {
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
          answers,
          sessionStartedAnonymous
        );

        score = res.score_percentage ?? 0;
        correctCount =
          res.correct_answers ??
          Math.round((score / 100) * answers.length);

        localStorage.setItem("latestScore", score.toString());
        localStorage.setItem(
          "quizResult",
          JSON.stringify({
            score,
            totalQuestions: answers.length,
            correctAnswers: correctCount,
            percentage: score,
            completedAt: new Date().toISOString(),
          })
        );
      } catch (apiError) {
        console.warn(
          "Submit API failed, proceeding to submitted screen",
          apiError
        );
      }

      // ✅ THIS WAS MISSING
      setQuizResult({
        score,
        totalQuestions: answers.length,
        correctAnswers: correctCount,
        percentage: score,
        status: "Submitted",
      });

    } finally {
      setIsSubmitting(false);
      //setSubmitted(true);
    }
  };


  /* ================================================================
     NEXT QUESTION HANDLER (CORE FLOW)
     ================================================================ */
  
  const goNext = () => {
    console.log("GO NEXT", {
      current,
      screeningIndex,
      screeningQuestions,
      isAdditionalQuestionStep,
    });

    // ================= SCREENING STEP =================
    if (isAdditionalQuestionStep) {
      console.log("SCREENING ANSWER SUBMIT", {
        screeningIndex,
        answer: additionalScreeningAnswer,
      });

      // store screening answer
      setAnswers((prev) => [
        ...prev,
        {
          question_id: -1 - screeningIndex, // unique FE-only IDs
          selected_answer: additionalScreeningAnswer,
        },
      ]);

      const nextIndex = screeningIndex + 1;

      // move to next screening question
      if (nextIndex < screeningQuestions.length) {
        setScreeningIndex(nextIndex);
        setAdditionalScreeningQuestion(
          screeningQuestions[nextIndex]
        );
        setAdditionalScreeningAnswer("");
        return; // 🔴 VERY IMPORTANT
      }

      // all screening questions done
      console.log("ALL SCREENING QUESTIONS COMPLETED");
      setSubmitted(true);
      return;
    }

    // ================= DB QUESTION STEP =================
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
      console.log("LAST DB QUESTION REACHED", {
        current,
        dbQuestionsLength: mcqQuestions.questions.length,
        hasScreening: screeningQuestions.length > 0,
      });

      // last DB question → move to screening OR submit
      if (screeningQuestions.length > 0) {
        setCurrent((i) => i + 1); // enter screening
      } else {
        setSubmitted(true);
      }
    }
  };


  /* ================================================================
     ADDITIONAL SCREENING QUESTION (PHASE 3 – FE ONLY)
     ================================================================ */
  if (isAdditionalQuestionStep) {
    console.log("RENDERING SCREENING UI");

    return (
      <Box className="quiz-container">
        <Typography className="quiz-question">
          {additionalScreeningQuestion}
        </Typography>

        <Editor
          height="300px"
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

        <Button
          className="next-btn"
          variant="contained"
          onClick={goNext}
          disabled={!additionalScreeningAnswer.trim()}
        >
          Submit
        </Button>
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

  /* ================================================================
     DB QUESTION RENDER (PHASE 2 – ONLY DB QUESTIONS)
     ================================================================ */
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




  return (
    <>
      <Box className="quiz-container">
        {/* Progress */}
        <Box className="progress-container">
          <LinearProgress
            variant="determinate"
            value={
              ((current + 1) /
                mcqQuestions.questions.length) *
              100
            }
          />
          <Typography className="progress-text">
            Question {current + 1} of{" "}
            {mcqQuestions.questions.length}
          </Typography>
        </Box>

        {/* Warning */}
        {showWarning && (
          <Box className="warning-modal">
            <Box className="warning-box">
              <Typography className="warning-title">
                Warning
              </Typography>
              <Typography className="warning-message">
                You exited fullscreen or switched tabs.
                Doing this again will submit your quiz.
              </Typography>
              <Button
                variant="contained"
                onClick={() => {
                  setShowWarning(false);
                  document.documentElement
                    .requestFullscreen()
                    .catch(() => { });
                }}
              >
                Continue Quiz
              </Button>
            </Box>
          </Box>
        )}

        {/* Header */}
        <Box className="quiz-header">
          {requiresLoginToStart && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={
                    loginAsCandidateAndStart
                  }
                >
                  Login and Retry
                </Button>
              }
            >
              This assessment requires you to login
              as the candidate to start.
            </Alert>
          )}

          <Typography className="timer">
            Quiz Time: {quizTimer}s
          </Typography>
          <Typography className="timer">
            Question Time: {questionTimer}s
          </Typography>
        </Box>

        {/* Question */}
        <Typography className="quiz-question">
          {question.question_text}
        </Typography>

        


        {/* ================= MCQ ================= */}
        {/* {question.question_type === "mcq" && ( */}
        {isMcq && (

          <>
            <RadioGroup
              value={selectedOption}
              onChange={(e) =>
                setSelected(e.target.value)
              }
            >
              {mcqOptions.map((opt) => (
                <FormControlLabel
                  key={opt.option_id}
                  value={opt.option_id}
                  control={<Radio />}
                  label={opt.text}
                />
              ))}
            </RadioGroup>

            <Button
              className="next-btn"
              variant="contained"
              onClick={goNext}
              disabled={!selectedOption}
            >
              Next
            </Button>
          </>
        )}

        {/* ================= CODING ================= */}
        {question.question_type === "coding" &&
          (() => {
            const constraints =
              question.meta?.constraints ?? [];
            const language =
              question.meta?.language ??
              "plaintext";

            return (
              <>
                <Typography sx={{ mt: 2 }}>
                  Language: {language}
                </Typography>

                {constraints.length > 0 && (
                  <Typography sx={{ mt: 1 }}>
                    Constraints:
                    <ul>
                      {constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </Typography>
                )}

                <Editor
                  height="300px"
                  language={language}
                  value={textAnswer}
                  onChange={(v) =>
                    setTextAnswer(v || "")
                  }
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />

                <Button
                  className="next-btn"
                  variant="contained"
                  onClick={goNext}
                  disabled={!textAnswer.trim()}
                >
                  Next
                </Button>
              </>
            );
          })()}

        {/* ================= ARCHITECTURE ================= */}
        {question.question_type === "architecture" &&
          (() => {
            const focusAreas =
              question.meta?.focus_areas ?? [];

            return (
              <Box className="architecture-layout">
                {/* LEFT: CONTEXT / GUIDANCE */}
                <Box className="architecture-context">
                  {focusAreas.length > 0 && (
                    <>
                      <Typography className="section-title">
                        Focus Areas
                      </Typography>
                      <ul className="focus-area-list">
                        {focusAreas.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  <Typography className="hint-text">
                    Explain your system design clearly. Cover
                    components, data flow, scalability,
                    reliability, and trade-offs.
                  </Typography>
                </Box>

                {/* RIGHT: ANSWER */}
                {/* <Box className="architecture-answer">
                  <Typography className="section-title">
                    Your Design
                  </Typography>

                  <textarea
                    className="architecture-textarea large"
                    placeholder="Describe your system design, components, scaling strategy, and trade-offs..."
                    value={textAnswer}
                    onChange={(e) =>
                      setTextAnswer(e.target.value)
                    }
                  />

                  <Button
                    className="next-btn"
                    variant="contained"
                    onClick={goNext}
                    disabled={!textAnswer.trim()}
                  >
                    Next
                  </Button>
                </Box> */}
                <Box className="architecture-answer">
                  <Typography className="section-title">
                    Your Design
                  </Typography>

                  <textarea
                    className="architecture-textarea large"
                    placeholder="Describe your system design, components, scaling strategy, and trade-offs..."
                    value={textAnswer}
                    onChange={(e) =>
                      setTextAnswer(e.target.value)
                    }
                  />
                </Box>
                <Box sx={{ marginTop: "20px" }}>
                  <Button
                    className="next-btn"
                    variant="contained"
                    onClick={goNext}
                    disabled={!textAnswer.trim()}
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            );
          })()}

      </Box>

      {/* Snackbar */}
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

