import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Typography,
} from "@mui/material";
import { AxiosError } from "axios";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
// EmailIcon is no longer needed since we use SMTP auto-email instead of mailto
import { useNavigate } from "react-router-dom";
import { onboardingModuleService } from "../../API/onboarding_module.service";
import type {
  EmployeeOnboardingProgressSummaryResponse,
  EmployeeModuleProgressSummaryItem,
} from "../../API/onboarding_module.model";
import "./OnboardingCandidateContainer.scss";

type ModuleItem = {
  id: number;
  module_no: number;
  title: string;
  description: string;
  passing_criteria: string;
  status: "completed" | "in_progress" | "locked" | "unlocked";
};

const statusConfig = {
  completed: {
    label: "Completed",
    icon: <CheckCircleIcon />,
  },
  in_progress: {
    label: "In Progress",
    icon: <PlayCircleOutlineIcon />,
  },
  unlocked: {
    label: "Unlocked",
    icon: <PlayCircleOutlineIcon />,
  },
  locked: {
    label: "Locked",
    icon: <LockIcon />,
  },
};

const mapSummaryModulesToUi = (
  module: EmployeeModuleProgressSummaryItem
): ModuleItem => {
  const rawStatus = (module.status || "LOCKED").toUpperCase();

  if (rawStatus === "COMPLETED") {
    return {
      id: module.module_id,
      module_no: module.rank,
      title: module.title,
      description: module.description || "",
      passing_criteria: String(Math.round(module.passing_criteria)),
      status: "completed",
    };
  }

  if (
    rawStatus === "QUIZ_IN_PROGRESS" ||
    rawStatus === "VIDEO_IN_PROGRESS" ||
    rawStatus === "VIDEO_COMPLETED"
  ) {
    if (module.is_unlocked) {
      return {
        id: module.module_id,
        module_no: module.rank,
        title: module.title,
        description: module.description || "",
        passing_criteria: String(Math.round(module.passing_criteria)),
        status: "in_progress",
      };
    }
    return {
      id: module.module_id,
      module_no: module.rank,
      title: module.title,
      description: module.description || "",
      passing_criteria: String(Math.round(module.passing_criteria)),
      status: "locked",
    };
  }

  if (module.is_unlocked) {
    return {
      id: module.module_id,
      module_no: module.rank,
      title: module.title,
      description: module.description || "",
      passing_criteria: String(Math.round(module.passing_criteria)),
      status: "unlocked",
    };
  }

  return {
    id: module.module_id,
    module_no: module.rank,
    title: module.title,
    description: module.description || "",
    passing_criteria: String(Math.round(module.passing_criteria)),
    status: "locked",
  };
};

