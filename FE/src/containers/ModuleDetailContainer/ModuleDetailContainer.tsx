import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { AxiosError } from "axios";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DownloadIcon from "@mui/icons-material/Download";
import EmailIcon from "@mui/icons-material/Email";
import html2canvas from "html2canvas";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import type { ModuleDetailResponse, QuizSubmitResponse, CertificateDataResponse } from "../../API/onboarding_module.model";
import "./ModuleDetailContainer.scss";

const ModuleDetailContainer = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const candidateId = localStorage.getItem("candidateId") || "";
  const [data, setData] = useState<ModuleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type AnswerValue = { selected: string } | { text: string };
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [nextModuleId, setNextModuleId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const lastVideoUpdateRef = useRef<number>(0);
  const previousModuleIdRef = useRef(moduleId);
  const isVideoReady = !!data?.video_url;
  const [showCongratsDialog, setShowCongratsDialog] = useState(false);
  const [certificateData, setCertificateData] = useState<CertificateDataResponse | null>(null);
  const [isSharingEmail, setIsSharingEmail] = useState(false);
  const certificateRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    setQuizResult(null);
    setSubmitted(false);
    setAnswers({});
    setIsSubmitting(false);
    setNextModuleId(null);
    setVideoCompleted(false);
  }, [moduleId]);

  useEffect(() => {
    if (!isVideoReady || !videoRef.current) return;

    const video = videoRef.current;

    const handleTimeUpdate = async () => {
      if (!data?.module?.id) return;
      const current = Math.floor(video.currentTime || 0);
      const total = Math.floor(video.duration || 0);
      if (total <= 0) return;

      const now = Date.now();
      if (now - lastVideoUpdateRef.current < 2000) {
        return;
      }

      const percentage = Math.round((current / total) * 100);
      const isCompleted = percentage >= 95;

      try {
        const updated = await onboardingModuleService.updateVideoProgress(candidateId, Number(moduleId), {
          current_duration_seconds: current,
          total_duration_seconds: total,
          completion_percentage: percentage,
          is_completed: isCompleted,
        });
        if (updated && isCompleted) {
          setVideoCompleted(true);
        }
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error("Video progress update failed", err.response?.data || err.message);
        } else {
          console.error("Video progress update failed", err);
        }
      } finally {
        lastVideoUpdateRef.current = Date.now();
      }
    };

    const handleEnded = async () => {
      if (!data?.module?.id) return;
      const total = Math.floor(video.duration || 0);
      try {
        const updated = await onboardingModuleService.updateVideoProgress(candidateId, Number(moduleId), {
          current_duration_seconds: total,
          total_duration_seconds: total,
          completion_percentage: 100,
          is_completed: true,
        });
        if (updated) {
          setVideoCompleted(true);
        }
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error("Video completion update failed", err.response?.data || err.message);
        } else {
          console.error("Video completion update failed", err);
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [isVideoReady, data?.module?.id, moduleId]);

  const hasExistingAttempt = !!data?.quiz_attempts?.length;
  const lastAttempt = hasExistingAttempt ? data.quiz_attempts[0] : null;
  const hasPassedQuiz = (quizResult?.passing_status === "PASS") ||
                        (hasExistingAttempt && lastAttempt?.passing_status === "PASS");
  const isQuizReadOnly = (quizResult?.passing_status === "PASS") ||
                         (hasExistingAttempt && lastAttempt?.passing_status === "PASS");

  useEffect(() => {
    if (!data?.quiz_attempts?.length) return;
    const attempt = data.quiz_attempts[0];
    const mapped: Record<number, AnswerValue> = {};
    for (const response of attempt.responses) {
      if (!response.question_id || response.employee_answer == null) continue;
      const question = data.quiz_questions.find((q) => q.id === response.question_id);
      const type = (question?.question_type || "MCQ").toUpperCase();
      if (type === "MCQ" || type === "SCENARIO") {
        mapped[response.question_id] = { selected: response.employee_answer };
      } else {
        mapped[response.question_id] = { text: response.employee_answer };
      }
    }
    setAnswers(mapped);
    setSubmitted(false);
    setQuizResult(null);
  }, [data?.quiz_attempts, data?.quiz_questions]);

  useEffect(() => {
    if (!data?.module?.rank || !hasPassedQuiz) {
      setNextModuleId(null);
      return;
    }

    const fetchNextModule = async () => {
      try {
        const summary = await onboardingModuleService.getEmployeeProgressSummary(candidateId);
        const nextModule = summary.modules
          .filter((module) => module.rank > data.module.rank)
          .sort((a, b) => a.rank - b.rank)
          .find((module) => module.is_unlocked);

        setNextModuleId(nextModule?.module_id ?? null);
      } catch (err) {
        if (err instanceof AxiosError) {
          console.error("Failed to load next module", err.response?.data || err.message);
        } else {
          console.error("Failed to load next module", err);
        }
        setNextModuleId(null);
      }
    };

    fetchNextModule();
  }, [candidateId, data?.module?.rank, hasPassedQuiz]);

  useEffect(() => {
    if (!isVideoReady || !videoRef.current) return;
    const video = videoRef.current;
    if (data.video_completed && !videoCompleted) {
      video.currentTime = video.duration || 0;
    }
  }, [isVideoReady, data?.video_completed, videoCompleted]);

  useEffect(() => {
    const fetchData = async () => {
      if (!moduleId) return;
      try {
        const result = await onboardingModuleService.getModuleDetail(candidateId, Number(moduleId));
        setData(result);
      } catch (err) {
        if (err instanceof AxiosError) {
          setError(err.response?.data?.detail || "Failed to load module detail");
        } else {
          setError("Failed to load module detail");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [moduleId]);

  useLayoutEffect(() => {
    if (previousModuleIdRef.current !== moduleId && !loading) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      previousModuleIdRef.current = moduleId;
    }
  }, [moduleId, loading]);

  const handleAnswerChange = (questionId: number, value: string, type: string) => {
    if (type === "MCQ" || type === "SCENARIO") {
      setAnswers((prev) => ({ ...prev, [questionId]: { selected: value } }));
    } else {
      setAnswers((prev) => ({ ...prev, [questionId]: { text: value } }));
    }
  };

  const handleSubmit = async () => {
    if (!data || isSubmitting || isQuizReadOnly) return;

    const answersPayload = Object.entries(answers)
      .filter(([, value]) => value && ("selected" in value ? value.selected.trim() !== "" : value.text.trim() !== ""))
      .map(([questionId, value]) => ({
        question_id: Number(questionId),
        answer: "selected" in value ? value.selected : value.text,
      }));

    if (!answersPayload.length) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await onboardingModuleService.submitModuleQuiz(candidateId, Number(data.module.id), answersPayload);
      setQuizResult(result);
      setSubmitted(result.passing_status === "PASS");

      if (result.passing_status === "PASS" && data.module.rank === 6) {
        await handleGenerateAndShowCertificate();
      }
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail || "Failed to submit quiz");
      } else {
        setError("Failed to submit quiz");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateAndShowCertificate = async () => {
    if (!data) return;
    try {
      await onboardingModuleService.generateCertificate(candidateId, Number(data.module.id));
      const certData = await onboardingModuleService.getCertificate(candidateId, Number(data.module.id));
      setCertificateData(certData);
      setShowCongratsDialog(true);
    } catch (err) {
      console.error("Failed to generate certificate", err);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!certificateRef.current) return;
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `certificate-${candidateId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Failed to download certificate", err);
    }
  };

  const handleShareCertificateEmail = async () => {
    if (!data) return;
    setIsSharingEmail(true);
    try {
      await onboardingModuleService.shareCertificateEmail(candidateId, Number(data.module.id));
      alert("Certificate sent to your email successfully!");
    } catch (err) {
      console.error("Failed to share certificate", err);
      alert("Failed to send certificate email. Please try again.");
    } finally {
      setIsSharingEmail(false);
    }
  };

  const getAnswerValue = (questionId: number): string => {
    const answer = answers[questionId];
    if (!answer) return "";
    if ("selected" in answer) return answer.selected;
    return answer.text;
  };

  if (loading) {
    return (
      <Box className="module-detail-container" sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography sx={{ color: "#fff" }}>Loading module...</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box className="module-detail-container" sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "60vh", gap: 2 }}>
        <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700 }}>
          {error || "Module not found"}
        </Typography>
        <Button variant="contained" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  const isVideoAvailable = !!data.video_url;
  const isQuizLocked = !data.video_completed && !hasExistingAttempt && !videoCompleted;
  const allQuestionsAnswered = data.quiz_questions.every((q) => getAnswerValue(q.id).trim() !== "");
  const answeredCount = data.quiz_questions.filter((q) => getAnswerValue(q.id).trim() !== "").length;
  const answeredPercentage = data.quiz_questions.length > 0 ? Math.round((answeredCount / data.quiz_questions.length) * 100) : 0;
  const canSubmit = !isQuizLocked && !isQuizReadOnly && !isSubmitting && allQuestionsAnswered;
  const handleGoToNextModule = () => {
    if (nextModuleId) {
      navigate(`/app/module-detail/${nextModuleId}`);
    } else {
      navigate("/app/onboarding-candidate");
    }
  };

  return (
    <>
      <main className="module-detail-container">
      <Box className="module-detail-header">
        <Button className="module-detail-header__back" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button className="module-detail-header__dashboard" startIcon={<DashboardIcon />} onClick={() => navigate("/app/onboarding-candidate")}>
          All Modules
        </Button>
        <Box className="module-detail-header__title-block">
          <Typography component="h1" className="module-detail-header__title">
            {data.module.title}
          </Typography>
          <Typography className="module-detail-header__subtitle">
            Module {data.module.rank} &bull; Passing Criteria: {Math.round(data.module.passing_criteria)}%
          </Typography>
        </Box>
      </Box>

      <Box className="module-detail-body">
        <Box className="module-detail-grid">
          <Card className="module-detail-card module-detail-card--wide">
            <CardContent>
              <Typography component="h2" className="module-detail-card__title">
                Video
              </Typography>

              {isVideoAvailable ? (
                <video
                  ref={videoRef}
                  className="module-detail-video"
                  controls
                  controlsList="nodownload"
                  preload="metadata"
                  src={data.video_url!}
                >
                  <track kind="captions" src="" label="English" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <Box className="module-detail-video-missing">
                  <Typography>Video not available for this module.</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card className="module-detail-card">
            <CardContent>
              <Typography component="h2" className="module-detail-card__title">
                Key Concepts
              </Typography>

              {data.key_concepts.length > 0 ? (
                <Box className="module-detail-concepts-list">
                  {data.key_concepts.map((concept) => (
                    <Box key={concept.id} className="module-detail-concept-item">
                      <Typography component="h3" className="module-detail-concept__title">
                        {concept.title}
                      </Typography>
                      <Typography className="module-detail-concept__description">
                        {concept.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography className="module-detail-empty">No key concepts for this module.</Typography>
              )}
            </CardContent>
          </Card>

          <Card className={`module-detail-card module-detail-card--wide ${isQuizLocked ? "module-detail-card--locked" : ""}`}>
            <CardContent>
              <Box className="module-detail-quiz-header">
                <Typography component="h2" className="module-detail-card__title">
                  Quiz
                </Typography>
                {(submitted || hasExistingAttempt) && lastAttempt ? (
                  <Box className="module-detail-quiz-meta">
                    <Typography className="module-detail-quiz-score">
                      Score: {Math.round(lastAttempt.score ?? 0)}% &bull; {lastAttempt.passing_status}
                    </Typography>
                    <Typography className="module-detail-quiz-progress">
                      Attempt #{lastAttempt.attempt_number} &bull; {lastAttempt.responses?.length ?? 0} responses
                    </Typography>
                  </Box>
                ) : (
                  <Typography className="module-detail-quiz-progress">
                    {answeredCount} / {data.quiz_questions.length} answered
                  </Typography>
                )}
              </Box>

              {isQuizLocked && (
                <Box className="module-detail-quiz-lock">
                  <Typography>
                    Please complete the video to access the quiz.
                  </Typography>
                </Box>
              )}

              {quizResult && (
                <Card className="module-detail-result-card">
                  <CardContent>
                    <Box className="module-detail-result-header">
                      <Box className="module-detail-result-score">
                        <Typography className="module-detail-result-percentage">
                          {Math.round(quizResult.score)}%
                        </Typography>
                        <Chip
                          icon={quizResult.passing_status === "PASS" ? <CheckCircleIcon /> : <CancelIcon />}
                          label={quizResult.passing_status}
                          className={`module-detail-result-chip module-detail-result-chip--${quizResult.passing_status.toLowerCase()}`}
                        />
                      </Box>
                      <Typography className="module-detail-result-summary">
                        {quizResult.correct_answers} / {quizResult.total_questions} correct &bull; Passing: {Math.round(quizResult.passing_criteria)}%
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}

              <LinearProgress variant="determinate" value={isQuizLocked ? 0 : (quizResult ? Math.round(quizResult.score) : answeredPercentage)} className="module-detail-quiz-bar" />

              {data.quiz_questions.length > 0 ? (
                <Box className="module-detail-quiz-list">
                  {data.quiz_questions.map((question, index) => {
                    const answerValue = getAnswerValue(question.id);
                    const questionType = (question.question_type || "MCQ").toUpperCase();
                    const isRadio = questionType === "MCQ";
                    const displayChoices = question.choices && question.choices.length > 0
                      ? question.choices.map((choice, i) => ({ id: String(i + 1), text: choice }))
                      : [];

                    return (
                      <Box
                        key={question.id}
                        className={`module-detail-question ${isQuizReadOnly ? "module-detail-question--submitted" : ""} ${(() => {
                          const source = quizResult || lastAttempt;
                          const response = source?.responses.find(r => r.question_id === question.id);
                          return response?.is_correct === false ? "module-detail-question--incorrect" : "";
                        })()}`}
                      >
                        <Typography className="module-detail-question__header">
                          <span className="module-detail-question__number">Q{index + 1}</span>
                          {(quizResult || lastAttempt) && (
                            <Chip
                              size="small"
                              label={(() => {
                                const source = quizResult || lastAttempt;
                                const response = source?.responses.find(r => r.question_id === question.id);
                                const isCorrect = response?.is_correct;
                                if (isCorrect === true) return "Correct";
                                if (isCorrect === false) return "Incorrect";
                                return "";
                              })()}
                              className={`module-detail-result-badge module-detail-result-badge--${(() => {
                                const source = quizResult || lastAttempt;
                                const response = source?.responses.find(r => r.question_id === question.id);
                                return response?.is_correct === true ? "correct" : response?.is_correct === false ? "incorrect" : "";
                              })()}`}
                            />
                          )}
                        </Typography>

                        <Typography className="module-detail-question__text">{question.question_text}</Typography>

                        {isRadio ? (
                          <RadioGroup
                            value={answerValue}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value, questionType)}
                          >
                            {displayChoices.map((choice) => {
                              const isSelected = answerValue === choice.text;
                              const isCorrectChoice = question.correct_answer === choice.text;
                              const isWrongSelected = isQuizReadOnly && isSelected && !isCorrectChoice;
                              const showCorrectAnswer = isQuizReadOnly && isCorrectChoice;
                              return (
                                <FormControlLabel
                                  key={choice.id}
                                  value={choice.text}
                                  control={<Radio />}
                                  label={choice.text}
                                  className={`module-detail-radio ${isQuizReadOnly ? "module-detail-radio--submitted" : ""} ${isWrongSelected ? "module-detail-radio--wrong" : ""} ${showCorrectAnswer ? "module-detail-radio--correct" : ""}`}
                                  disabled={isQuizLocked || isQuizReadOnly}
                                />
                              );
                            })}
                          </RadioGroup>
                        ) : (
                          <TextField
                            multiline
                            minRows={3}
                            fullWidth
                            placeholder="Type your answer here..."
                            value={answerValue}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value, questionType)}
                            className={`module-detail-textarea ${isQuizReadOnly ? "module-detail-textarea--submitted" : ""}`}
                            disabled={isQuizLocked || isQuizReadOnly}
                          />
                        )}

                        {isQuizReadOnly && (() => {
                          const response = quizResult?.responses.find(r => r.question_id === question.id);
                          const isCorrect = response?.is_correct;
                          const correctAnswer = response?.correct_answer;
                          if (isCorrect === false && questionType !== "MCQ" && questionType !== "SCENARIO") {
                            return (
                              <Box className="module-detail-correct-answer">
                                <Typography variant="caption" className="module-detail-correct-answer__label">Correct answer:</Typography>
                                <Typography variant="body2" className="module-detail-correct-answer__text">{correctAnswer}</Typography>
                              </Box>
                            );
                          }
                          return null;
                        })()}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography className="module-detail-empty">No quiz questions for this module.</Typography>
              )}

              <Box className="module-detail-quiz-footer">
                <Box className="module-detail-quiz-footer__actions">
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    startIcon={<SendIcon />}
                    className="module-detail-submit-btn"
                  >
                    {isQuizReadOnly
                      ? "Submitted"
                      : quizResult?.passing_status === "FAIL"
                        ? "Retry Quiz"
                        : hasExistingAttempt && lastAttempt?.passing_status === "FAIL"
                          ? "Retry Quiz"
                          : isSubmitting
                            ? "Submitting..."
                            : "Answer All Questions"}
                  </Button>

                  {hasPassedQuiz && nextModuleId && (
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={handleGoToNextModule}
                      endIcon={<ArrowForwardIcon />}
                      className="module-detail-next-btn"
                    >
                      Next Module
                    </Button>
                  )}
                </Box>

                {quizResult && (
                  <Box className="module-detail-quiz-result-summary">
                    <Typography className="module-detail-quiz-result-score">
                      Score: {Math.round(quizResult.score)}%
                    </Typography>
                    <Chip
                      icon={quizResult.passing_status === "PASS" ? <CheckCircleIcon /> : <CancelIcon />}
                      label={quizResult.passing_status}
                      className={`module-detail-result-chip module-detail-result-chip--${quizResult.passing_status.toLowerCase()}`}
                    />
                  </Box>
                )}

                {hasExistingAttempt && !quizResult && lastAttempt && (
                  <Box className="module-detail-quiz-result-summary">
                    <Typography className="module-detail-quiz-result-score">
                      Score: {Math.round(lastAttempt.score ?? 0)}%
                    </Typography>
                    <Chip
                      icon={lastAttempt.passing_status === "PASS" ? <CheckCircleIcon /> : <CancelIcon />}
                      label={lastAttempt.passing_status}
                      className={`module-detail-result-chip module-detail-result-chip--${lastAttempt.passing_status.toLowerCase()}`}
                    />
                  </Box>
                )}

                {quizResult?.passing_status === "PASS" && (
                  <Typography className="module-detail-quiz-success">
                    Your answers have been submitted successfully.
                  </Typography>
                )}
                {quizResult?.passing_status === "FAIL" && (
                  <Typography className="module-detail-quiz-fail">
                    You did not pass this time. Review the material and try again.
                  </Typography>
                )}
                {hasExistingAttempt && !quizResult && lastAttempt?.passing_status === "FAIL" && (
                  <Typography className="module-detail-quiz-fail">
                    Previous attempt: {Math.round(lastAttempt.score ?? 0)}% (FAIL). Please try again.
                  </Typography>
                )}
                {hasExistingAttempt && !quizResult && lastAttempt?.passing_status === "PASS" && (
                  <Typography className="module-detail-quiz-success">
                    You already submitted this quiz on {new Date(lastAttempt.attempted_date).toLocaleString()}.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </main>
    <Dialog open={showCongratsDialog} onClose={() => setShowCongratsDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: "center", fontSize: "1.8rem", fontWeight: 700 }}>
      </DialogTitle>
      <DialogContent>
        {certificateData && (
          <Box ref={certificateRef} sx={{ background: "#fff", p: 3, borderRadius: 2 }}>
            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: "#1976d2" }}>
                Certificate of Completion
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                This is to certify that
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
                {certificateData.candidate_name}
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                has successfully completed all onboarding modules and is hereby awarded the{" "}
                <strong>Engagement Clearance Certificate</strong>.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "center", gap: 4, mb: 3 }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {certificateData.modules.length}
                </Typography>
                <Typography variant="body2">Modules</Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {certificateData.modules.filter((m) => m.passing_status === "PASS").length}
                </Typography>
                <Typography variant="body2">Passed</Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {(() => {
                    const scoredModules = certificateData.modules.filter((m) => m.score !== null && m.score !== undefined);
                    const avg = scoredModules.length > 0 ? scoredModules.reduce((sum, m) => sum + (m.score || 0), 0) / scoredModules.length : 0;
                    return Math.round(avg) || 0;
                  })()}%
                </Typography>
                <Typography variant="body2">Avg Score</Typography>
              </Box>
            </Box>

            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Module</TableCell>
                    <TableCell align="center">Score</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {certificateData.modules.map((module) => (
                    <TableRow key={module.module_id}>
                      <TableCell>
                        <Typography fontWeight={700}>
                          {module.rank}. {module.title}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700}>
                          {module.score !== null && module.score !== undefined
                            ? `${Math.round(module.score)}%`
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={module.passing_status || module.status}
                          color={module.passing_status === "PASS" ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Certificate ID: CERT-{(certificateData.candidate_name || "XXX").slice(0, 3).toUpperCase()}-{candidateId}
              </Typography>
              <br />
              <Typography variant="caption" color="text.secondary">
                Completed Date:{" "}
                {certificateData.completed_date
                  ? new Date(certificateData.completed_date).toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 3 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCertificate}
          className="certificate-action-btn"
        >
          Download PNG
        </Button>
        <Button
          variant="contained"
          startIcon={<EmailIcon />}
          onClick={handleShareCertificateEmail}
          disabled={isSharingEmail}
          className="certificate-action-btn"
        >
          {isSharingEmail ? "Sending..." : "Share via Email"}
        </Button>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={() => {
            setShowCongratsDialog(false);
            navigate("/app/onboarding-candidate");
          }}
          className="certificate-action-btn"
        >
          Go to Dashboard
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default ModuleDetailContainer;
