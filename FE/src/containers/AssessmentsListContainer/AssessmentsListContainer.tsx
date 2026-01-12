import { useEffect, useState } from "react";
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button,
  Chip,
  CircularProgress,
  Paper
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";
import TimerIcon from "@mui/icons-material/Timer";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { assessmentService } from "../../API/services";

interface Assessment {
  assessment_id: string;
  title: string;
  description?: string;
  skill_list?: string[];
  total_questions?: number;
  duration_minutes?: number;
  is_active?: boolean;
  is_expired?: boolean;
}

const AssessmentsListContainer = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const data = await assessmentService.listAssessments(true, 0, 50, false);

      const mapped = data.map((a: any) => ({
        assessment_id: a.assessment_id,
        title: a.title,
        description: (() => {
          try {
            const parsed = typeof a.description === 'string' ? JSON.parse(a.description) : a.description;
            return parsed?.text || (typeof a.description === 'string' ? a.description : '');
          } catch (e) {
            return a.description || '';
          }
        })(),
        total_questions: a.total_questions,
        duration_minutes: a.duration_minutes,
        is_active: a.is_active,
        is_expired: a.is_expired,
      }));

      setAssessments(mapped);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingBottom: '4rem'
    }}>
      {/* Header */}
      <Box sx={{ 
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        padding: '3rem 2rem',
        marginBottom: '2rem'
      }}>
        <Box sx={{ maxWidth: '1400px', margin: '0 auto' }}>
          <Typography variant="h3" sx={{ 
            fontWeight: 800, 
            color: 'white',
            marginBottom: '0.5rem',
            textShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            Available Assessments 📝
          </Typography>
          <Typography variant="h6" sx={{ 
            color: 'rgba(255,255,255,0.9)', 
            fontWeight: 400
          }}>
            Choose an assessment to test your skills and track your progress
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ maxWidth: '1400px', margin: '0 auto', padding: '0 2rem' }}>
        <Paper sx={{ 
          padding: '2.5rem', 
          borderRadius: '24px', 
          backgroundColor: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          minHeight: '400px'
        }}>
          {loading ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '4rem',
              gap: '1rem'
            }}>
              <CircularProgress size={48} sx={{ color: '#667eea' }} />
              <Typography sx={{ color: '#64748b' }}>Loading assessments...</Typography>
            </Box>
          ) : assessments.length === 0 ? (
            <Box sx={{ 
              textAlign: 'center', 
              padding: '4rem',
              background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
              borderRadius: '20px',
              border: '2px dashed #667eea'
            }}>
              <AssessmentIcon sx={{ fontSize: 80, color: '#667eea', marginBottom: '1.5rem', opacity: 0.8 }} />
              <Typography variant="h5" sx={{ color: '#4338ca', marginBottom: '0.75rem', fontWeight: 700 }}>
                No Assessments Available
              </Typography>
              <Typography sx={{ color: '#6366f1', fontSize: '0.9375rem', marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
                There are currently no active assessments. Please check back later or contact your administrator.
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => navigate('/app/dashboard')}
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
                Back to Dashboard
              </Button>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {assessments.map((assessment) => (
                <Grid item xs={12} sm={6} md={4} key={assessment.assessment_id}>
                  <Card sx={{ 
                    height: '100%',
                    borderRadius: '16px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    border: '1px solid #f1f5f9',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      transform: 'translateY(-4px)',
                    }
                  }}>
                    <Box sx={{ 
                      height: '6px', 
                      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                    }} />
                    
                    <CardContent sx={{ padding: '1.5rem' }}>
                      <Typography variant="h6" sx={{ 
                        fontWeight: 700, 
                        color: '#0f172a', 
                        marginBottom: '0.75rem'
                      }}>
                        {assessment.title}
                      </Typography>

                      {assessment.description && (
                        <Typography sx={{ 
                          fontSize: '0.875rem', 
                          color: '#64748b',
                          marginBottom: '1rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {assessment.description}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        {assessment.total_questions && (
                          <Chip 
                            icon={<AssessmentIcon sx={{ fontSize: 14 }} />}
                            label={`${assessment.total_questions} Questions`}
                            size="small"
                            sx={{ 
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          />
                        )}
                        {assessment.duration_minutes && (
                          <Chip 
                            icon={<TimerIcon sx={{ fontSize: 14 }} />}
                            label={`${assessment.duration_minutes} min`}
                            size="small"
                            sx={{ 
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              fontWeight: 600,
                              fontSize: '0.75rem'
                            }}
                          />
                        )}
                      </Box>

                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        disabled={!assessment.is_active || assessment.is_expired}
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          borderRadius: '10px',
                          padding: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'none',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                          },
                          '&:disabled': {
                            background: '#e2e8f0',
                            color: '#94a3b8'
                          }
                        }}
                      >
                        Start Assessment
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default AssessmentsListContainer;
