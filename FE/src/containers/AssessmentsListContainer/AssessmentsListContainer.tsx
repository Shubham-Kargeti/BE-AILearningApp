import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import { useNavigate } from "react-router-dom";
import {
  quizService,
} from "../../API/services";
import type { QuestionFeedbackMap } from "../../API/services";
import Toast from "../../components/Toast/Toast";

interface MyTestSession {
  session_id: string;
  question_set_id: string | null;
  skill: string | null;
  level: string | null;
  total_questions: number;
  correct_answers: number | null;
  score_percentage: number | null;
  is_completed: boolean;
  is_scored: boolean;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
}

interface ResultQuestion {
  question_id: number;
  question_text: string;
  topic: string | null;
  difficulty: string | null;
  candidate_answer: string;
  correct_answer: string;
  is_correct: boolean;
  options: Array<{ option_id: string; text: string }>;
  time_taken_seconds: number | null;
}

interface CandidateAssessmentResult {
  assessment_title?: string;
  assessment_description?: string;
  job_title?: string;
  session_id: string;
  candidate_email: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score_percentage: number | null;
  is_completed: boolean;
  skill: string | null;
  level: string | null;
  questions: ResultQuestion[];
}

const getCurrentCandidateEmail = () => {
  const storedEmail = localStorage.getItem("loggedInUser") || localStorage.getItem("userEmail");
  if (storedEmail) return storedEmail.toLowerCase();

  const profile = localStorage.getItem("userProfile");
  if (!profile) return "";

  try {
    const parsed = JSON.parse(profile);
    return typeof parsed?.email === "string" ? parsed.email.toLowerCase() : "";
  } catch {
    return "";
  }
};

const normalizeOptions = (
  options:
    | Record<string, string>
    | Array<{ option_id: string; text: string }>
    | null
    | undefined
) => {
  if (!options) return [];
  if (Array.isArray(options)) return options;

  return Object.entries(options).map(([option_id, text]) => ({
    option_id,
    text,
  }));
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";

  return parsed.toLocaleString();
};

const formatDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return "N/A";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: unknown } }).response !== null
  ) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === "string") {
      return response.data.detail;
    }
  }

  return fallbackMessage;
};

const scoreColor = (score?: number | null) => {
  if (score === null || score === undefined) return "#64748b";
  if (score >= 80) return "#15803d";
  if (score >= 60) return "#2563eb";
  return "#dc2626";
};

const sortByLatest = (results: CandidateAssessmentResult[]) =>
  [...results].sort((left, right) => {
    const leftValue = new Date(
      left.completed_at || left.started_at || 0
    ).getTime();
    const rightValue = new Date(
      right.completed_at || right.started_at || 0
    ).getTime();

    return rightValue - leftValue;
  });

const buildAssessmentTitle = (session: MyTestSession) => {
  if (session.skill && session.level) {
    return `${session.skill} - ${session.level}`;
  }

  if (session.skill) {
    return session.skill;
  }

  return "Assessment Result";
};

const mapQuestionSetResult = (
  session: MyTestSession,
  result: Awaited<ReturnType<typeof quizService.getQuestionSetTestResults>>
): CandidateAssessmentResult => ({
  assessment_title: result.assessment_title,
  assessment_description: "This assessment is designed to evaluate your skills and understanding across key areas relevant to the role.",
  job_title: result.job_title,
  session_id: result.session_id,
  candidate_email: getCurrentCandidateEmail() || null,
  started_at: session.started_at,
  completed_at: result.completed_at,
  duration_seconds: session.duration_seconds ?? result.time_taken_seconds,
  total_questions: result.total_questions,
  answered_questions: result.detailed_results.length,
  correct_answers: result.correct_answers,
  score_percentage: result.score_percentage,
  is_completed: true,
  skill: result.skill,
  level: session.level,
  questions: result.detailed_results.map((question) => ({
    question_id: question.question_id,
    question_text: question.question_text,
    topic: null,
    difficulty: null,
    candidate_answer: question.your_answer,
    correct_answer: question.correct_answer,
    is_correct: question.is_correct,
    options: normalizeOptions(question.options),
    time_taken_seconds: null,
  })),
});

