import { useEffect, useState, useMemo } from "react";
import { 
  Box, 
  Typography, 
  Button, 
  Snackbar, 
  Alert, 
  Grid,
  Card, 
  CardContent, 
  Chip,
  LinearProgress,
  Avatar,
  Paper,
  CircularProgress
} from "@mui/material";
import "./DashboardContainer.scss";
import { candidateService, coursesService, quizService } from "../../API/services";
import type {
  CandidatePendingAssessment,
  RecommendedCourse as ServiceRecommendedCourse
} from "../../API/services";
import { isValidUrl } from "./helper";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SchoolIcon from "@mui/icons-material/School";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import Tooltip from "@mui/material/Tooltip";
import { useNavigate } from "react-router-dom";

const techImages = [
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=800&q=80",
];

type RecommendedCourse = {
  name: string;
  topic: string;
  url: string;
  score: number;
  image: string;
  collection: string;
  category: string;
  description: string;
};

const getRandomTechImage = () => {
  return techImages[Math.floor(Math.random() * techImages.length)];
};

const DashboardContainer = () => {
  const [recommendedCoursesData, setRecommendedCoursesData] = useState<
    RecommendedCourse[]
  >([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [testSessions, setTestSessions] = useState<Array<{
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
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [myAssessments, setMyAssessments] = useState<CandidatePendingAssessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const navigate = useNavigate();
  
  const getRecommendedCourses = async () => {
    try {
      const response = await coursesService.getRecommendedCourses("AgenticAI", 7);

      const coursesWithImages = response.recommended_courses.map(
        (course: ServiceRecommendedCourse) => ({
          ...course,
          image: course.image || getRandomTechImage(),
        })
      );

      setRecommendedCoursesData(coursesWithImages as RecommendedCourse[]);
    } catch (error) {
      console.error("Error fetching recommended courses:", error);
    }
  };

  const fetchTestSessions = async () => {
    try {
      setLoadingSessions(true);
      const sessions = await quizService.listMyTestSessions();
      
      // Filter to only completed sessions and remove duplicates based on skill+level
      const completedSessions = sessions.filter(s => s.is_completed);
      
      // Remove duplicates by keeping only the latest session for each skill-level combo
      const uniqueSessions = completedSessions.reduce((acc, current) => {
        const key = `${current.skill}-${current.level}`;
        const existing = acc.get(key);
        
        if (!existing || (current.completed_at && existing.completed_at && 
            new Date(current.completed_at) > new Date(existing.completed_at))) {
          acc.set(key, current);
        }
        
        return acc;
      }, new Map());
      
      // Convert map to array and sort by completion date (newest first)
      const sortedSessions = Array.from(uniqueSessions.values())
        .sort((a, b) => {
          if (!a.completed_at) return 1;
          if (!b.completed_at) return -1;
          return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
        });
      
      setTestSessions(sortedSessions);
    } catch (error) {
      console.error("Error fetching test sessions:", error);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalAssessments = testSessions.length;
    const avgScore = testSessions.length > 0 
      ? testSessions.reduce((sum, s) => sum + (s.score_percentage || 0), 0) / testSessions.length 
      : 0;
    const highScore = testSessions.length > 0 
      ? Math.max(...testSessions.map(s => s.score_percentage || 0)) 
      : 0;
    const totalTimeSpent = testSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    
    return { totalAssessments, avgScore, highScore, totalTimeSpent };
  }, [testSessions]);

  useEffect(() => {
    getRecommendedCourses();
    fetchTestSessions();
    fetchMyPendingAssessments();
  }, []);

  const fetchMyPendingAssessments = async () => {
    try {
      setLoadingAssessments(true);
      setAssessmentError(null);
      const assessments = await candidateService.getMyPendingAssessments();
      setMyAssessments(assessments);
    } catch (error) {
      console.warn("Error fetching pending assessments:", error);
      setAssessmentError("Unable to load assigned assessments right now.");
    } finally {
      setLoadingAssessments(false);
    }
  };

  const formatDashboardDate = (value?: string | null) => {
    if (!value) return "Not set";
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPendingAssessmentStatus = (assessment: CandidatePendingAssessment) => {
    const status = assessment.status?.replace(/_/g, " ") || "Pending";
    if (assessment.is_expired) return "Expired";
    if (assessment.session_id || status.toLowerCase().includes("progress")) {
      return "In Progress";
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getAssessmentTypeLabel = (assessment: CandidatePendingAssessment) => {
    if (assessment.is_questionnaire_enabled && assessment.is_interview_enabled) {
      return "Questionnaire + Interview";
    }
    if (assessment.is_interview_enabled) return "Interview";
    if (assessment.is_questionnaire_enabled) return "Questionnaire";
    return assessment.assessment_method || "Assessment";
  };

  const handleOpenPendingAssessment = (assessment: CandidatePendingAssessment) => {
    navigate(`/candidate-assessment/${assessment.assessment_id}`, {
      state: {
        assessmentId: assessment.assessment_id,
        sessionId: assessment.session_id,
        pendingAssessment: assessment,
      },
    });
  };
  
  return (
    <>
      <Box sx={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        paddingBottom: '4rem'
      }}>
        {/* Hero Header */}
        <Box sx={{ 
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: '3rem 2rem 2rem',
          marginBottom: '2rem'
        }}>
          <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '2rem' }}>
              <Box>
                <Typography variant="h3" sx={{ 
                  fontWeight: 800, 
                  color: 'white',
                  marginBottom: '0.5rem',
                  textShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                  Welcome Back! 👋
                </Typography>
                <Typography variant="h6" sx={{ 
                  color: 'rgba(255,255,255,0.9)', 
                  fontWeight: 400,
                  maxWidth: '600px'
                }}>
                  Track your progress, view your achievements, and continue learning
                </Typography>
              </Box>
              
              {/* Streak Card */}
              <Card sx={{ 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: '16px',
                minWidth: '180px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                cursor: 'pointer',
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)'
                }
              }} onClick={() => navigate("/app/streak")}>
                {/* <CardContent sx={{ textAlign: 'center', padding: '1.5rem' }}>
                  <LocalFireDepartmentIcon sx={{ fontSize: 48, color: 'white', marginBottom: '0.5rem' }} />
                  <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', marginBottom: '0.25rem' }}>
                    5
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.875rem', fontWeight: 600 }}>
                    Day Streak
                  </Typography>
                </CardContent> */}
              </Card>
            </Box>
          </Box>
        </Box>

        {/* Main Content */}
        <Box sx={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
          
          {/* Stats Overview */}
          {!loadingSessions && testSessions.length > 0 && (
            <Grid container spacing={3} sx={{ marginBottom: '3rem' }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ 
                  padding: '1.5rem',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <AssessmentIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {stats.totalAssessments}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 500 }}>
                        Assessments
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={100} 
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': { backgroundColor: 'white' }
                    }} 
                  />
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ 
                  padding: '1.5rem',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(245, 87, 108, 0.4)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <TrendingUpIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {stats.avgScore.toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 500 }}>
                        Avg Score
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={stats.avgScore} 
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': { backgroundColor: 'white' }
                    }} 
                  />
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ 
                  padding: '1.5rem',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(79, 172, 254, 0.4)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <EmojiEventsIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {stats.highScore.toFixed(0)}%
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 500 }}>
                        Best Score
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={stats.highScore} 
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': { backgroundColor: 'white' }
                    }} 
                  />
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ 
                  padding: '1.5rem',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(250, 112, 154, 0.4)',
                  height: '100%'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                      <AccessTimeIcon />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {Math.floor(stats.totalTimeSpent / 60)}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.875rem', fontWeight: 500 }}>
                        Minutes
                      </Typography>
                    </Box>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((stats.totalTimeSpent / 3600) * 100, 100)} 
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-bar': { backgroundColor: 'white' }
                    }} 
                  />
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* My Assigned Assessments Section */}
          <Paper sx={{ 
            padding: '2.5rem', 
            borderRadius: '24px', 
            backgroundColor: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            marginBottom: '2rem'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                  My Pending Assessments
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Assessments assigned to you that are pending or in progress
                </Typography>
              </Box>
              {!loadingAssessments && myAssessments.length > 0 && (
                <Chip
                  label={`${myAssessments.length} assigned`}
                  sx={{
                    backgroundColor: '#eef2ff',
                    color: '#4338ca',
                    fontWeight: 700,
                  }}
                />
              )}
            </Box>
            {loadingAssessments ? (
              <Box className="pending-assessments-state">
                <CircularProgress size={42} />
                <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mt: 2 }}>
                  Loading assigned assessments...
                </Typography>
              </Box>
            ) : assessmentError ? (
              <Box className="pending-assessments-empty pending-assessments-empty--error">
                <AssessmentIcon className="pending-assessments-empty__icon" />
                <Typography variant="h6" className="pending-assessments-empty__title">
                  Could not load assessments
                </Typography>
                <Typography className="pending-assessments-empty__text">
                  {assessmentError}
                </Typography>
                <Button
                  variant="contained"
                  onClick={fetchMyPendingAssessments}
                  sx={{
                    mt: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    textTransform: 'none',
                    fontWeight: 700,
                  }}
                >
                  Retry
                </Button>
              </Box>
            ) : myAssessments.length === 0 ? (
              <Box className="pending-assessments-empty">
                <CheckCircleIcon className="pending-assessments-empty__icon" />
                <Typography variant="h6" className="pending-assessments-empty__title">
                  No pending assessments
                </Typography>
                <Typography className="pending-assessments-empty__text">
                  You do not have any assigned assessments waiting right now. New assignments will appear here.
                </Typography>
              </Box>
            ) : (

              <Grid container spacing={2}>
                {myAssessments.map((assessment) => {
                  const skills = Object.entries(assessment.required_skills || {}).slice(0, 4);
                  const hiddenSkillCount = Math.max(
                    Object.keys(assessment.required_skills || {}).length - skills.length,
                    0
                  );
                  const statusLabel = getPendingAssessmentStatus(assessment);
                  const isInProgress = statusLabel === "In Progress";

                  return (
                    <Grid size={{ xs: 12, md: 6 }} key={`${assessment.application_id}-${assessment.assessment_id}`}>
                      <Card sx={{
                        height: '100%',
                        border: '1px solid',
                        borderColor: assessment.is_expired ? '#fecaca' : isInProgress ? '#bfdbfe' : '#fde68a',
                        borderRadius: '16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        transition: 'all 0.3s',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        }
                      }}>
                        <CardContent sx={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem', gap: '1rem' }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
                                {assessment.title || "Assigned Assessment"}
                              </Typography>
                              <Typography sx={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.35rem' }}>
                                {assessment.job_title || assessment.role_applied_for || "Role assessment"}
                              </Typography>
                            </Box>
                            <Chip
                              icon={isInProgress ? <AccessTimeIcon sx={{ fontSize: 16 }} /> : undefined}
                              label={statusLabel}
                              size="small"
                              sx={{
                                flexShrink: 0,
                                backgroundColor: assessment.is_expired ? '#fee2e2' : isInProgress ? '#dbeafe' : '#fef3c7',
                                color: assessment.is_expired ? '#b91c1c' : isInProgress ? '#1d4ed8' : '#92400e',
                                fontWeight: 700,
                              }}
                            />
                             </Box>

                          {/* {assessment.description && (
                            <Typography sx={{
                              fontSize: '0.875rem',
                              color: '#64748b',
                              marginBottom: '1rem',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}>
                              {assessment.description}
                            </Typography>
                          )} */}
                          <Box sx={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <AccessTimeIcon sx={{ fontSize: 16, color: '#64748b' }} />
                              <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                                {assessment.duration_minutes} min
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <AssessmentIcon sx={{ fontSize: 16, color: '#64748b' }} />
                              <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                                {assessment.total_questions} questions
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <SchoolIcon sx={{ fontSize: 16, color: '#64748b' }} />
                              <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                                {getAssessmentTypeLabel(assessment)}
                              </Typography>
                            </Box>
                          </Box>

                          {skills.length > 0 && (
                            <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                              {skills.map(([skill, level]) => (
                                <Chip
                                  key={skill}
                                  label={level ? `${skill}: ${level}` : skill}
                                  size="small"
                                  sx={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: 600,
                                    borderRadius: '8px',
                                  }}
                                />
                              ))}
                              {hiddenSkillCount > 0 && (
                                <Chip
                                  label={`+${hiddenSkillCount} more`}
                                  size="small"
                                  sx={{ backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          )}
                          <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            gap: '0.75rem',
                            marginBottom: '1.25rem',
                            marginTop: 'auto',
                          }}>
                            <Box className="pending-assessment-meta">
                              <span>Applied</span>
                              <strong>{formatDashboardDate(assessment.applied_at)}</strong>
                            </Box>
                            <Box className="pending-assessment-meta">
                              <span>Expires</span>
                              <strong>{formatDashboardDate(assessment.expires_at)}</strong>
                            </Box>
                          </Box>

                          <Button
                            variant="contained"
                            fullWidth
                            size="small"
                            disabled={assessment.is_expired}
                            onClick={() => handleOpenPendingAssessment(assessment)}
                            sx={{
                              background: assessment.is_expired
                                ? '#9ca3af'
                                : isInProgress
                                  ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)'
                                  : 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                              textTransform: 'none',
                              fontWeight: 700,
                              boxShadow: assessment.is_expired ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.22)',
                            }}
                          >
                            {assessment.is_expired ? 'Expired' : isInProgress ? 'Resume Assessment' : 'Start Assessment'}
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>



          {/* Recommended Courses Section */}
          {recommendedCoursesData.length > 0 && (
            <Paper sx={{ 
              padding: '2.5rem', 
              borderRadius: '24px', 
              backgroundColor: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
            }}>
              <Box sx={{ marginBottom: '2rem' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                  Recommended For You
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                  Curated courses to boost your skills
                </Typography>
              </Box>

              <Box className="course-grid">
                {recommendedCoursesData.map((course) => {
                  return (
                    <Box key={course.name} className="course-card">
                      <Box
                        className="course-image"
                        style={{
                          backgroundImage: `url(${course.image})`,
                        }}
                      />

                      <Box className="course-info">
                        <Grid className="course-header">
                          <Grid>
                            <Typography className="course-title">
                              {course.name}
                            </Typography>
                          </Grid>
                          <Grid>
                            <Tooltip
                              title={course.description}
                              placement="top"
                              arrow
                            >
                              <InfoOutlinedIcon className="info-icon" />
                            </Tooltip>
                          </Grid>
                        </Grid>

                        <Typography className="course-desc">
                          <strong>Topic:</strong> {course.topic}
                        </Typography>
                        <Typography className="course-desc">
                          <strong>Category:</strong> {course.category}
                        </Typography>
                      </Box>

                      <Button
                        variant="contained"
                        className="start-btn"
                        onClick={() => {
                          if (!isValidUrl(course.url)) {
                            setToastMessage("Invalid course URL.");
                            setShowToast(true);
                            return;
                          }

                          window.open(course.url, "_blank");
                        }}
                      >
                        Start Course
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </Box>
      </Box>

      <Snackbar
        open={showToast}
        autoHideDuration={3000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="error" variant="filled">
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DashboardContainer;
