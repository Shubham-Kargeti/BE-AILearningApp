import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Paper,
  LinearProgress,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  AccessTime as AccessTimeIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Score as ScoreIcon,
} from "@mui/icons-material";
import { assessmentResultsService } from "../../API/services";
import Toast from "../../components/Toast/Toast";
import "./DetailedResultsView.scss";

interface QuestionResult {
  question_id: number;
  question_text: string;
  topic: string | null;
  difficulty: string | null;
  candidate_answer: string;
  correct_answer: string;
  is_correct: boolean;
  options: Record<string, string> | null;
  time_taken_seconds: number | null;
}

interface DetailedResult {
  session_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  assessment_id: string;
  assessment_title: string;
  job_title: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score_percentage: number | null;
  is_completed: boolean;
  is_scored: boolean;
  questions: QuestionResult[];
  application_status: string | null;
}

const DetailedResultsView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<DetailedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmails, setShareEmails] = useState("");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [shareMessage, setShareMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetchDetailedResult();
  }, [sessionId]);

  const fetchDetailedResult = async () => {
    if (!sessionId) {
      setError("Session ID is required");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await assessmentResultsService.getSessionDetailedResult(sessionId);
      setResult(data);
    } catch (err: any) {
      console.error("Error fetching detailed results:", err);
      setError(err?.response?.data?.detail || "Failed to load detailed results");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!shareEmails.trim()) {
      setToast({ type: "error", message: "Please enter at least one email address" });
      return;
    }

    const emails = shareEmails.split(",").map((e) => e.trim()).filter((e) => e);
    if (emails.length === 0) {
      setToast({ type: "error", message: "Please enter valid email addresses" });
      return;
    }

    try {
      setSharing(true);
      const response = await assessmentResultsService.shareSessionResult(sessionId!, {
        recipient_emails: emails,
        include_answers: includeAnswers,
        message: shareMessage || undefined,
      });
      
      setToast({ type: "success", message: response.message });
      setShareDialogOpen(false);
      setShareEmails("");
      setShareMessage("");
    } catch (err: any) {
      console.error("Error sharing results:", err);
      setToast({ type: "error", message: err?.response?.data?.detail || "Failed to share results" });
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    setToast({ type: "info", message: "PDF download feature coming soon" });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status: string | null): "default" | "success" | "warning" | "error" => {
    switch (status?.toLowerCase()) {
      case "shortlisted":
        return "success";
      case "rejected":
        return "error";
      case "in_progress":
        return "warning";
      default:
        return "default";
    }
  };

  const getDifficultyColor = (difficulty: string | null): "default" | "success" | "warning" | "error" => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "success";
      case "medium":
        return "warning";
      case "hard":
        return "error";
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <Box className="detailed-results-view" display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="detailed-results-view" p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  if (!result) {
    return (
      <Box className="detailed-results-view" p={3}>
        <Alert severity="warning">No results found</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  const scorePercentage = result.score_percentage || 0;
  const passThreshold = 60; // TODO: Make this configurable

  return (
    <Box className="detailed-results-view" p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate(-1)}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">Detailed Assessment Results</Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={() => setShareDialogOpen(true)}
          >
            Share
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadPDF}
          >
            Download PDF
          </Button>
        </Box>
      </Box>

      {/* Candidate Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PersonIcon color="primary" />
                <Typography variant="h6">Candidate Information</Typography>
              </Box>
              <Typography variant="body1">
                <strong>Name:</strong> {result.candidate_name || "N/A"}
              </Typography>
              <Typography variant="body1">
                <strong>Email:</strong> {result.candidate_email || "N/A"}
              </Typography>
              {result.application_status && (
                <Box mt={1}>
                  <Chip
                    label={result.application_status.replace("_", " ").toUpperCase()}
                    color={getStatusColor(result.application_status)}
                    size="small"
                  />
                </Box>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <AssignmentIcon color="primary" />
                <Typography variant="h6">Assessment Details</Typography>
              </Box>
              <Typography variant="body1">
                <strong>Title:</strong> {result.assessment_title}
              </Typography>
              {result.job_title && (
                <Typography variant="body1">
                  <strong>Position:</strong> {result.job_title}
                </Typography>
              )}
              <Typography variant="body1">
                <strong>Session ID:</strong> {result.session_id}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Performance Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={3}>
            <ScoreIcon color="primary" />
            <Typography variant="h6">Performance Summary</Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "primary.50", textAlign: "center" }}>
                <Typography variant="h3" color="primary">
                  {scorePercentage.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall Score
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "success.50", textAlign: "center" }}>
                <Typography variant="h3" color="success.main">
                  {result.correct_answers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Correct Answers
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "info.50", textAlign: "center" }}>
                <Typography variant="h3" color="info.main">
                  {result.answered_questions}/{result.total_questions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Questions Answered
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "warning.50", textAlign: "center" }}>
                <Typography variant="h3" color="warning.main">
                  {formatDuration(result.duration_seconds)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Time Taken
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Box mt={3}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Progress</Typography>
              <Typography variant="body2">{scorePercentage.toFixed(1)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={scorePercentage}
              sx={{
                height: 10,
                borderRadius: 5,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  bgcolor: scorePercentage >= passThreshold ? "success.main" : "error.main",
                },
              }}
            />
          </Box>

          <Box mt={2} display="flex" gap={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>Started:</strong> {formatDate(result.started_at)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Completed:</strong> {formatDate(result.completed_at)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Question-by-Question Results */}
      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Question-by-Question Breakdown
          </Typography>

          {result.questions.length === 0 ? (
            <Alert severity="info">No questions found for this assessment</Alert>
          ) : (
            result.questions.map((question, index) => (
              <Accordion key={question.question_id} defaultExpanded={index === 0}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={2} width="100%">
                    {question.is_correct ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <CancelIcon color="error" />
                    )}
                    <Typography flex={1}>
                      Question {index + 1}: {question.question_text.substring(0, 80)}...
                    </Typography>
                    {question.topic && (
                      <Chip label={question.topic} size="small" color="primary" variant="outlined" />
                    )}
                    {question.difficulty && (
                      <Chip
                        label={question.difficulty}
                        size="small"
                        color={getDifficultyColor(question.difficulty)}
                      />
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box>
                    <Typography variant="body1" mb={2}>
                      <strong>Question:</strong> {question.question_text}
                    </Typography>

                    {question.options && (
                      <Box mb={2}>
                        <Typography variant="body2" mb={1}>
                          <strong>Options:</strong>
                        </Typography>
                        {Object.entries(question.options).map(([key, value]) => (
                          <Typography
                            key={key}
                            variant="body2"
                            sx={{
                              pl: 2,
                              py: 0.5,
                              bgcolor:
                                key === question.correct_answer
                                  ? "success.50"
                                  : key === question.candidate_answer
                                  ? "error.50"
                                  : "transparent",
                              borderLeft:
                                key === question.correct_answer || key === question.candidate_answer
                                  ? "3px solid"
                                  : "none",
                              borderColor:
                                key === question.correct_answer ? "success.main" : "error.main",
                            }}
                          >
                            {key}. {value}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>Candidate's Answer:</strong>
                        </Typography>
                        <Paper elevation={0} sx={{ p: 1, mt: 1, bgcolor: "grey.50" }}>
                          <Typography variant="body2">{question.candidate_answer}</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2">
                          <strong>Correct Answer:</strong>
                        </Typography>
                        <Paper elevation={0} sx={{ p: 1, mt: 1, bgcolor: "success.50" }}>
                          <Typography variant="body2">{question.correct_answer}</Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    {question.time_taken_seconds !== null && (
                      <Box mt={2} display="flex" alignItems="center" gap={1}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Time taken: {question.time_taken_seconds}s
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Assessment Results</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email Addresses (comma-separated)"
            value={shareEmails}
            onChange={(e) => setShareEmails(e.target.value)}
            placeholder="email1@example.com, email2@example.com"
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="Message (optional)"
            value={shareMessage}
            onChange={(e) => setShareMessage(e.target.value)}
            placeholder="Add a personal message..."
            margin="normal"
            multiline
            rows={3}
          />
          <FormControlLabel
            control={
              <Checkbox checked={includeAnswers} onChange={(e) => setIncludeAnswers(e.target.checked)} />
            }
            label="Include detailed answers"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)} disabled={sharing}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            variant="contained"
            startIcon={sharing ? <CircularProgress size={20} /> : <EmailIcon />}
            disabled={sharing}
          >
            {sharing ? "Sharing..." : "Share"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
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

export default DetailedResultsView;