const mapTestSessionResult = (
  session: MyTestSession,
  result: Awaited<ReturnType<typeof quizService.getTestResults>>
): CandidateAssessmentResult => ({
  assessment_title: buildAssessmentTitle(session),
  assessment_description: "Loaded from the candidate test-session history.",
  job_title: session.skill || "Assessment",
  session_id: result.session_id,
  candidate_email: getCurrentCandidateEmail() || null,
  started_at: session.started_at,
  completed_at: result.completed_at,
  duration_seconds: session.duration_seconds,
  total_questions: result.total_questions,
  answered_questions: result.detailed_results.length,
  correct_answers: result.correct_answers,
  score_percentage: result.score_percentage,
  is_completed: true,
  skill: session.skill,
  level: session.level,
  questions: result.detailed_results.map((question) => ({
    question_id: question.question_id,
    question_text: question.question_text,
    topic: null,
    difficulty: null,
    candidate_answer: question.your_answer,
    correct_answer: question.correct_answer,
    is_correct: question.is_correct,
    options: normalizeOptions(question.options),
    time_taken_seconds: null,
  })),
});

const loadDetailedSessionResult = async (session: MyTestSession) => {
  try {
    const questionSetResult = await quizService.getQuestionSetTestResults(session.session_id);
    return mapQuestionSetResult(session, questionSetResult);
  } catch {
    try {
      const testSessionResult = await quizService.getTestResults(session.session_id);
      return mapTestSessionResult(session, testSessionResult);
    } catch {
      return null;
    }
  }
};

