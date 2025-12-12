import { useEffect, useState } from "react";
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

import QuizInstructionsModal from "./components/QuizInstructionsModal";
import "./QuizContainer.scss";
import { quizService, authService } from "../../API/services";
import type { MCQQuestion, QuestionSet } from "../../API/services";
import Loader from "../../components/Loader";
import { useNavigate, useLocation } from "react-router-dom";
import ErrorMessage from "../../components/ErrorMessage/ErrorMessage";

interface LocationState {
  assessmentId?: string;
  assessment?: {
    required_skills?: Record<string, string>;
    duration_minutes?: number;
    title?: string;
    candidate_info?: {
      name?: string;
      email?: string;
      current_role?: string;
      experience?: string;
    } | null;
  };
  fromCandidateLink?: boolean;
}

const QuizContainer = () => {
  const [showModal, setShowModal] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selectedOption, setSelected] = useState("");
  const [quizTimer] = useState(300); // 5mins
  const [questionTimer, setQuestionTimer] = useState(30);
  const [leftFullscreenCount, setLeftFullscreenCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<
    { question_id: number; selected_answer: string }[]
  >([]);
  const [question, setQuestion] = useState<MCQQuestion>({
    question_id: 0,
    question_text: "",
    options: [] as { option_id: string; text: string }[],
    correct_answer: "",
  });

  const [mcqQuestions, setMcqQuestions] = useState<QuestionSet>({
    question_set_id: "",
    skill: "",
    level: "",
    total_questions: 0,
    created_at: "",
    questions: [],
  });
  const [loading, setLoading] = useState(true);
  const [quizStarted, setQuizStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionStartedAnonymous, setSessionStartedAnonymous] = useState<boolean>(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [quizResult, setQuizResult] = useState<{
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    percentage: number;
    status: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresLoginToStart, setRequiresLoginToStart] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;
  
  // Try to get assessment data from location state first, then localStorage
  const getAssessmentData = () => {
    if (locationState?.fromCandidateLink && locationState?.assessment) {
      return { assessment: locationState.assessment, fromCandidateLink: true };
    }
    // Fallback to localStorage
    const stored = localStorage.getItem("currentAssessment");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { assessment: parsed, fromCandidateLink: true };
      } catch {
        return { assessment: null, fromCandidateLink: false };
      }
    }
    return { assessment: null, fromCandidateLink: false };
  };
  
  const { assessment: assessmentData, fromCandidateLink: isFromCandidateLink } = getAssessmentData();

  const getMCQsBasedOnProfile = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const isAnonymousStart = !token;
      setSessionStartedAnonymous(isAnonymousStart);
      setLoading(true);
      setError(null);
      
      let topic = "";
      let level = "intermediate";
      let subtopics: string[] = [];
      
      console.log("Assessment data:", assessmentData);
      console.log("Is from candidate link:", isFromCandidateLink);
      
      if (isFromCandidateLink && assessmentData?.required_skills) {
        const skills = Object.keys(assessmentData.required_skills);
        console.log("Skills from assessment:", skills);
        topic = skills[0] || "General";
        subtopics = skills.slice(1);
        const skillLevel = Object.values(assessmentData.required_skills)[0] as string;
        level = skillLevel || "intermediate";
      } else {
        const userProfile = localStorage.getItem("userProfile");
        const profileData = userProfile ? JSON.parse(userProfile) : {};
        topic = profileData.topic || "";
        level = profileData.level || "intermediate";
        subtopics = profileData.subtopics || [];
      }
      
      console.log("Topic:", topic, "Level:", level, "Subtopics:", subtopics);
      
      if (!topic) {
        setError("No topic specified for the quiz. Please set up your profile or use a valid assessment link.");
        setLoading(false);
        return;
      }
      
      const res = await quizService.generateMCQs(topic, level, subtopics);
      setMcqQuestions(res);
      const questionData = res.questions[current];
      setQuestion(questionData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching MCQs:", error);
      setError("Unable to load questions. Please try again later.");
      setLoading(false);
    }
  };

  useEffect(() => {
    getMCQsBasedOnProfile();
  }, []);

  const getQuizSessionId = async () => {
    if (!mcqQuestions.question_set_id) {
      setError("Questions not loaded. Please refresh and try again.");
      setToastMessage("Questions not loaded. Please refresh.");
      setShowToast(true);
      return;
    }
    
    try {
      // If this assessment is candidate-specific but a different user is logged-in, prompt login
      const candidateEmail = locationState?.assessment?.candidate_info?.email;
      const currentUserEmail = localStorage.getItem("userEmail");
      if (candidateEmail && currentUserEmail && candidateEmail !== currentUserEmail) {
        setRequiresLoginToStart(true);
        setError("This assessment link is reserved for a specific candidate. Please login as the candidate to start.");
        setToastMessage("Please login as the candidate to start the assessment.");
        setShowToast(true);
        return;
      }
      // Prepare candidate info if available (for anonymous start)
      const candidateInfo: { candidate_name?: string; candidate_email?: string } = {};
      if (locationState?.assessment?.candidate_info) {
        candidateInfo.candidate_name = locationState.assessment.candidate_info.name;
        candidateInfo.candidate_email = locationState.assessment.candidate_info.email;
      } else if (localStorage.getItem("userEmail")) {
        candidateInfo.candidate_email = localStorage.getItem("userEmail") as string;
      }

      const res = await quizService.startQuiz(mcqQuestions.question_set_id, candidateInfo);
      setSessionId(res.session_id);
      setShowModal(false);
      document.documentElement.requestFullscreen();
      document.addEventListener("contextmenu", (e) => e.preventDefault());
      setQuizStarted(true);
    } catch (error: any) {
      console.error("Error starting quiz:", error);
      const status = error?.response?.status;
      if (status === 401) {
        setError("You must be logged in to start this assessment. Please provide your email or log in.");
        setToastMessage("Authentication required. Please login to continue.");
      } else if (status === 403) {
        setError("Your account does not have permission to start this assessment. Please contact the admin.");
        setToastMessage("Account inactive or unauthorized. Contact admin.");
        setRequiresLoginToStart(true);
      } else {
        setError("Unable to start quiz. Please try again later.");
        setToastMessage("Error starting quiz. Please try again.");
      }
      setShowToast(true);
    }
  };

  const startQuiz = () => {
    getQuizSessionId();
  };

  const loginAsCandidateAndStart = async () => {
    const candidateEmail = locationState?.assessment?.candidate_info?.email || localStorage.getItem("userEmail");
    if (!candidateEmail) {
      // Fall back to navigate to login screen
      window.location.href = "/login";
      return;
    }
    try {
      const res = await authService.login(candidateEmail);
      if (res?.access_token) {
        localStorage.setItem("authToken", res.access_token);
        localStorage.setItem("userEmail", candidateEmail);
        setRequiresLoginToStart(false);
        // Attempt to start again
        await getQuizSessionId();
      }
    } catch (err) {
      console.error("Candidate auto-login failed:", err);
    }
  };

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

    document.addEventListener("fullscreenchange", handleExit);
    document.addEventListener("visibilitychange", handleTabChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleExit);
      document.removeEventListener("visibilitychange", handleTabChange);
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
          ["c", "v", "s", "u", "p"].includes(e.key.toLowerCase())) ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const disableCopy = (e: ClipboardEvent) => e.preventDefault();
    const disableContext = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("keydown", blockEvents);
    document.addEventListener("copy", disableCopy);
    document.addEventListener("paste", disableCopy);
    document.addEventListener("contextmenu", disableContext);

    return () => {
      document.removeEventListener("keydown", blockEvents);
      document.removeEventListener("copy", disableCopy);
      document.removeEventListener("paste", disableCopy);
      document.removeEventListener("contextmenu", disableContext);
    };
  }, []);

  useEffect(() => {
    if (leftFullscreenCount >= 2) {
      setSubmitted(true);
    }
  }, [leftFullscreenCount]);

  useEffect(() => {
    if (!quizStarted) return;
    if (questionTimer === 0) {
      goNext();
      return;
    }

    const t = setInterval(() => setQuestionTimer((prev) => prev - 1), 1000);

    return () => clearInterval(t);
  }, [quizStarted, questionTimer]);

  const submitQuizAnswers = async (
    answers: { question_id: number; selected_answer: string }[]
  ) => {
    try {
      setIsSubmitting(true);
      const res = await quizService.submitQuiz(sessionId, answers, sessionStartedAnonymous);
      const score = res.score_percentage;
      const correctCount = res.correct_answers || Math.round((score / 100) * answers.length);
      
      // Store results for display
      setQuizResult({
        score: score,
        totalQuestions: answers.length,
        correctAnswers: correctCount,
        percentage: score,
        status: score >= 70 ? "Passed" : "Under Review",
      });
      
      localStorage.setItem("latestScore", score.toString());
      localStorage.setItem("quizResult", JSON.stringify({
        score,
        totalQuestions: answers.length,
        correctAnswers: correctCount,
        percentage: score,
        completedAt: new Date().toISOString(),
      }));
      
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
      console.error("Error submitting quiz answers:", error);
      // Still show result screen even on error
      setQuizResult({
        score: 0,
        totalQuestions: answers.length,
        correctAnswers: 0,
        percentage: 0,
        status: "Submission Error - Please contact admin",
      });
    }
  };

  const goNext = () => {
    const currentQuestion = mcqQuestions.questions[current];

    setAnswers((prev) => [
      ...prev,
      {
        question_id: currentQuestion.question_id,
        selected_answer: selectedOption,
      },
    ]);

    if (current < mcqQuestions.questions.length - 1) {
      const question = mcqQuestions.questions[current + 1];
      setQuestion(question);
      setCurrent((prev) => prev + 1);
      setQuestionTimer(30);
      setSelected("");
    } else {
      setSubmitted(true);
    }
  };

  if (error) {
    return <ErrorMessage message={error} onRetry={getMCQsBasedOnProfile} />;
  }

  if (loading) {
    return <Loader fullscreen message="Loading AgenticAI assessment..." />;
  }

  if (submitted) {
    // Auto-submit when reaching this screen
    if (!quizResult && !isSubmitting) {
      submitQuizAnswers(answers);
    }
    
    if (isSubmitting) {
      return (
        <Box className="submission-screen">
          <Typography className="submitted-title">Submitting Quiz...</Typography>
          <Typography className="submitted-text">
            Please wait while we process your answers.
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box className="submission-screen">
        <Typography className="submitted-title">
          Assessment Completed!
        </Typography>
        
        <Box sx={{ my: 4, textAlign: 'center' }}>
          {/* Hourglass/Review Icon */}
          <Box sx={{ 
            width: 120, 
            height: 120, 
            borderRadius: '50%', 
            border: '6px solid #1976d2',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            backgroundColor: '#e3f2fd'
          }}>
            <Typography variant="h2" sx={{ color: '#1976d2' }}>
              ✓
            </Typography>
          </Box>
          
          <Box sx={{ 
            p: 3, 
            borderRadius: 2, 
            backgroundColor: '#fff8e1',
            border: '1px solid #ffcc02',
            mb: 3,
            maxWidth: 450,
            margin: '0 auto'
          }}>
            <Typography variant="h5" sx={{ 
              color: '#f57c00',
              fontWeight: 'bold',
              mb: 1
            }}>
              Result Awaiting
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Your assessment has been submitted successfully.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Your responses are being reviewed. You will be notified once the results are finalized.
            </Typography>
          </Box>
          
          <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2, maxWidth: 450, margin: '24px auto 0' }}>
            <Typography variant="body2" color="text.secondary">
              <strong>What happens next?</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              • Your results will be reviewed by the admin<br/>
              • You'll receive an email with your results<br/>
              • If eligible, a personalized learning path will be created for you
            </Typography>
          </Box>
        </Box>

        <Typography className="submitted-text">
          Thank you for completing the quiz.
        </Typography>

        <Button
          variant="contained"
          className="return-btn"
          onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
            // Check if user is logged in, otherwise go to home
            const authToken = localStorage.getItem("authToken");
            if (authToken) {
              navigate("/app/dashboard");
            } else {
              navigate("/");
            }
          }}
        >
          {localStorage.getItem("authToken") ? "Return to Dashboard" : "Go to Home"}
        </Button>
      </Box>
    );
  }

  if (showModal) {
    return <QuizInstructionsModal open={showModal} onStart={startQuiz} />;
  }

  return (
    <>
      <Box className="quiz-container">
        <Box className="progress-container">
          <LinearProgress
            variant="determinate"
            value={((current + 1) / mcqQuestions.questions.length) * 100}
            className="progress-bar"
          />
          <Typography className="progress-text">
            Question {current + 1} of {mcqQuestions.questions.length}
          </Typography>
        </Box>

        {showWarning && (
          <Box className="warning-modal">
            <Box className="warning-box">
              <Typography className="warning-title">Warning</Typography>
              <Typography className="warning-message">
                You exited fullscreen or switched tabs. Doing this again will
                submit your quiz.
              </Typography>
              <Button
                variant="contained"
                className="warning-btn"
                onClick={() => {
                  setShowWarning(false);
                  document.documentElement.requestFullscreen().catch(() => {});
                }}
              >
                Continue Quiz
              </Button>
            </Box>
          </Box>
        )}

        <Box className="quiz-header">
                    {requiresLoginToStart && (
                      <Box sx={{ my: 2 }}>
                        <Alert severity="warning" action={
                          <Button color="inherit" size="small" onClick={loginAsCandidateAndStart}>
                            Login and Retry
                          </Button>
                        }>
                          This assessment requires you to login as the candidate to start. Please login and retry.
                        </Alert>
                      </Box>
                    )}
          <Typography className="timer">Quiz Time: {quizTimer}s</Typography>
          <Typography className="timer">
            Question Time: {questionTimer}s
          </Typography>
        </Box>

        <Typography className="quiz-question">
          {question.question_text}
        </Typography>

        <RadioGroup
          value={selectedOption}
          onChange={(e) => setSelected(e.target.value)}
        >
          {question.options.map((opt) => (
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
      </Box>
      <Snackbar
        open={showToast}
        autoHideDuration={3000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert severity="error" variant="filled">
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default QuizContainer;
