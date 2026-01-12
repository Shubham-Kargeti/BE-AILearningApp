import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Box,
  Button,
  TextField,
  Typography,
  Autocomplete,
  Chip,
  Paper,
  Container,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import "./ProfileSetupContainer.scss";
import { convertProficiency } from "./helper";
import { quizService } from "../../API/services";
import Loader from "../../components/Loader";
import PersonIcon from "@mui/icons-material/Person";
import CodeIcon from "@mui/icons-material/Code";
import SchoolIcon from "@mui/icons-material/School";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const skillOptions = ["Agentic AI"];

const profeciencyOptions = ["Beginner", "Intermediate", "Advanced"];

interface ProfileSetupFormValues {
  role: string;
  skills: string[];
  subSkills: string[];
  expertise: string;
}

const ProfileSetupContainer = () => {
  const navigate = useNavigate();

  const [subSkillsOptions, setSubSkillsOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const formik = useFormik<ProfileSetupFormValues>({
    initialValues: {
      role: "Developer",
      skills: [],
      subSkills: [],
      expertise: "",
    },
    validationSchema: Yup.object({
      role: Yup.string().required("Role is required"),
      skills: Yup.array().min(1, "Select at least one skill"),
      subSkills: Yup.array().min(1, "Select at least one sub-skill"),
      expertise: Yup.string().required("Select your expertise level"),
    }),
    onSubmit: (values) => {
      localStorage.setItem("profileCompleted", "true");

      const { expertise, skills, subSkills } = values;
      const userprofileData = {
        topic: skills[0] || "",
        subtopics: subSkills,
        level: convertProficiency(expertise) || "",
      };
      localStorage.setItem("userProfile", JSON.stringify(userprofileData));
      navigate("/quiz");
    },
  });

  const getSubTopicsBasedOnSkills = async (skills: string[]) => {
    try {
      setLoading(true);
      const res = await quizService.getSubSkills(skills[0]);
      setSubSkillsOptions(res || []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sub topics:", error);
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    formik.setFieldValue(field, value);
    if (field === "skills") {
      formik.setFieldValue("subSkills", []);
      getSubTopicsBasedOnSkills(value);
    }
  };

  if (loading) return <Loader fullscreen message="Loading SubSkills..." />;

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      paddingBottom: '4rem',
      paddingTop: '2rem'
    }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: '3rem 2rem',
          marginBottom: '2rem',
          borderRadius: '24px',
          textAlign: 'center'
        }}>
          <Box sx={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
          }}>
            <AutoAwesomeIcon sx={{ fontSize: 40, color: '#667eea' }} />
          </Box>
          
          <Typography variant="h3" sx={{
            fontWeight: 800,
            color: 'white',
            marginBottom: '0.5rem',
            textShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            Self Assessment Creation ✨
          </Typography>
          <Typography variant="h6" sx={{
            color: 'rgba(255,255,255,0.9)',
            fontWeight: 400
          }}>
            Tell us about your skills and expertise to get personalized quizzes
          </Typography>
        </Box>

        {/* Form Card */}
        <Paper sx={{
          padding: '3rem',
          borderRadius: '24px',
          backgroundColor: 'white',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
        }}>
          <form onSubmit={formik.handleSubmit}>
            {/* Role Field */}
            <Box sx={{ marginBottom: '2rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Box sx={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <PersonIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Your Role
                </Typography>
              </Box>
              
              <TextField
                id="role"
                name="role"
                placeholder="e.g., Software Developer, Data Scientist"
                fullWidth
                value={formik.values.role}
                onChange={formik.handleChange}
                error={formik.touched.role && Boolean(formik.errors.role)}
                helperText={formik.touched.role && formik.errors.role}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    '&:hover fieldset': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                    }
                  }
                }}
              />
            </Box>

            {/* Skills Field */}
            <Box sx={{ marginBottom: '2rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Box sx={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CodeIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Skills
                </Typography>
              </Box>

              <Autocomplete
                multiple
                id="skills"
                options={skillOptions}
                value={formik.values.skills}
                onChange={(_event, value) => handleChange("skills", value)}
                renderTags={(value: readonly string[], getTagProps) =>
                  value.map((option: string, index: number) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={index}
                      label={option}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 600,
                        '& .MuiChip-deleteIcon': {
                          color: 'rgba(255,255,255,0.8)',
                          '&:hover': {
                            color: 'white'
                          }
                        }
                      }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search or select skills"
                    error={formik.touched.skills && Boolean(formik.errors.skills)}
                    helperText={formik.touched.skills && formik.errors.skills}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: '#f8fafc',
                        '&:hover fieldset': {
                          borderColor: '#667eea',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#667eea',
                        }
                      }
                    }}
                  />
                )}
              />
            </Box>

            {/* SubSkills Field */}
            <Box sx={{ marginBottom: '2rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Box sx={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CodeIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Sub-Skills
                </Typography>
              </Box>

              <Autocomplete
                multiple
                id="subSkills"
                options={subSkillsOptions}
                value={formik.values.subSkills}
                onChange={(_event, value) => handleChange("subSkills", value)}
                renderTags={(value: readonly string[], getTagProps) =>
                  value.map((option: string, index: number) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={index}
                      label={option}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 600,
                        '& .MuiChip-deleteIcon': {
                          color: 'rgba(255,255,255,0.8)',
                          '&:hover': {
                            color: 'white'
                          }
                        }
                      }}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search or select sub-skills"
                    error={formik.touched.subSkills && Boolean(formik.errors.subSkills)}
                    helperText={formik.touched.subSkills && formik.errors.subSkills}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: '#f8fafc',
                        '&:hover fieldset': {
                          borderColor: '#667eea',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#667eea',
                        }
                      }
                    }}
                  />
                )}
              />
            </Box>

            {/* Expertise Field */}
            <Box sx={{ marginBottom: '3rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Box sx={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SchoolIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Expertise Level
                </Typography>
              </Box>

              <Autocomplete
                id="expertise"
                options={profeciencyOptions}
                value={formik.values.expertise}
                onChange={(_event, value) => formik.setFieldValue("expertise", value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Select your expertise level"
                    error={formik.touched.expertise && Boolean(formik.errors.expertise)}
                    helperText={formik.touched.expertise && formik.errors.expertise}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: '#f8fafc',
                        '&:hover fieldset': {
                          borderColor: '#667eea',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#667eea',
                        }
                      }
                    }}
                  />
                )}
              />
            </Box>

            {/* Submit Button */}
            <Button
              variant="contained"
              type="submit"
              fullWidth
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 700,
                textTransform: 'none',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
                }
              }}
            >
              Save & Continue to Quiz 🚀
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default ProfileSetupContainer;
