import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import "./OnboardingCandidateContainer.scss";

type OnboardingModule = {
  module_no: number;
  title: string;
  description: string;
  passing_criteria: string;
  date: string;
  icon_path: string;
  status: "completed" | "in_progress" | "locked";
};

const createModuleIconPath = (
  moduleNo: number,
  background: string,
  primary: string,
  secondary: string
) => {
  const svg = `
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="56" height="56" rx="14" fill="${background}"/>
      <rect x="14" y="14" width="28" height="28" rx="10" fill="url(#paint0_linear)"/>
      <text x="28" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="white">${moduleNo}</text>
      <defs>
        <linearGradient id="paint0_linear" x1="14" y1="14" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stop-color="${primary}"/>
          <stop offset="1" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const onboardingModules: OnboardingModule[] = [
  {
    module_no: 1,
    title: "Welcome & Project Overview",
    description: "BCG overview, dual-laptop policy, office setup, and key onboarding expectations.",
    passing_criteria: "80",
    date: "2026-07-08",
    icon_path: createModuleIconPath(1, "#eef2ff", "#667eea", "#764ba2"),
    status: "in_progress",
  },
  {
    module_no: 2,
    title: "Who's Who & Org Structure",
    description: "Nagarro and BCG hierarchy, escalation paths, and stakeholder communication.",
    passing_criteria: "80",
    date: "",
    icon_path: createModuleIconPath(2, "#fce7f3", "#f093fb", "#f5576c"),
    status: "locked",
  },
  {
    module_no: 3,
    title: "Ways of Working & Tools",
    description: "Agile rituals, Slack, Jira, timesheets, leave process, and collaboration norms.",
    passing_criteria: "80",
    date: "",
    icon_path: createModuleIconPath(3, "#e0f2fe", "#4facfe", "#00f2fe"),
    status: "locked",
  },
  {
    module_no: 4,
    title: "Security & Compliance",
    description: "Data protection basics, secure access, client confidentiality, and policy checks.",
    passing_criteria: "80",
    date: "",
    icon_path: createModuleIconPath(4, "#fef3c7", "#f59e0b", "#f97316"),
    status: "locked",
  },
  {
    module_no: 5,
    title: "Delivery Quality Standards",
    description: "Definition of done, review expectations, documentation, and quality checkpoints.",
    passing_criteria: "80",
    date: "",
    icon_path: createModuleIconPath(5, "#dcfce7", "#43e97b", "#38f9d7"),
    status: "locked",
  },
  {
    module_no: 6,
    title: "Final Readiness Assessment",
    description: "Complete the final quiz and confirm readiness for project onboarding.",
    passing_criteria: "80",
    date: "",
    icon_path: createModuleIconPath(6, "#ffe4e6", "#fa709a", "#fee140"),
    status: "locked",
  },
];

const statusConfig = {
  completed: {
    label: "Completed",
    icon: <CheckCircleIcon />,
  },
  in_progress: {
    label: "In Progress",
    icon: <PlayCircleOutlineIcon />,
  },
  locked: {
    label: "Locked",
    icon: <LockIcon />,
  },
};

const formatModuleDate = (date: string) => {
  if (!date) return "Not started";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Not started";

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const OnboardingCandidateContainer = () => {
  const userEmail = localStorage.getItem("loggedInUser") || localStorage.getItem("userEmail");
  const userName = userEmail ? userEmail.split(".")[0].charAt(0).toUpperCase() + userEmail.split(".")[0].slice(1) : "User";

  const completedModules = onboardingModules.filter(
    (module) => module.status === "completed"
  ).length;
  const totalModules = onboardingModules.length;
  const remainingModules = totalModules - completedModules;
  const overallProgress = totalModules
    ? Math.round((completedModules / totalModules) * 100)
    : 0;

  return (
    <main className="onboarding-candidate-container">
      <section className="onboarding-hero">
        <div className="onboarding-shell">
          <Typography component="h1" className="onboarding-hero__title">
            Welcome back, {userName}
          </Typography>
          <Typography className="onboarding-hero__subtitle">
            Complete all {totalModules} modules at your own pace. Each module must
            be passed at 80% before the next unlocks.
          </Typography>
        </div>
      </section>

      <section className="onboarding-shell onboarding-content">
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
          {onboardingModules.map((module) => {
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
                  <div className="onboarding-module-card__top">
                    <span>Module {module.module_no}</span>
                    <img src={module.icon_path} alt="" aria-hidden="true" />
                  </div>

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
                    <span>{formatModuleDate(module.date)}</span>
                  </div>

                  <Button
                    disabled={isLocked}
                    className="onboarding-module-card__action"
                    fullWidth
                    variant="contained"
                  >
                    {module.status === "completed"
                      ? "Review Module"
                      : module.status === "in_progress"
                        ? "Continue Module"
                        : "Locked"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default OnboardingCandidateContainer;
