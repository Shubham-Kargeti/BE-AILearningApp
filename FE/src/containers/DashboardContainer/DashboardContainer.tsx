import { useEffect, useState } from "react";
import { Box, Typography, Button, Snackbar, Alert, Grid } from "@mui/material";
import "./DashboardContainer.scss";
import { coursesService } from "../../API/services";
import type { RecommendedCourse as ServiceRecommendedCourse } from "../../API/services";
import { getBadge, isValidUrl } from "./helper";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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

  const navigate = useNavigate();
  const score = localStorage.getItem("latestScore");
  const scoreNum = score ? Number(score) : 0;
  console.log("Monesh Latest score on dashboard:", score);
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

  useEffect(() => {
    getRecommendedCourses();
  }, []);
  return (
    <>
      <Box className="dashboard-container">
        <Box className="dashboard-header">
          <Box>
            <Typography variant="h4" className="dashboard-title">
              Great Job on Your Last Quiz!
            </Typography>
            <Typography className="dashboard-subtitle">
              Here's a summary of your progress and some recommended courses to
              keep the streak going.
            </Typography>
          </Box>
          <Box className="streak-card" onClick={() => navigate("/app/streak")}>
            <Box className="streak-icon">🔥</Box>
            <Box className="streak-info">
              <Typography className="streak-number">5</Typography>
              <Typography className="streak-label">Days Streak</Typography>
            </Box>
          </Box>
        </Box>

        {score && (
          <Box className="section">
            <Typography variant="h6" className="section-title">
              Quizzes Taken
            </Typography>

            <Box className="quiz-grid">
              <Box className="quiz-card">
                <Box className="quiz-card-header">
                  <Typography className="quiz-title">Agentic AI</Typography>
                  {scoreNum > 50 && (
                    <Box
                      className={`quiz-medal ${getBadge(
                        scoreNum
                      ).toLowerCase()}`}
                    >
                      🏅 <span>{getBadge(scoreNum)}</span>
                    </Box>
                  )}
                </Box>
                <Box className="quiz-score">
                  <Typography className="score-value">
                    {Number(score)}
                    <span className="score-max">/100</span>
                  </Typography>
                  <Typography className="score-label">Score</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        <Box className="section">
          <Typography variant="h6" className="section-title">
            Recommended Courses For You
          </Typography>

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
