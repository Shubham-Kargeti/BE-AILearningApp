import { useState, useEffect, useRef } from "react";
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
} from "@mui/material";
import { AxiosError } from "axios";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Close";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import type { ModuleDetailResponse, QuizSubmitResponse } from "../../API/onboarding_module.model";
import "./ModuleDetailContainer.scss";

const PRIMARY_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

const ModuleDetailContainer = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ModuleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type AnswerValue = { selected: string } | { text: string };
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const lastVideoUpdateRef = useRef<number>(0);
  const isVideoReady = !!data?.video_url;

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
        const updated = await onboardingModuleService.updateVideoProgress(1, Number(moduleId), {
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
        const updated = await onboardingModuleService.updateVideoProgress(1, Number(moduleId), {
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
        const result = await onboardingModuleService.getModuleDetail(1, Number(moduleId));
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

  const handleAnswerChange = (questionId: number, value: string, type: string) => {
    if (type === "MCQ" || type === "SCENARIO") {
      setAnswers((prev) => ({ ...prev, [questionId]: { selected: value } }));
    } else {
      setAnswers((prev) => ({ ...prev, [questionId]: { text: value } }));
    }
  };

  const handleSubmit = async () => {
    if (!data || isSubmitting || submitted) return;

    const answersPayload = Object.entries(answers)
      .filter(([, value]) => value && ("selected" in value ? value.selected.trim() !== "" : value.text.trim() !== ""))
      .map(([questionId, value]) => ({
        question_id: Number(questionId),
        answer: "selected" in value ? value.selected : value.text,
      }));

    if (!answersPayload.length) return;

    setIsSubmitting(true);
    try {
      const result = await onboardingModuleService.submitModuleQuiz(1, Number(data.module.id), answersPayload);
      setQuizResult(result);
      setSubmitted(true);
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

  const getAnswerValue = (questionId: number): string => {
    const answer = answers[questionId];
    if (!answer) return "";
    if ("selected" in answer) return answer.selected;
    return answer.text;
  };

  const getQuestionTypeLabel = (type: string): string => {
    const normalized = type.toUpperCase();
    if (normalized === "MCQ") return "Multiple Choice";
    if (normalized === "SCENARIO") return "Scenario";
    return "Text Answer";
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

  return (
    <main className="module-detail-container">
      <Box className="module-detail-header">
        <Button className="module-detail-header__back" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
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
                      Score: {Math.round(lastAttempt.score ?? 0)}% • {lastAttempt.passing_status}
                    </Typography>
                    <Typography className="module-detail-quiz-progress">
                      Attempt #{lastAttempt.attempt_number} • {lastAttempt.responses?.length ?? 0} responses
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
                        {quizResult.correct_answers} / {quizResult.total_questions} correct • Passing: {Math.round(quizResult.passing_criteria)}%
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
                    const isRadio = questionType === "MCQ" || questionType === "SCENARIO";
                    const displayChoices = question.choices && question.choices.length > 0
                      ? question.choices.map((choice, i) => ({ id: String(i + 1), text: choice }))
                      : [];

                    return (
                      <Box key={question.id} className={`module-detail-question ${submitted ? "module-detail-question--submitted" : ""}`}>
                        <Typography className="module-detail-question__header">
                          <span className="module-detail-question__number">Q{index + 1}</span>
                          <span className="module-detail-question__badge">{getQuestionTypeLabel(questionType)}</span>
                          {isQuizReadOnly && (
                            <Chip
                              size="small"
                              label={(() => {
                                const response = quizResult?.responses.find(r => r.question_id === question.id);
                                const isCorrect = response?.is_correct;
                                if (isCorrect === true) return "Correct";
                                if (isCorrect === false) return "Incorrect";
                                return "";
                              })()}
                              className={`module-detail-result-badge module-detail-result-badge--${(() => {
                                const response = quizResult?.responses.find(r => r.question_id === question.id);
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
                          const userAnswer = response?.employee_answer;
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
  );
};

export default ModuleDetailContainer;
