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
  Paper
} from "@mui/material";
import "./DashboardContainer.scss";
import { coursesService, quizService } from "../../API/services";
import type { RecommendedCourse as ServiceRecommendedCourse } from "../../API/services";
import { isValidUrl } from "./helper";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SchoolIcon from "@mui/icons-material/School";
import StarIcon from "@mui/icons-material/Star";
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
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
  }>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
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
  }, []);
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
                <CardContent sx={{ textAlign: 'center', padding: '1.5rem' }}>
                  <LocalFireDepartmentIcon sx={{ fontSize: 48, color: 'white', marginBottom: '0.5rem' }} />
                  <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', marginBottom: '0.25rem' }}>
                    5
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.95)', fontSize: '0.875rem', fontWeight: 600 }}>
                    Day Streak
                  </Typography>
                </CardContent>
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

          {/* Assessment Results Section */}
          <Paper sx={{ 
            padding: '2.5rem', 
            borderRadius: '24px', 
            backgroundColor: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            marginBottom: '2rem'
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                  My Assessments
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {testSessions.length > 0 
                    ? `${testSessions.length} completed ${testSessions.length === 1 ? 'assessment' : 'assessments'}` 
                    : 'No assessments completed yet'}
                </Typography>
              </Box>
              {testSessions.length > 0 && (
                <Chip 
                  icon={<StarIcon sx={{ fontSize: 16 }} />}
                  label={`${stats.avgScore.toFixed(1)}% Average`}
                  sx={{ 
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                    padding: '0.5rem'
                  }}
                />
              )}
            </Box>

            {loadingSessions ? (
              <Box sx={{ textAlign: 'center', padding: '4rem' }}>
                <Box className="spinner" sx={{ margin: '0 auto 1rem', width: '48px', height: '48px' }} />
                <Typography sx={{ color: '#64748b', fontSize: '0.875rem' }}>Loading assessments...</Typography>
              </Box>
            ) : testSessions.length === 0 ? (
              <Box sx={{ 
                textAlign: 'center', 
                padding: '4rem',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                borderRadius: '20px',
                border: '2px dashed #fbbf24'
              }}>
                <SchoolIcon sx={{ fontSize: 80, color: '#f59e0b', marginBottom: '1.5rem', opacity: 0.8 }} />
                <Typography variant="h5" sx={{ color: '#78350f', marginBottom: '0.75rem', fontWeight: 700 }}>
                  Ready to Start?
                </Typography>
                <Typography sx={{ color: '#92400e', fontSize: '0.9375rem', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                  Take your first assessment to track your progress and unlock personalized learning paths
                </Typography>
                <Button 
                  variant="contained" 
                  startIcon={<AssessmentIcon />}
                  sx={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '0.75rem 2rem',
                    borderRadius: '12px',
                    fontWeight: 600,
                    textTransform: 'none',
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                    }
                  }}
                >
                  Browse Assessments
                </Button>
              </Box>
            ) : (
              <Grid container spacing={2.5}>
                {testSessions.map((session, index) => {
                  const scoreColor = session.score_percentage !== null 
                    ? session.score_percentage >= 70 ? '#10b981' : session.score_percentage >= 50 ? '#f59e0b' : '#ef4444'
                    : '#64748b';
                  
                  return (
                    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={session.session_id}>
                      <Card 
                        sx={{ 
                          height: '100%',
                          borderRadius: '20px',
                          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                          border: '1px solid #f1f5f9',
                          overflow: 'hidden',
                          position: 'relative',
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                            transform: 'translateY(-8px)',
                            borderColor: scoreColor,
                            '& .rank-badge': {
                              transform: 'rotate(10deg) scale(1.1)'
                            }
                          }
                        }}
                      >
                        {/* Rank Badge */}
                        {index < 3 && (
                          <Box 
                            className="rank-badge"
                            sx={{ 
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: index === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' : 
                                         index === 1 ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)' :
                                         'linear-gradient(135deg, #cd7f32 0%, #daa520 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.875rem',
                              color: '#fff',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                              transition: 'transform 0.3s ease',
                              zIndex: 1
                            }}
                          >
                            #{index + 1}
                          </Box>
                        )}

                        {/* Gradient Bar */}
                        <Box sx={{ 
                          height: '8px', 
                          background: `linear-gradient(90deg, ${scoreColor} 0%, ${scoreColor}aa 100%)`,
                          boxShadow: `0 2px 8px ${scoreColor}40`
                        }} />
                        
                        <CardContent sx={{ padding: '1.75rem 1.5rem' }}>
                          {/* Header */}
                          <Box sx={{ marginBottom: '1.25rem' }}>
                            <Typography variant="h6" sx={{ 
                              fontWeight: 700, 
                              color: '#0f172a', 
                              fontSize: '1.125rem', 
                              marginBottom: '0.75rem',
                              lineHeight: 1.3,
                              minHeight: '2.6em',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {session.skill || 'Assessment'}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              {session.level && (
                                <Chip 
                                  label={session.level} 
                                  size="small" 
                                  sx={{ 
                                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                                    color: '#1e40af',
                                    fontWeight: 700,
                                    fontSize: '0.6875rem',
                                    height: '24px',
                                    borderRadius: '6px'
                                  }} 
                                />
                              )}
                              <Chip 
                                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                                label="Completed" 
                                size="small" 
                                sx={{ 
                                  background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                                  color: '#065f46',
                                  fontWeight: 700,
                                  fontSize: '0.6875rem',
                                  height: '24px',
                                  borderRadius: '6px'
                                }}
                              />
                            </Box>
                          </Box>

                          {/* Score Circle */}
                          <Box sx={{ 
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '1.5rem',
                            background: `linear-gradient(135deg, ${scoreColor}15 0%, ${scoreColor}05 100%)`,
                            borderRadius: '16px',
                            marginBottom: '1.25rem',
                            border: `2px solid ${scoreColor}30`,
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            <Box sx={{
                              position: 'absolute',
                              top: -20,
                              right: -20,
                              width: 80,
                              height: 80,
                              borderRadius: '50%',
                              background: `${scoreColor}10`,
                              filter: 'blur(20px)'
                            }} />
                            <Typography sx={{ 
                              fontSize: '3.5rem', 
                              fontWeight: 900, 
                              color: scoreColor, 
                              lineHeight: 1,
                              marginBottom: '0.5rem',
                              textShadow: `0 2px 12px ${scoreColor}40`,
                              position: 'relative'
                            }}>
                              {session.score_percentage !== null ? session.score_percentage.toFixed(0) : '?'}
                              <Typography component="span" sx={{ fontSize: '1.75rem', fontWeight: 700 }}>%</Typography>
                            </Typography>
                            <Typography sx={{ 
                              fontSize: '0.875rem', 
                              color: '#475569', 
                              fontWeight: 600,
                              backgroundColor: 'white',
                              padding: '0.375rem 0.875rem',
                              borderRadius: '20px'
                            }}>
                              {session.correct_answers || 0} / {session.total_questions} Correct
                            </Typography>
                          </Box>

                          {/* Details Grid */}
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <Box sx={{ 
                              padding: '0.75rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '12px',
                              textAlign: 'center',
                              border: '1px solid #e2e8f0'
                            }}>
                              <CheckCircleIcon sx={{ fontSize: 18, color: '#64748b', marginBottom: '0.25rem' }} />
                              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.125rem' }}>
                                Date
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#334155', fontWeight: 700 }}>
                                {session.completed_at 
                                  ? new Date(session.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : 'N/A'}
                              </Typography>
                            </Box>
                            <Box sx={{ 
                              padding: '0.75rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '12px',
                              textAlign: 'center',
                              border: '1px solid #e2e8f0'
                            }}>
                              <AccessTimeIcon sx={{ fontSize: 18, color: '#64748b', marginBottom: '0.25rem' }} />
                              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.125rem' }}>
                                Time
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: '#334155', fontWeight: 700 }}>
                                {formatDuration(session.duration_seconds)}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Achievement Badge */}
                          {session.score_percentage !== null && session.score_percentage >= 70 && (
                            <Box sx={{ 
                              padding: '0.875rem 1rem', 
                              background: `linear-gradient(135deg, ${scoreColor}20 0%, ${scoreColor}10 100%)`,
                              borderRadius: '12px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.75rem',
                              border: `2px solid ${scoreColor}30`
                            }}>
                              <Box sx={{ 
                                fontSize: '2rem', 
                                lineHeight: 1,
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                              }}>
                                {session.score_percentage >= 90 ? '🏆' : session.score_percentage >= 80 ? '🏅' : '🥈'}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '0.8125rem', color: scoreColor, fontWeight: 800, lineHeight: 1.2 }}>
                                  {session.score_percentage >= 90 ? 'Outstanding!' : session.score_percentage >= 80 ? 'Excellent!' : 'Great Job!'}
                                </Typography>
                                <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
                                  Top performer
                                </Typography>
                              </Box>
                            </Box>
                          )}
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