const OnboardingCandidateContainer = () => {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalModules, setTotalModules] = useState(0);
  const [completedModules, setCompletedModules] = useState(0);
  const [remainingModules, setRemainingModules] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  /* Email is sent automatically via SMTP when all modules are completed, so these are no longer needed
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  */

  const userEmail = localStorage.getItem("loggedInUser") || localStorage.getItem("userEmail");
  const userName = userEmail ? userEmail.split(".")[0].charAt(0).toUpperCase() + userEmail.split(".")[0].slice(1) : "User";
  const candidateId = localStorage.getItem("candidateId") || "";

  /* Email is sent automatically via SMTP when all modules are completed, so this function is no longer needed
  const handleEmailProjectCoordinators = async () => {
    if (isSendingEmail || emailSent) return;
    setIsSendingEmail(true);
    try {
      const lastModule = modules.reduce((max, m) => (m.module_no > max.module_no ? m : max), modules[0]);
      const result = await onboardingModuleService.shareCertificateEmail(candidateId, lastModule.id);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data: EmployeeOnboardingProgressSummaryResponse = await onboardingModuleService.getEmployeeProgressSummary(candidateId);
        setTotalModules(data.total_modules);
        setCompletedModules(data.completed_modules);
        setRemainingModules(data.remaining_modules);
        setOverallProgress(data.overall_progress_percentage);

        const mapped = data.modules.map(mapSummaryModulesToUi);
        setModules(mapped);
      } catch (err) {
        if (err instanceof AxiosError) {
          setError(err.response?.data?.detail || "Failed to load onboarding modules");
        } else {
          setError("Failed to load onboarding modules");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [candidateId]);

  if (loading) {
    return (
      <Box className="onboarding-candidate-container" sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography sx={{ color: "#fff" }}>Loading modules...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="onboarding-candidate-container" sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography sx={{ color: "#fff" }}>{error}</Typography>
      </Box>
    );
  }

  const allCompleted = completedModules === totalModules && totalModules > 0;

  return (
    <main className="onboarding-candidate-container">
      <section className="onboarding-hero">
        <div className="onboarding-shell">
          <Typography component="h1" className="onboarding-hero__title">
            Welcome back, {userName}
          </Typography>
          {!allCompleted && (
            <Typography className="onboarding-hero__subtitle">
              Complete all {totalModules} modules at your own pace. Each module must
              be passed at 80% before the next unlocks.
            </Typography>
          )}
        </div>
      </section>

      <section className="onboarding-shell onboarding-content">
        {allCompleted ? (
          <Card className="onboarding-completion-card">
            <CardContent sx={{ textAlign: "center", py: 6 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 2 }}>
                All required onboarding modules have been completed successfully.
              </Typography>
               {/* Email is sent automatically via SMTP when all modules are completed, so this button is no longer needed */}
               {/*
               <Typography sx={{ mb: 4 }}>
                 If you have not yet notified your Project Coordinators, please use the
                 Email Project Coordinators button below
               </Typography>
               <Button
                 variant="contained"
                 size="large"
                 startIcon={<EmailIcon />}
                 onClick={handleEmailProjectCoordinators}
                 disabled={isSendingEmail || emailSent}
               >
                 {isSendingEmail ? "Opening Email..." : emailSent ? "Email Opened" : "Email Project Coordinators"}
               </Button>
               */}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="onboarding-stats-grid">
              <Card className="onboarding-stat-card">
                <CardContent>
                  <strong>{completedModules}</strong>
                  <span>Modules Completed</span>
                </CardContent>
              </Card>
              <Card className="onboarding-stat-card">
                <CardContent>
                  <strong>{overallProgress}%</strong>
                  <span>Overall Progress</span>
                </CardContent>
              </Card>
              <Card className="onboarding-stat-card">
                <CardContent>
                  <strong>{remainingModules}</strong>
                  <span>Modules Remaining</span>
                </CardContent>
              </Card>
            </div>

            <Card className="onboarding-progress-card">
              <CardContent>
                <Box className="onboarding-progress-card__header">
                  <Typography>Overall Progress</Typography>
                  <span>
                    {completedModules} of {totalModules} modules complete
                  </span>
                </Box>
                <LinearProgress variant="determinate" value={overallProgress} />
              </CardContent>
            </Card>

            <div className="onboarding-section-title">
              <Typography component="h2">Learning Modules</Typography>
              <span />
            </div>

            <div className="onboarding-module-grid">
              {modules.map((module) => {
                const config = statusConfig[module.status];
                const isLocked = module.status === "locked";

                return (
                  <Card
                    className={`onboarding-module-card ${
                      isLocked ? "onboarding-module-card--locked" : ""
                    }`}
                    key={module.module_no}
                  >
                    <CardContent>
                      <Typography component="h3" className="onboarding-module-card__title">
                        {module.title}
                      </Typography>
                      <Typography className="onboarding-module-card__description">
                        {module.description}
                      </Typography>

                      <div className="onboarding-module-card__criteria">
                        Passing criteria: <strong>{module.passing_criteria}%</strong>
                      </div>

                      <div className="onboarding-module-card__footer">
                        <Chip
                          icon={config.icon}
                          label={config.label}
                          className={`onboarding-status onboarding-status--${module.status}`}
                        />
                      </div>

                      <Button
                        disabled={isLocked}
                        className="onboarding-module-card__action"
                        fullWidth
                        variant="contained"
                        onClick={() => {
                          if (!isLocked) {
                            navigate(`/app/module-detail/${module.id}`);
                          }
                        }}
                      >
                        {module.status === "completed"
                          ? "Review Module"
                          : module.status === "in_progress"
                            ? "Continue Module"
                            : module.status === "unlocked"
                              ? "Start Module"
                              : "Locked"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default OnboardingCandidateContainer;