const AssessmentsListContainer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [expandedSessionId, setExpandedSessionId] = useState<string | false>(false);
  const [results, setResults] = useState<CandidateAssessmentResult[]>([]);
  const [feedbackBySession, setFeedbackBySession] = useState<Record<string, QuestionFeedbackMap>>({});
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const loadFeedbackForResults = async (candidateResults: CandidateAssessmentResult[]) => {
    if (candidateResults.length === 0) return;

    const feedbackEntries = await Promise.all(
      candidateResults.map(async (result) => {
        try {
          const feedback = await quizService.getQuestionFeedback(result.session_id);
          return [result.session_id, feedback] as const;
        } catch (feedbackError) {
          console.warn("Unable to load admin feedback:", feedbackError);
          return [result.session_id, {}] as const;
        }
      })
    );

    setFeedbackBySession(Object.fromEntries(feedbackEntries));
  };

  const loadCandidateResults = async () => {
    try {
      setLoading(true);
      setError("");
      const sessions = await quizService.listMyTestSessions(0, 100);
      const completedSessions = sessions.filter((session) => session.is_completed);
      setSessionCount(completedSessions.length);

      if (completedSessions.length === 0) {
        setResults([]);
        setExpandedSessionId(false);
        return;
      }

      const resolvedResults = await Promise.all(
        completedSessions.map((session) => loadDetailedSessionResult(session))
      );

      const flattenedResults = sortByLatest(
        resolvedResults.filter(
          (result): result is CandidateAssessmentResult => result !== null
        )
      );
      setResults(flattenedResults);
      setExpandedSessionId(flattenedResults[0]?.session_id ?? false);
      await loadFeedbackForResults(flattenedResults);

      if (flattenedResults.length === 0) {
        setToast({
          type: "info",
          message: "Test sessions were found, but detailed results are not available yet.",
        });
      }
    } catch (fetchError: unknown) {
      console.error("Error loading candidate assessment results:", fetchError);
      setError(getErrorMessage(fetchError, "Failed to load your assessment results."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidateResults();
  }, []);

  useEffect(() => {
    if (results.length === 0) return;

    const intervalId = window.setInterval(() => {
      loadFeedbackForResults(results);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [results]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        ml: { xs: 0, md: "100px" },
        background:
          "radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
      }}
    >
      <Box sx={{ maxWidth: 1240, mx: "auto" }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: "1px solid rgba(148, 163, 184, 0.2)",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            backdropFilter: "blur(10px)",
            mb: 3,
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: "#0f172a", mb: 1 }}
              >
                My Assessment Results
              </Typography>
              <Typography sx={{ color: "#475569", maxWidth: 760 }}>
                All your submitted assessments in one place — view details, 
                check results, and monitor progress.
              </Typography>
            </Box>

            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/app/dashboard")}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 700,
                px: 2.25,
              }}
            >
              Back to Dashboard
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 3 }}>
            <Chip
              icon={<AssessmentOutlinedIcon />}
              label={`${results.length} result session${results.length === 1 ? "" : "s"}`}
              sx={{ fontWeight: 700, backgroundColor: "#dbeafe", color: "#1d4ed8" }}
            />
            <Chip
              icon={<HourglassTopOutlinedIcon />}
              label={`${sessionCount} completed test session${sessionCount === 1 ? "" : "s"}`}
              sx={{ fontWeight: 700, backgroundColor: "#fef3c7", color: "#b45309" }}
            />
          </Stack>
        </Paper>

        {loading ? (
          <Paper
            elevation={0}
            sx={{
              minHeight: 320,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              borderRadius: 4,
            }}
          >
            <CircularProgress />
            <Typography sx={{ color: "#64748b" }}>
              Loading your assessment history...
            </Typography>
          </Paper>
        ) : error ? (
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4 }}>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={loadCandidateResults}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          </Paper>
        ) : results.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              borderRadius: 4,
              textAlign: "center",
              border: "1px dashed #cbd5e1",
              backgroundColor: "#ffffff",
            }}
          >
            <AssessmentOutlinedIcon sx={{ fontSize: 52, color: "#94a3b8", mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0f172a", mb: 1 }}>
              No attempted assessments yet
            </Typography>
            <Typography sx={{ color: "#64748b", maxWidth: 560, mx: "auto" }}>
              When this candidate completes an assessment, the score summary and detailed
              question-wise results will appear here.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {results.map((result) => {
              const score = result.score_percentage ?? 0;
              const answeredQuestions = result.answered_questions || result.questions.length;
              const incorrectAnswers = Math.max(answeredQuestions - result.correct_answers, 0);

              return (
                <Accordion
                  key={result.session_id}
                  expanded={expandedSessionId === result.session_id}
                  onChange={(_, expanded) =>
                    setExpandedSessionId(expanded ? result.session_id : false)
                  }
                  disableGutters
                  elevation={0}
                  sx={{
                    borderRadius: "24px !important",
                    overflow: "hidden",
                    border: "1px solid rgba(148, 163, 184, 0.22)",
                    backgroundColor: "#ffffff",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      px: { xs: 2, md: 3 },
                      py: 1.5,
                      alignItems: "stretch",
                      background:
                        "linear-gradient(180deg, rgba(239, 246, 255, 0.95) 0%, rgba(255, 255, 255, 1) 100%)",
                    }}
                  >
                    <Grid container spacing={2} sx={{ width: "100%", alignItems: "center" }}>
                      <Grid size={{ xs: 12, lg: 7 }}>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 800, color: "#0f172a", mb: 0.5 }}
                        >
                          {result.assessment_title}
                        </Typography>
                        {result.job_title && (
                          <Typography sx={{ color: "#2563eb", fontWeight: 700, mb: 0.75 }}>
                            Role: {result.job_title}
                          </Typography>
                        )}
                        {(result.skill || result.level) && (
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                            {result.skill && (
                              <Chip
                                label={`Skill: ${result.skill}`}
                                size="small"
                                sx={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}
                              />
                            )}
                            {result.level && (
                              <Chip
                                label={`Level: ${result.level}`}
                                size="small"
                                sx={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                              />
                            )}
                          </Stack>
                        )}
                        {result.assessment_description && (
                          <Typography
                            sx={{
                              color: "#64748b",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              maxWidth: 720,
                            }}
                          >
                            {result.assessment_description}
                          </Typography>
                        )}
                      </Grid>

                      <Grid size={{ xs: 12, lg: 5 }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1.25}
                          justifyContent="flex-end"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                          sx={{ mb: 1.5 }}
                        >
                          <Chip
                            icon={
                              result.is_completed ? (
                                <CheckCircleOutlinedIcon />
                              ) : (
                                <HourglassTopOutlinedIcon />
                              )
                            }
                            label={result.is_completed ? "Completed" : "In Progress"}
                            sx={{
                              fontWeight: 700,
                              backgroundColor: result.is_completed ? "#dcfce7" : "#fef3c7",
                              color: result.is_completed ? "#166534" : "#b45309",
                            }}
                          />
                          <Chip
                            icon={<TrendingUpOutlinedIcon />}
                            label={
                              result.score_percentage !== null && result.score_percentage !== undefined
                                ? `Score ${score.toFixed(1)}%`
                                : "Score pending"
                            }
                            sx={{
                              fontWeight: 700,
                              backgroundColor: "rgba(37, 99, 235, 0.1)",
                              color: scoreColor(result.score_percentage),
                            }}
                          />
                        </Stack>

                        <Grid container spacing={1.25}>
                          <Grid size={{ xs: 6 }}>
                            <Card elevation={0} sx={{ backgroundColor: "#f8fafc" }}>
                              <CardContent sx={{ p: 1.5 }}>
                                <Typography sx={{ fontSize: 12, color: "#64748b", mb: 0.25 }}>
                                  Questions
                                </Typography>
                                <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                                  {result.correct_answers} / {result.total_questions} correct
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Card elevation={0} sx={{ backgroundColor: "#f8fafc" }}>
                              <CardContent sx={{ p: 1.5 }}>
                                <Typography sx={{ fontSize: 12, color: "#64748b", mb: 0.25 }}>
                                  Duration
                                </Typography>
                                <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>
                                  {formatDuration(result.duration_seconds)}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                  </AccordionSummary>

                  <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Card elevation={0} sx={{ height: "100%", backgroundColor: "#f8fafc" }}>
                          <CardContent>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              <CalendarMonthOutlinedIcon sx={{ color: "#475569" }} />
                              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                                Completed At
                              </Typography>
                            </Stack>
                            <Typography sx={{ color: "#475569" }}>
                              {formatDateTime(result.completed_at || result.started_at)}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid size={{ xs: 12, md: 3 }}>
                        <Card elevation={0} sx={{ height: "100%", backgroundColor: "#f8fafc" }}>
                          <CardContent>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              <QuizOutlinedIcon sx={{ color: "#475569" }} />
                              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                                Answered
                              </Typography>
                            </Stack>
                            <Typography sx={{ color: "#475569" }}>
                              {answeredQuestions} of {result.total_questions}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid size={{ xs: 12, md: 3 }}>
                        <Card elevation={0} sx={{ height: "100%", backgroundColor: "#f8fafc" }}>
                          <CardContent>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              <CheckCircleOutlinedIcon sx={{ color: "#475569" }} />
                              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                                Incorrect
                              </Typography>
                            </Stack>
                            <Typography sx={{ color: "#475569" }}>
                              {incorrectAnswers}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>

                      {/* <Grid size={{ xs: 12, md: 3 }}>
                        <Card elevation={0} sx={{ height: "100%", backgroundColor: "#f8fafc" }}>
                          <CardContent>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              <ScheduleOutlinedIcon sx={{ color: "#475569" }} />
                              <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                                Session
                              </Typography>
                            </Stack>
                            <Typography sx={{ color: "#475569" }}>
                              {result.session_id}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid> */}
                    </Grid>

                    {result.score_percentage !== null && result.score_percentage !== undefined && (
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          mb: 2.5,
                        }}
                      >
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          sx={{ mb: 1 }}
                        >
                          <Typography sx={{ fontWeight: 700, color: "#0f172a" }}>
                            Overall Score
                          </Typography>
                          <Typography
                            sx={{
                              fontWeight: 800,
                              color: scoreColor(result.score_percentage),
                            }}
                          >
                            {score.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.max(0, Math.min(score, 100))}
                          sx={{
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: "#dbeafe",
                            "& .MuiLinearProgress-bar": {
                              borderRadius: 999,
                              backgroundColor: scoreColor(result.score_percentage),
                            },
                          }}
                        />
                      </Box>
                    )}

                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: "#0f172a", mb: 2 }}
                    >
                      Question Breakdown
                    </Typography>

                    <Stack spacing={1.5}>
                      {result.questions.map((question, index) => {
                        const normalizedCandidateAnswer = question.candidate_answer || "No answer provided";
                        const normalizedCorrectAnswer = question.correct_answer || "Not available";
                        const latestFeedback = feedbackBySession[result.session_id]?.[
                          String(question.question_id)
                        ]?.slice(-1)[0];
                        const adminFeedback = latestFeedback?.text?.trim() || "";

                        return (
                          <Paper
                            key={`${result.session_id}-${question.question_id}`}
                            elevation={0}
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              border: `1px solid ${question.is_correct ? "#bbf7d0" : "#fecaca"}`,
                              backgroundColor: question.is_correct ? "#f0fdf4" : "#fef2f2",
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              justifyContent="space-between"
                              spacing={1.5}
                              sx={{ mb: 1.5 }}
                            >
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  sx={{ fontWeight: 800, color: "#0f172a", mb: 0.5 }}
                                >
                                  Q{index + 1}. {question.question_text}
                                </Typography>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                  {question.topic && (
                                    <Chip
                                      label={question.topic}
                                      size="small"
                                      sx={{ backgroundColor: "#e2e8f0", color: "#334155" }}
                                    />
                                  )}
                                  {question.difficulty && (
                                    <Chip
                                      label={question.difficulty}
                                      size="small"
                                      sx={{ backgroundColor: "#e0f2fe", color: "#0369a1" }}
                                    />
                                  )}
                                  {question.time_taken_seconds !== null && (
                                    <Chip
                                      label={formatDuration(question.time_taken_seconds)}
                                      size="small"
                                      sx={{ backgroundColor: "#ede9fe", color: "#5b21b6" }}
                                    />
                                  )}
                                </Stack>
                              </Box>

                              <Chip
                                label={question.is_correct ? "Correct" : "Incorrect"}
                                sx={{
                                  fontWeight: 800,
                                  alignSelf: { xs: "flex-start", md: "center" },
                                  backgroundColor: question.is_correct ? "#dcfce7" : "#fee2e2",
                                  color: question.is_correct ? "#166534" : "#b91c1c",
                                }}
                              />
                            </Stack>

                            {question.options.length > 0 ? (
                              <Stack spacing={1}>
                                {question.options.map((option) => {
                                  const isSelected = option.option_id === question.candidate_answer;
                                  const isCorrectAnswer = option.option_id === question.correct_answer;

                                  return (
                                    <Box
                                      key={`${question.question_id}-${option.option_id}`}
                                      sx={{
                                        p: 1.25,
                                        borderRadius: 2,
                                        border: "1px solid",
                                        borderColor: isCorrectAnswer
                                          ? "#4ade80"
                                          : isSelected && !question.is_correct
                                          ? "#f87171"
                                          : "#e2e8f0",
                                        backgroundColor: isCorrectAnswer
                                          ? "rgba(34, 197, 94, 0.10)"
                                          : isSelected && !question.is_correct
                                          ? "rgba(248, 113, 113, 0.12)"
                                          : "#ffffff",
                                      }}
                                    >
                                      <Typography sx={{ color: "#0f172a", fontWeight: 600 }}>
                                        {option.option_id}. {option.text}
                                      </Typography>
                                      <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                                        {isSelected && (
                                          <Chip
                                            label="Your answer"
                                            size="small"
                                            sx={{
                                              backgroundColor: question.is_correct
                                                ? "#dcfce7"
                                                : "#fee2e2",
                                              color: question.is_correct ? "#166534" : "#b91c1c",
                                            }}
                                          />
                                        )}
                                        {isCorrectAnswer && (
                                          <Chip
                                            label="Correct answer"
                                            size="small"
                                            sx={{
                                              backgroundColor: "#dcfce7",
                                              color: "#166534",
                                            }}
                                          />
                                        )}
                                      </Stack>
                                    </Box>
                                  );
                                })}
                              </Stack>
                            ) : (
                              <Box
                                sx={{
                                  p: 1.5,
                                  borderRadius: 2,
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <Typography sx={{ color: "#334155", mb: 1 }}>
                                  <strong>Your answer:</strong> {normalizedCandidateAnswer}
                                </Typography>
                                {!question.is_correct && (
                                  <Typography sx={{ color: "#166534" }}>
                                    <strong>Expected answer:</strong> {normalizedCorrectAnswer}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {question.options.length > 0 && !question.is_correct && (
                              <>
                                <Divider sx={{ my: 1.5 }} />
                                <Typography sx={{ color: "#334155" }}>
                                  <strong>Your answer:</strong> {normalizedCandidateAnswer}
                                </Typography>
                                <Typography sx={{ color: "#166534", mt: 0.75 }}>
                                  <strong>Expected answer:</strong> {normalizedCorrectAnswer}
                                </Typography>
                              </>
                            )}

                            {adminFeedback && (
                              <Box
                                sx={{
                                  mt: 1.5,
                                  p: 1.5,
                                  borderRadius: 2,
                                  backgroundColor: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                }}
                              >
                                <Typography sx={{ fontWeight: 800, color: "#1d4ed8", mb: 0.5 }}>
                                  Admin Feedback
                                </Typography>
                                <Typography sx={{ color: "#334155", whiteSpace: "pre-wrap" }}>
                                  {adminFeedback}
                                </Typography>
                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        )}
      </Box>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </Box>
  );
};

export default AssessmentsListContainer;
