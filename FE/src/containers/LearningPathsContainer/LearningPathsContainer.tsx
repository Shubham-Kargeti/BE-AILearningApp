import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  School,
  TrendingUp,
  CheckCircle,
  Schedule,
  Assessment,
  EmojiEvents,
} from "@mui/icons-material";
import { candidateService } from "../../API/services";

interface AssessmentWithSession {
  assessment_id: string;
  title: string;
  description?: string;
  job_title?: string;
  duration_minutes: number;
  total_questions: number;
  is_published: boolean;
  is_expired: boolean;
  expires_at?: string;
  created_at: string;
  session_id?: string;
  is_completed: boolean;
  score_percentage?: number;
  completed_at?: string;
  attempts_count: number;
}

const LearningPathsContainer = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentWithSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const data = await candidateService.getMyAssessments();
      // Only show completed assessments that have learning paths available
      const completed = data.filter(a => a.is_completed && a.session_id);
      setAssessments(completed);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#f59e0b";
    return "#dc2626";
  };

  const getPerformanceLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    return "Needs Improvement";
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f8fafc", padding: "2rem" }}>
      <Box sx={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <Box sx={{ marginBottom: "2rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(67, 233, 123, 0.3)",
              }}
            >
              <School sx={{ fontSize: 28, color: "white" }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "#1e293b" }}>
              My Learning Paths
            </Typography>
          </Box>
          <Typography sx={{ color: "#64748b", fontSize: "1rem", marginLeft: "4rem" }}>
            Personalized learning recommendations based on your assessment results
          </Typography>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty State */}
        {!loading && assessments.length === 0 && (
          <Paper
            sx={{
              padding: "3rem",
              textAlign: "center",
              borderRadius: "16px",
              border: "2px dashed #e2e8f0",
            }}
          >
            <School sx={{ fontSize: 80, color: "#cbd5e1", marginBottom: "1rem" }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
              No Learning Paths Available Yet
            </Typography>
            <Typography sx={{ color: "#94a3b8", marginBottom: "2rem" }}>
              Complete an assessment to get personalized learning recommendations
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate("/app/dashboard")}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                textTransform: "none",
                fontWeight: 600,
                padding: "0.75rem 2rem",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
              }}
            >
              Go to Dashboard
            </Button>
          </Paper>
        )}

        {/* Assessments Grid */}
        {!loading && assessments.length > 0 && (
          <Grid container spacing={3}>
            {assessments.map((assessment) => {
              const score = assessment.score_percentage || 0;
              const scoreColor = getScoreColor(score);
              const performanceLabel = getPerformanceLabel(score);

              return (
                <Grid size={{ xs: 12, md: 6 }} key={assessment.assessment_id}>
                  <Card
                    sx={{
                      borderRadius: "16px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      transition: "all 0.3s",
                      border: "2px solid #e2e8f0",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      },
                    }}
                  >
                    <CardContent sx={{ padding: "2rem" }}>
                      {/* Header */}
                      <Box sx={{ marginBottom: "1.5rem" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b", flex: 1 }}>
                            {assessment.title}
                          </Typography>
                          <Chip
                            icon={<CheckCircle sx={{ fontSize: 16 }} />}
                            label="Completed"
                            size="small"
                            sx={{
                              backgroundColor: "#dcfce7",
                              color: "#16a34a",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                          {assessment.job_title}
                        </Typography>
                      </Box>

                      {/* Stats Grid */}
                      <Grid container spacing={2} sx={{ marginBottom: "1.5rem" }}>
                        <Grid size={{ xs: 6 }}>
                          <Paper
                            sx={{
                              padding: "1rem",
                              background: `linear-gradient(135deg, ${scoreColor}15 0%, ${scoreColor}25 100%)`,
                              borderRadius: "12px",
                              border: `1px solid ${scoreColor}40`,
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                              <EmojiEvents sx={{ fontSize: 20, color: scoreColor }} />
                              <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                Score
                              </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: scoreColor }}>
                              {score.toFixed(1)}%
                            </Typography>
                            <Typography sx={{ fontSize: "0.75rem", color: scoreColor, fontWeight: 600 }}>
                              {performanceLabel}
                            </Typography>
                          </Paper>
                        </Grid>

                        <Grid size={{ xs: 6 }}>
                          <Paper
                            sx={{
                              padding: "1rem",
                              background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                              borderRadius: "12px",
                              border: "1px solid #93c5fd",
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                              <Assessment sx={{ fontSize: 20, color: "#2563eb" }} />
                              <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
                                Questions
                              </Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: "#2563eb" }}>
                              {assessment.total_questions}
                            </Typography>
                            <Typography sx={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}>
                              Total
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* Completion Info */}
                      {assessment.completed_at && (
                        <Box
                          sx={{
                            padding: "0.75rem",
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            marginBottom: "1.5rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <Schedule sx={{ fontSize: 16, color: "#64748b" }} />
                          <Typography sx={{ fontSize: "0.875rem", color: "#64748b" }}>
                            Completed on {new Date(assessment.completed_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Typography>
                        </Box>
                      )}

                      {/* Action Button */}
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<TrendingUp />}
                        onClick={() => navigate(`/learning-path/${assessment.session_id}`)}
                        sx={{
                          background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
                          color: "white",
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: "0.9375rem",
                          padding: "0.875rem",
                          boxShadow: "0 4px 12px rgba(67, 233, 123, 0.3)",
                          "&:hover": {
                            boxShadow: "0 6px 16px rgba(67, 233, 123, 0.4)",
                          },
                        }}
                      >
                        View Learning Path
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* Info Alert */}
        {!loading && assessments.length > 0 && (
          <Alert
            icon={<School />}
            severity="info"
            sx={{
              marginTop: "2rem",
              borderRadius: "12px",
              "& .MuiAlert-icon": {
                color: "#0ea5e9",
              },
            }}
          >
            <Typography sx={{ fontWeight: 600, marginBottom: "0.25rem" }}>
              💡 Personalized Learning
            </Typography>
            <Typography sx={{ fontSize: "0.875rem" }}>
              Each learning path is tailored based on your assessment performance, focusing on areas where you can
              improve. Complete the recommended courses to strengthen your skills!
            </Typography>
          </Alert>
        )}
      </Box>
    </Box>
  );
};

export default LearningPathsContainer;
