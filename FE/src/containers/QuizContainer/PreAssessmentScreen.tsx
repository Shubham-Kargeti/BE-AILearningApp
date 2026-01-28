import { useState, useEffect } from "react";
import { Box, Button, Typography, Checkbox, FormControlLabel, Alert } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import QuizIcon from "@mui/icons-material/Quiz";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import "./PreAssessmentScreen.scss";

interface PreAssessmentScreenProps {
  assessmentTitle?: string;
  duration?: number;
  totalQuestions?: number;
  questionTypes?: {
    mcq?: number;
    coding?: number;
    architecture?: number;
    screening?: number;
  };
  candidateName?: string;
  candidateRole?: string;
  onStart: () => void;
  onSystemCheck?: () => Promise<{ browser: boolean; internet: boolean }>;
}

const PreAssessmentScreen = ({
  assessmentTitle = "Technical Assessment",
  duration = 45,
  totalQuestions = 20,
  questionTypes = { mcq: 10, coding: 5, architecture: 3, screening: 2 },
  candidateName,
  candidateRole,
  onStart,
  onSystemCheck,
}: PreAssessmentScreenProps) => {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [systemCheckPassed, setSystemCheckPassed] = useState(false);
  const [checkingSystem, setCheckingSystem] = useState(false);
  const [systemStatus, setSystemStatus] = useState<{
    browser: boolean;
    internet: boolean;
  } | null>(null);

  useEffect(() => {
    // Auto-run system check on mount
    runSystemCheck();
  }, []);

  const runSystemCheck = async () => {
    setCheckingSystem(true);
    try {
      if (onSystemCheck) {
        const status = await onSystemCheck();
        setSystemStatus(status);
        setSystemCheckPassed(status.browser && status.internet);
      } else {
        // Default check
        const status = {
          browser: true, // Assume modern browser
          internet: navigator.onLine,
        };
        setSystemStatus(status);
        setSystemCheckPassed(status.browser && status.internet);
      }
    } catch (error) {
      console.error("System check failed:", error);
      setSystemCheckPassed(false);
    } finally {
      setCheckingSystem(false);
    }
  };

  const canStart = agreedToTerms && systemCheckPassed;

  return (
    <Box className="pre-assessment-container">
      <Box className="pre-assessment-card">
        {/* Header */}
        <Box className="pre-assessment-header">
          <QuizIcon sx={{ fontSize: 48, color: "#667eea" }} />
          <Typography variant="h4" className="assessment-title">
            {assessmentTitle}
          </Typography>
          {candidateName && (
            <Typography variant="subtitle1" className="candidate-info">
              Welcome, {candidateName}
              {candidateRole && <span> • {candidateRole}</span>}
            </Typography>
          )}
        </Box>

        {/* Overview */}
        <Box className="assessment-overview">
          <Box className="overview-item">
            <AccessTimeIcon sx={{ color: "#667eea" }} />
            <Box>
              <Typography variant="body2" className="overview-label">
                Duration
              </Typography>
              <Typography variant="h6" className="overview-value">
                {duration} minutes
              </Typography>
            </Box>
          </Box>

          <Box className="overview-item">
            <QuizIcon sx={{ color: "#667eea" }} />
            <Box>
              <Typography variant="body2" className="overview-label">
                Total Questions
              </Typography>
              <Typography variant="h6" className="overview-value">
                {totalQuestions}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Question Breakdown */}
        <Box className="question-breakdown">
          <Typography variant="h6" className="section-title">
            Question Breakdown
          </Typography>
          <Box className="breakdown-grid">
            {questionTypes.mcq && questionTypes.mcq > 0 && (
              <Box className="breakdown-item">
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography>
                  <strong>{questionTypes.mcq}</strong> Multiple Choice
                </Typography>
              </Box>
            )}
            {questionTypes.coding && questionTypes.coding > 0 && (
              <Box className="breakdown-item">
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography>
                  <strong>{questionTypes.coding}</strong> Coding
                </Typography>
              </Box>
            )}
            {questionTypes.architecture && questionTypes.architecture > 0 && (
              <Box className="breakdown-item">
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography>
                  <strong>{questionTypes.architecture}</strong> Architecture
                </Typography>
              </Box>
            )}
            {questionTypes.screening && questionTypes.screening > 0 && (
              <Box className="breakdown-item">
                <CheckCircleOutlineIcon fontSize="small" />
                <Typography>
                  <strong>{questionTypes.screening}</strong> Screening
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Instructions */}
        <Box className="instructions-section">
          <Typography variant="h6" className="section-title">
            <InfoOutlinedIcon sx={{ mr: 1 }} />
            Instructions
          </Typography>
          <ul className="instructions-list">
            <li>This is a timed assessment. The timer will start once you click "Start Assessment".</li>
            <li>You can navigate between questions using Previous/Next buttons.</li>
            <li>Your answers are auto-saved every 30 seconds.</li>
            <li>You can review and change your answers before final submission.</li>
            <li>Once submitted, you cannot retake the assessment.</li>
            <li>Make sure you have a stable internet connection throughout.</li>
          </ul>
        </Box>

        {/* Important Notes */}
        <Box className="important-notes">
          <Typography variant="h6" className="section-title warning">
            <WarningAmberIcon sx={{ mr: 1 }} />
            Important
          </Typography>
          <ul className="notes-list">
            <li>Do not refresh the page during the assessment.</li>
            <li>Do not use the browser's back button.</li>
            <li>Switching tabs excessively may flag your submission.</li>
            <li>The assessment will auto-submit when time expires.</li>
          </ul>
        </Box>

        {/* System Check */}
        <Box className="system-check">
          <Typography variant="h6" className="section-title">
            System Check
          </Typography>
          {checkingSystem ? (
            <Typography>Running system check...</Typography>
          ) : systemStatus ? (
            <Box className="check-results">
              <Box className={`check-item ${systemStatus.browser ? "pass" : "fail"}`}>
                {systemStatus.browser ? "✓" : "✗"} Browser Compatible
              </Box>
              <Box className={`check-item ${systemStatus.internet ? "pass" : "fail"}`}>
                {systemStatus.internet ? "✓" : "✗"} Internet Connected
              </Box>
              {!systemCheckPassed && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={runSystemCheck}
                  sx={{ mt: 1 }}
                >
                  Retry System Check
                </Button>
              )}
            </Box>
          ) : null}
        </Box>

        {/* System Check Warning */}
        {!systemCheckPassed && systemStatus && (
          <Alert severity="error" sx={{ mt: 2 }}>
            System check failed. Please ensure you have a stable internet connection and are using a modern browser.
          </Alert>
        )}

        {/* Terms Agreement */}
        <Box className="terms-agreement">
          <FormControlLabel
            control={
              <Checkbox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I have read and understood the instructions. I agree to follow the assessment rules.
              </Typography>
            }
          />
        </Box>

        {/* Start Button */}
        <Box className="start-button-container">
          <Button
            variant="contained"
            size="large"
            onClick={onStart}
            disabled={!canStart}
            className="start-button"
            sx={{
              bgcolor: "#667eea",
              "&:hover": { bgcolor: "#5568d3" },
              "&:disabled": { bgcolor: "#ccc" },
              padding: "12px 48px",
              fontSize: "16px",
              fontWeight: 600,
              borderRadius: "8px",
            }}
          >
            Start Assessment
          </Button>
          {!canStart && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {!agreedToTerms && "Please agree to the terms to continue"}
              {agreedToTerms && !systemCheckPassed && "System check must pass to start"}
            </Typography>
          )}
        </Box>

        {/* Estimated Time */}
        <Typography variant="caption" className="estimated-time">
          Estimated completion time: {duration} minutes
        </Typography>
      </Box>
    </Box>
  );
};

export default PreAssessmentScreen;
