import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Divider,
  TextField,
  Stack,
} from "@mui/material";
import {
  Assignment as AssignmentIcon,
  Timer as TimerIcon,
  QuestionAnswer as QuestionIcon,
  Email as EmailIcon,
  PlayArrow as StartIcon,
} from "@mui/icons-material";
import { assessmentService, authService } from "../../API/services";
import type { Assessment } from "../../API/services";
import "./CandidateAssessmentContainer.scss";

interface AssessmentDetails extends Assessment {
  skill_list?: string[];
}

const CandidateAssessmentContainer: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentDetails | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [step, setStep] = useState<"loading" | "details" | "email" | "screening" | "ready" | "expired" | "unavailable">("loading");
  const [requiresLogin, setRequiresLogin] = useState(false);

  // Screening is handled at the end of the quiz in `QuizContainer` now —
  // candidate landing flow doesn't ask screening questions at the start.

  // For email-less flow, we generate a temporary candidate ID
  const [candidateSessionId] = useState(() => `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (assessmentId) {
      fetchAssessmentDetails();
    }
  }, [assessmentId]);

  const fetchAssessmentDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await assessmentService.getById(assessmentId!);
      
      if (response) {
        if (response.is_expired) {
          setAssessment(response);
          setStep("expired");
          setError("This assessment has expired and is no longer accepting submissions.");
        } else {
          setAssessment(response);
          const candidateEmail = response?.candidate_info?.email;
          const localEmail = localStorage.getItem("userEmail");
          // If the assessment has a candidate email and the local user doesn't match, show login banner
          setRequiresLogin(!!(candidateEmail && localEmail !== candidateEmail));
          // Initialize screening answers from description JSON if present
          // Screening questions (if present in `description`) are now shown at the
          // end of the assessment by `QuizContainer` rather than before starting.
          setStep("details");
        }
      } else {
        setError("Assessment not found or has expired.");
      }
    } catch (err: any) {

      const backendDetail = err?.response?.data?.detail || "";
      
      if (backendDetail.includes("not available yet")) {
        setStep("unavailable");
        setError("This assessment is not available yet. Please contact the administrator.");
      } else if (backendDetail.includes("no longer active")) {
        setStep("unavailable");
        setError("This assessment is no longer active.");
      } else if (err?.response?.status === 404 || backendDetail.includes("not found")) {
        setError("This assessment link is invalid or does not exist.");
      } else {
        const errorMessage = err instanceof Error ? err.message : "Failed to load assessment details.";
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setEmailError("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setEmailError("");
    setIsStarting(true);

    try {
      // Login/register the candidate with email
      const loginResponse = await authService.login(email);
      
      if (loginResponse?.access_token) {
        localStorage.setItem("authToken", loginResponse.access_token);
        localStorage.setItem("userEmail", email);
        setStep("ready");
      } else {
        setEmailError("Failed to verify email. Please try again.");
      }
    } catch (err) {

      setEmailError("Failed to verify email. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartAssessment = async () => {
    // Store assessment data in localStorage for the quiz page (email-less flow)
    if (assessment) {
      localStorage.setItem("currentAssessment", JSON.stringify({
        assessmentId: assessmentId,
        required_skills: assessment.required_skills,
        duration_minutes: assessment.duration_minutes,
        title: assessment.title,
        candidateSessionId: candidateSessionId,
      }));
      // Store candidate session for tracking
      localStorage.setItem("candidateSessionId", candidateSessionId);
    }

    // Auto-login candidate if assessment has candidate email
    try {
      if (assessment?.candidate_info && assessment.candidate_info.email) {
        const candidateEmail = assessment.candidate_info.email;
        const loginResponse = await authService.login(candidateEmail);
        if (loginResponse?.access_token) {
          localStorage.setItem("authToken", loginResponse.access_token);
          localStorage.setItem("userEmail", candidateEmail);
        }
      }
    } catch (err) {
      // If auto-login failed, log it but still continue to navigation; user can provide email manually

    }

    navigate(`/candidate-quiz`, {
      state: {
        assessmentId: assessmentId,
        assessment: assessment,
        fromCandidateLink: true,
        candidateSessionId: candidateSessionId,
      },
    });
  };

  // Email step is optional and triggered via UI when needed

  if (loading || step === "loading") {
    return (
      <Box className="candidate-assessment candidate-assessment--loading">
        <CircularProgress size={48} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading assessment...
        </Typography>
      </Box>
    );
  }

  if (step === "expired") {
    return (
      <Box className="candidate-assessment candidate-assessment--expired">
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
            <TimerIcon sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
            <Typography variant="h5" gutterBottom color="error">
              Assessment Expired
            </Typography>
            <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
              This assessment expired on{" "}
              <strong>
                {assessment?.expires_at 
                  ? new Date(assessment.expires_at).toLocaleString() 
                  : "a previous date"}
              </strong>
              . Please contact the administrator if you need access.
            </Alert>
            <Button
              variant="contained"
              sx={{ mt: 3 }}
              onClick={() => navigate("/")}
            >
              Go to Home
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (step === "unavailable") {
    return (
      <Box className="candidate-assessment candidate-assessment--unavailable">
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
            <AssignmentIcon sx={{ fontSize: 64, color: "warning.main", mb: 2 }} />
            <Typography variant="h5" gutterBottom color="textPrimary">
              Assessment Not Yet Available
            </Typography>
            <Alert severity="warning" sx={{ mt: 2 }}>
              {error || "This assessment is still being prepared and is not available for candidates yet. Please check back later or contact the administrator."}
            </Alert>
            <Button
              variant="contained"
              sx={{ mt: 3 }}
              onClick={() => navigate("/")}
            >
              Go to Home
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="candidate-assessment candidate-assessment--error">
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 4, textAlign: "center" }}>
            <AssignmentIcon sx={{ fontSize: 64, color: "error.main", mb: 2 }} />
            <Typography variant="h5" gutterBottom color="error">
              Assessment Not Available
            </Typography>
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
            <Button
              variant="contained"
              sx={{ mt: 3 }}
              onClick={() => navigate("/")}
            >
              Go to Home
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="candidate-assessment">
      <Container maxWidth="md">
        <Paper elevation={3} className="candidate-assessment__paper">
          {/* Header */}
          <Box className="candidate-assessment__header">
            <AssignmentIcon sx={{ fontSize: 48, color: "primary.main" }} />
            <Typography variant="h4" component="h1" gutterBottom>
              {assessment?.title || "Skills Assessment"}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You've been invited to complete this assessment
            </Typography>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Assessment Details Step */}
          {step === "details" && (
            <Box className="candidate-assessment__details">
              {requiresLogin && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    This assessment is intended for <strong>{assessment?.candidate_info?.email}</strong>.
                  </Typography>
                  <Typography variant="body2">
                    Please login as the candidate (click "Continue") to ensure your results are attributed correctly.
                  </Typography>
                </Alert>
              )}
              <Typography variant="h6" gutterBottom>
                Assessment Details
              </Typography>

              <Stack spacing={2} sx={{ mt: 2 }}>
                {/* Info Cards */}
                <Card variant="outlined">
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <QuestionIcon color="primary" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Number of Questions
                      </Typography>
                      <Typography variant="h6">
                        {(assessment as any)?.question_count || 20} Questions
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <TimerIcon color="primary" />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Time Limit
                      </Typography>
                      <Typography variant="h6">
                        {assessment?.duration_minutes || 30} Minutes
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {assessment?.expires_at && (
                  <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <TimerIcon color="warning" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Deadline
                        </Typography>
                        <Typography variant="h6" color="warning.dark">
                          {new Date(assessment.expires_at).toLocaleString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* Skills */}
                {assessment?.skill_list && assessment.skill_list.length > 0 && (
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Skills Being Assessed
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                        {assessment.skill_list.map((skill, index) => (
                          <Chip
                            key={index}
                            label={skill}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Stack>

              {/* Instructions */}
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Instructions:</strong>
                </Typography>
                <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                  <li>Make sure you have a stable internet connection</li>
                  <li>Once started, the timer cannot be paused</li>
                  <li>Answer all questions to the best of your ability</li>
                  <li>Your progress is saved automatically</li>
                </ul>
              </Alert>

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={() => setStep("ready")}
                >
                  Continue
                </Button>
                {requiresLogin && (
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{ minWidth: 160 }}
                    onClick={async () => {
                      // Attempt to auto-login candidate
                      try {
                        if (assessment?.candidate_info?.email) {
                          const loginResponse = await authService.login(assessment.candidate_info.email);
                          if (loginResponse?.access_token) {
                            localStorage.setItem("authToken", loginResponse.access_token);
                            localStorage.setItem("userEmail", assessment.candidate_info.email);
                            setRequiresLogin(false);
                            setStep("ready");
                          }
                        }
                      } catch (err) {

                      }
                    }}
                  >
                    Login as Candidate
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {/* Screening is presented at the end of the quiz inside `QuizContainer`. */}

          {/* Email Step */}
          {step === "email" && (
            <Box className="candidate-assessment__email">
              <Typography variant="h6" gutterBottom>
                Enter Your Email
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Please enter your email address to continue with the assessment.
              </Typography>

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                error={!!emailError}
                helperText={emailError}
                InputProps={{
                  startAdornment: <EmailIcon sx={{ mr: 1, color: "action.active" }} />,
                }}
                placeholder="your.email@example.com"
                sx={{ mb: 3 }}
              />

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleEmailSubmit}
                disabled={isStarting}
                startIcon={isStarting ? <CircularProgress size={20} /> : null}
              >
                {isStarting ? "Verifying..." : "Verify Email"}
              </Button>

              <Button
                variant="text"
                size="small"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => setStep("details")}
              >
                ← Back to Details
              </Button>
            </Box>
          )}

          {/* Ready Step */}
          {step === "ready" && (
            <Box className="candidate-assessment__ready">
              <Alert severity="success" sx={{ mb: 3 }}>
                Email verified successfully! You're ready to start the assessment.
              </Alert>

              <Typography variant="h6" gutterBottom>
                Ready to Begin?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click the button below to start your assessment. Once you begin, 
                the timer will start and cannot be paused.
              </Typography>

              <Button
                variant="contained"
                size="large"
                fullWidth
                color="success"
                onClick={handleStartAssessment}
                startIcon={<StartIcon />}
              >
                Start Assessment
              </Button>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default CandidateAssessmentContainer;
