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
  Checkbox,
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
  Alert,
  IconButton,
  Tooltip
} from "@mui/material";
import { AxiosError } from "axios";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import LinkIcon from "@mui/icons-material/Link";
import EmailIcon from "@mui/icons-material/Email";
import SendIcon from "@mui/icons-material/Send";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Close";
import DashboardIcon from "@mui/icons-material/Dashboard";
// EmailIcon is no longer needed since we use SMTP auto-email instead of mailto
// import EmailIcon from "@mui/icons-material/Email";
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
  const [isLocked, setIsLocked] = useState(false);

  type AnswerValue = { selected: string } | { text: string };
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [nextModuleId, setNextModuleId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoWrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastVideoUpdateRef = useRef<number>(0);
  const lastPlaybackTimeRef = useRef<number>(0);
  const previousModuleIdRef = useRef(moduleId);
  const isVideoReady = !!data?.video_url;
  const isVideoAvailable = !!data?.video_url;
  const isDirectMedia = !!data?.video_url?.match(/\.(mp4|webm|ogg|ogv|mov|m4v|m3u8)(\?|#|$)/i);
  const [showCongratsDialog, setShowCongratsDialog] = useState(false);
  const [certificateData, setCertificateData] = useState<CertificateDataResponse | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [activeStep, setActiveStep] = useState<"video" | "quiz">("video");
  const prevVideoCompletedRef = useRef(videoCompleted);
  const prevConsentAcceptedRef = useRef(consentAccepted);
  /* Email is sent automatically via SMTP when all modules are completed, so these are no longer needed
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  */

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      if (video.ended) {
        video.currentTime = 0;
      }
      setIsPlaying(true);
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleTheaterMode = () => {
    setTheaterMode((prev) => !prev);
  };

  const toggleFullscreen = () => {
    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    setQuizResult(null);
    setSubmitted(false);
    setAnswers({});
    setIsSubmitting(false);
    setNextModuleId(null);
    setVideoCompleted(false);
    setIsLocked(false);
    setConsentAccepted(false);
    setActiveStep("video");
    prevVideoCompletedRef.current = false;
    prevConsentAcceptedRef.current = false;
  }, [moduleId]);

  useEffect(() => {
    if (!isVideoReady || !videoRef.current) return;

    const video = videoRef.current;

    const handleTimeUpdate = async () => {
      if (!data?.module?.id) return;
      const current = Math.floor(video.currentTime || 0);
      const total = Math.floor(video.duration || 0);
      if (total <= 0) return;

      lastPlaybackTimeRef.current = current;
      setCurrentTime(current);

      const now = Date.now();
      if (now - lastVideoUpdateRef.current < 2000) {
        return;
      }

      const percentage = Math.round((current / total) * 100);

      try {
        await onboardingModuleService.updateVideoProgress(candidateId, Number(moduleId), {
          current_duration_seconds: current,
          total_duration_seconds: total,
          completion_percentage: percentage,
          is_completed: false,
        });
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

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setCurrentTime(video.currentTime || 0);
      setMuted(video.muted);
    };
    const handleVolumeChange = () => setMuted(video.muted);

    const handleSeeking = () => {
      const current = video.currentTime || 0;
      const last = lastPlaybackTimeRef.current;
      if (current > last + 3) {
        video.currentTime = last;
      }
    };

    const handleEnded = async () => {
      setIsPlaying(false);
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
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("volumechange", handleVolumeChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [isVideoReady, data?.module?.id, moduleId, activeStep]);

  useEffect(() => {
    if (!videoCompleted || activeStep !== "video") return;
    if (data?.module?.rank !== 1 && !prevVideoCompletedRef.current) {
      setActiveStep("quiz");
    }
    prevVideoCompletedRef.current = videoCompleted;
  }, [videoCompleted, activeStep, data?.module?.rank]);

  useEffect(() => {
    if (!consentAccepted || activeStep !== "video") return;
    if (data?.module?.rank === 1 && !prevConsentAcceptedRef.current) {
      setActiveStep("quiz");
    }
    prevConsentAcceptedRef.current = consentAccepted;
  }, [consentAccepted, activeStep, data?.module?.rank]);

  const hasExistingAttempt = !!data?.quiz_attempts?.length;
  const lastAttempt = hasExistingAttempt ? data.quiz_attempts[0] : null;
  const hasPassedQuiz = (quizResult?.passing_status === "PASS") ||
                        (hasExistingAttempt && lastAttempt?.passing_status === "PASS");
  const isQuizReadOnly = (quizResult?.passing_status === "PASS") ||
                         (hasExistingAttempt && lastAttempt?.passing_status === "PASS");
  const isRetryMode =
    quizResult?.passing_status === "FAIL" ||
    (hasExistingAttempt && lastAttempt?.passing_status === "FAIL");
  const needsConsent = data?.module?.rank === 1 && !consentAccepted && !hasExistingAttempt;
  const isQuizLocked = (!data?.video_completed && !hasExistingAttempt && !videoCompleted) || needsConsent;
  const canAccessQuiz = data?.video_completed || videoCompleted || hasExistingAttempt;

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
  }, [isVideoReady, data?.video_completed, videoCompleted, activeStep]);

  useEffect(() => {
    const fetchData = async () => {
      if (!moduleId) return;
      setLoading(true);
      try {
        const [result, summary] = await Promise.all([
          onboardingModuleService.getModuleDetail(candidateId, Number(moduleId)),
          onboardingModuleService.getEmployeeProgressSummary(candidateId),
        ]);
        setData(result);

        const moduleSummary = summary.modules.find(
          (m) => m.module_id === Number(moduleId)
        );
        if (moduleSummary && !moduleSummary.is_unlocked) {
          setIsLocked(true);
          navigate("/app/onboarding-candidate");
          return;
        }
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
    if (previousModuleIdRef.current !== moduleId && !loading && data) {
      previousModuleIdRef.current = moduleId;
      const scrollToTarget = () => {
        if (activeStep === "video") {
          const el = videoWrapperRef.current;
          if (!el) return;
          // Scroll the surrounding card into view so the video sits at the card level
          const card = el.closest(".module-detail-card") as HTMLElement | null;
          if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "start" });
            window.scrollBy({ top: 10, left: 0, behavior: "smooth" });
          } else {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            window.scrollBy({ top: 10, left: 0, behavior: "smooth" });
          }
        } else {
          const target = containerRef.current;
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(scrollToTarget));
    }
  }, [moduleId, loading, data, activeStep]);

  useLayoutEffect(() => {
    if (!loading && data && activeStep === "video") {
      const raf = requestAnimationFrame(() => {
        const el = videoWrapperRef.current;
        if (!el) return;
        const card = el.closest(".module-detail-card") as HTMLElement | null;
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "start" });
          window.scrollBy({ top: 10, left: 0, behavior: "smooth" });
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          window.scrollBy({ top: 10, left: 0, behavior: "smooth" });
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [loading, data, activeStep]);

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

  const handleRetry = async () => {
    if (!data || isRetrying) return;

    setIsRetrying(true);
    setError(null);
    try {
      const currentIds = data.quiz_questions.map((q) => q.id);
      const questions = await onboardingModuleService.getRetryQuiz(
        candidateId,
        Number(data.module.id),
        currentIds
      );

      // Replace questions with a reshuffled set (new variants, new rank),
      // drop the prior attempt locally so previous selections / correct-incorrect
      // tags are cleared and the quiz becomes editable again.
      setData((prev) =>
        prev ? { ...prev, quiz_questions: questions, quiz_attempts: [] } : prev
      );
      setAnswers({});
      setQuizResult(null);
      setSubmitted(false);
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail || "Failed to load retry quiz");
      } else {
        setError("Failed to load retry quiz");
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGenerateAndShowCertificate = async () => {
    if (!data) return;
    try {
      await onboardingModuleService.generateCertificate(candidateId, Number(data.module.id));
      const certData = await onboardingModuleService.getCertificate(candidateId, Number(data.module.id));
      setCertificateData(certData);
      setShowCongratsDialog(true);
      setEmailSent(false);
    } catch (err) {
      console.error("Failed to generate certificate", err);
    }
  };

  /* Email is sent automatically via SMTP when all modules are completed, so this function is no longer needed
  const handleSendEmail = async () => {
    if (!data || isSendingEmail) return;
    setIsSendingEmail(true);
    setEmailSent(false);
    try {
      const result = await onboardingModuleService.shareCertificateEmail(candidateId, Number(data.module.id));
      if (result?.mailto_url) {
        window.location.href = result.mailto_url;
      }
      setEmailSent(true);
    } catch (err) {
      console.error("Failed to prepare email", err);
    } finally {
      setIsSendingEmail(false);
    }
  };
  */

  const handleGoToNextModule = () => {
    if (nextModuleId) {
      navigate(`/app/module-detail/${nextModuleId}`);
    } else {
      navigate("/app/onboarding-candidate");
    }
  };

  if (!data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography>Loading module...</Typography>
      </Box>
    );
  }

  const getAnswerValue = (questionId: number): string => {
    const value = answers[questionId];
    if (!value) return "";
    return "selected" in value ? value.selected : value.text;
  };

  const allQuestionsAnswered = data.quiz_questions.every((q) => getAnswerValue(q.id).trim() !== "");
  const answeredCount = data.quiz_questions.filter((q) => getAnswerValue(q.id).trim() !== "").length;
  const answeredPercentage = data.quiz_questions.length > 0
    ? Math.round((answeredCount / data.quiz_questions.length) * 100)
    : 0;
  const canSubmit = !isQuizLocked && !isQuizReadOnly && !isSubmitting && allQuestionsAnswered;

  return (
    <>
      <main className="module-detail-container" ref={containerRef}>
      <Box className="module-detail-header">
        {error && (
         <Alert severity="error" sx={{ mb: 2 }}>
           {error}
         </Alert>
        )}
        <Box className="module-detail-header__top">
        <Box className="module-detail-header__actions">
          <Button className="module-detail-header__back" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button className="module-detail-header__dashboard" startIcon={<DashboardIcon />} onClick={() => navigate("/app/onboarding-candidate")}>
            All Modules
          </Button>
        </Box>
        </Box>
      </Box>

      <Box className="module-detail-body">
        <Box className={`module-detail-grid ${theaterMode ? "module-detail-grid--theater" : ""}`}>
          <Card className="module-detail-card module-detail-card--wide">
            <CardContent>
              <Box className="module-detail-step-nav">
                <Button
                  variant="text"
                  onClick={() => setActiveStep("video")}
                  disabled={activeStep === "video"}
                  startIcon={<ArrowBackIcon />}
                  className="module-detail-step-nav__btn"
                >
                  Video
                </Button>
                <Box className="module-detail-step-nav__title" sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', justifyContent: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#5568f2,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.95rem' }} aria-hidden>
                      {data.module.rank}
                    </Box>
                  </Box>

                  <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={data.module.title}>
                      {data.module.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center' }}>
                      {data.module.description || ''}
                    </Typography>
                  </Box>

                  <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`Passing ${Math.round(data.module.passing_criteria)}%`}
                      color={data.module.passing_criteria >= 80 ? 'success' : data.module.passing_criteria >= 60 ? 'warning' : 'default'}
                      size="small"
                      sx={{ fontWeight: 700 }}
                      title={`Minimum passing score: ${Math.round(data.module.passing_criteria)}%`}
                    />
                  </Box>
                </Box>
                <Button
                  variant="text"
                  onClick={() => setActiveStep("quiz")}
                  disabled={activeStep === "quiz" || !canAccessQuiz || (data?.module?.rank === 1 && !consentAccepted)}
                  endIcon={<ArrowForwardIcon />}
                  className="module-detail-step-nav__btn"
                >
                  Quiz
                </Button>
              </Box>

              {activeStep === "video" && (
                <Box className="module-detail-content-panel">
                  {data?.module?.rank === 1 && (data?.video_completed || videoCompleted) && !consentAccepted ? (
                    <Box className="module-detail-consent">
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={consentAccepted}
                            onChange={(e) => setConsentAccepted(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={
                          <Typography variant="body2">
                            I have gone through the account structure knowing my PCEO, PMO, Tech Enablement team whom I can reach out in case I face challenges and need support from Nagarro
                          </Typography>
                        }
                      />
                    </Box>
                  ) : (
                    <>
                      {isVideoAvailable ? (
                         isDirectMedia ? (
                             <Box ref={videoWrapperRef} className={`module-detail-video-wrapper ${theaterMode ? "module-detail-video-wrapper--theater" : ""}`} onContextMenu={(e) => e.preventDefault()}>
                              <video
                               ref={videoRef}
                               className="module-detail-video"
                               controlsList="nodownload"
                               preload="metadata"
                               src={data.video_url}
                               onClick={togglePlayPause}
                               onKeyDown={(e) => {
                                 if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
                                   e.preventDefault();
                                 }
                               }}
                               tabIndex={-1}
                             >
                               <track kind="captions" src="" label="English" />
                               Your browser does not support the video tag.
                              </video>

                              {!isPlaying && (
                                <Box className="module-detail-video-overlay" onClick={togglePlayPause}>
                                  <PlayArrowIcon />
                                </Box>
                              )}

                            <Box className="module-detail-video-controls">
                                 <Box className="module-detail-video-progress">
                                   <Box className="module-detail-video-progress__bar" style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }} />
                                 </Box>
                                 <Box className="module-detail-video-controls__row">
                                   <IconButton onClick={togglePlayPause} className="module-detail-video-controls__btn">
                                     {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                                   </IconButton>
                                   <IconButton onClick={toggleMute} className="module-detail-video-controls__btn">
                                     {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                                   </IconButton>
                                   <IconButton onClick={toggleTheaterMode} className="module-detail-video-controls__btn" title={theaterMode ? "Exit theater mode" : "Theater mode"}>
                                  <CenterFocusStrongIcon />
                                </IconButton>
                                <IconButton onClick={toggleFullscreen} className="module-detail-video-controls__btn" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
                                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                </IconButton>
                                <Typography className="module-detail-video-time">
                                  {formatTime(currentTime)} / {formatTime(duration)}
                                </Typography>
                              </Box>
                            </Box>
                        </Box>
                        ) : (
                          <iframe
                            src={data.video_url}
                            className="module-detail-video module-detail-video--iframe"
                            allow="autoplay; fullscreen"
                            allowFullScreen
                            title="Module video"
                          />
                        )
                      ) : (
                        <Box className="module-detail-video-missing">
                          <Typography>Video not available for this module.</Typography>
                        </Box>
                   )}
                    </>
                  )}
               </Box>
            )}

                 {activeStep === "quiz" && (
                <Box className="module-detail-content-panel">
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
                             <Box className="module-detail-question__header">
                               <span className="module-detail-question__number">Q{index + 1}</span>
                               <span className="module-detail-question__text">{question.question_text}</span>
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
                             </Box>

                            {isRadio ? (
                              <RadioGroup
                                className="module-detail-quiz-options"
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
                        onClick={isRetryMode ? handleRetry : handleSubmit}
                        disabled={isRetryMode ? isRetrying : !canSubmit}
                        startIcon={<SendIcon />}
                        className="module-detail-submit-btn"
                      >
                        {isRetrying
                          ? "Preparing..."
                          : isQuizReadOnly
                            ? "Submitted"
                            : isRetryMode
                              ? "Retry Quiz"
                              : isSubmitting
                                ? "Submitting..."
                                : "Submit Quiz"}
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
                </Box>
              )}
            </CardContent>
           </Card>

            <Box className="module-detail-key-concepts-cell">
              {(() => {
                const conceptsWithLinks = data.key_concepts.filter((concept) => concept.link_url && concept.link_url.trim() !== "" && !concept.link_url.includes("url-to-be-added"));
                if (conceptsWithLinks.length === 0) return null;
                return (
                  <Card className="module-detail-card">
                   <CardContent>
                     <Typography component="h2" className="module-detail-card__title">
                        Key Links
                     </Typography>

                   {conceptsWithLinks.length > 0 ? (
                     <Box className="module-detail-concepts-list">
                         {conceptsWithLinks.map((concept) => (
                          <Tooltip key={concept.id} title={<Box sx={{ maxWidth: 260, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>{concept.description || ""}</Box>} placement="top" arrow>
                             <Box className="module-detail-concept-item">
                               {concept.link_url.includes("@") && !concept.link_url.startsWith("http") ? (
                                 <>
                                   <Typography component="h3" className="module-detail-concept__title">
                                     {concept.title}
                                   </Typography>
                                   <a
                                     href={`mailto:${concept.link_url}`}
                                     className="module-detail-concept-link"
                                   >
                                     <EmailIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                                     <Typography component="span" className="module-detail-concept__email">
                                       {concept.link_url}
                                     </Typography>
                                   </a>
                                 </>
                               ) : (
                                 <a
                                   href={concept.link_url}
                                   target={concept.link_url.startsWith("http") ? "_blank" : undefined}
                                   rel={concept.link_url.startsWith("http") ? "noopener noreferrer" : undefined}
                                   className="module-detail-concept-link"
                                 >
                                   <LinkIcon sx={{ fontSize: 16, marginRight: 0.5 }} />
                                   <Typography component="span" className="module-detail-concept__title">
                                     {concept.title}
                                   </Typography>
                                 </a>
                               )}
                             </Box>
                          </Tooltip>
                         ))}
                     </Box>
                   ) : (
                     <Typography className="module-detail-empty">No key concepts for this module.</Typography>
                   )}
                 </CardContent>
                </Card>
                );
              })()}
            </Box>
        </Box>
      </Box>
    </main>
    <Dialog open={showCongratsDialog} onClose={() => setShowCongratsDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: "center", fontSize: "1.4rem", fontWeight: 700 }}>
        Onboarding Completion Summary
      </DialogTitle>
      <DialogContent>
        {certificateData && (
          <Box sx={{ background: "#fff", p: 2, borderRadius: 2 }}>
            <TableContainer component={Paper} sx={{ mb: 2 }}>
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
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 3 }}>
        {/* Email is sent automatically via SMTP when all modules are completed, so this button is no longer needed */}
        {/*
        <Button
          variant="contained"
          startIcon={<EmailIcon />}
          onClick={handleSendEmail}
          disabled={isSendingEmail || emailSent}
          className="certificate-action-btn"
        >
          {isSendingEmail ? "Sending..." : emailSent ? "Email Sent" : "Send via Email"}
        </Button>
        */}
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={() => {
            setShowCongratsDialog(false);
            navigate("/app/onboarding-candidate");
          }}
          className="certificate-action-btn"
          sx={{
            background: '#47d7ac',
            color: '#000',
            textTransform: 'none',
            fontWeight: 800,
            borderRadius: '8px',
            padding: '0.75rem 2rem',
            boxShadow: '0 8px 18px rgba(71, 215, 172, 0.24)',
            '&:hover': {
              background: '#3bc49f',
            },
          }}
        >
          Go to Dashboard
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default ModuleDetailContainer;
