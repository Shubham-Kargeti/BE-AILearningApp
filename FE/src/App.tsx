import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useContext, useState, useRef } from "react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./auth";
import { isAdmin } from "./utils/adminUsers";
import { logger } from "./utils/logger";
import LoginContainer from "./containers/LoginContainer/LoginContainer";
import SignUpContainer from "./containers/SignUpContainer/SignUpContainer";
import ProfileSetupContainer from "./containers/ProfileSetupContainer/ProfileSetupContainer";
import AppLandingContainer from "./containers/AppLandingContainer/AppLandingContainer";
import DashboardContainer from "./containers/DashboardContainer/DashboardContainer";
import LandingPage from "./containers/LandingPage/LandingPage";
import QuizContainer from "./containers/QuizContainer/QuizContainer";
import { client } from "./urlRoutes/client";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedProfileQuizRoute from "./components/ProtectedProfileQuizRoute";
import ProtectedAuthRoute from "./components/ProtectedAuthRoute";
import StreakContainer from "./containers/StreakContainer";
import AssessmentSetupContainer from "./containers/AssessmentSetupContainer";
import AssessmentViewContainer from "./containers/AssessmentViewContainer/AssessmentViewContainer";
import CandidateAssessmentContainer from "./containers/CandidateAssessmentContainer";
import AssessmentsListContainer from "./containers/AssessmentsListContainer/AssessmentsListContainer";
import SettingsContainer from "./containers/SettingsContainer/SettingsContainer";
import EmployeeLearningPath from "./containers/LearningPathsContainer/EmployeeLearningPath";
import OnboardingCandidateContainer from "./containers/OnboardingCandidateContainer";
import ModuleDetailContainer from "./containers/ModuleDetailContainer";
import CertificateContainer from "./containers/CertificateContainer";
import AdminProtectedRoute from "./components/adminProtectedRoute/AdminProtectedRoute";
import AdminDashboard from "./containers/AdminDashboard";
import AdminLayout from "./containers/AdminLayout";
import AdminAddCandidate from "./containers/AdminAddCandidate/AdminAddCandidate";
import AdminCandidateList from "./containers/AdminCandidateList/AdminCandidateList";
import AdminRequirement from "./containers/AdminRequirement/AdminRequirement";
import AdminSettings from "./containers/AdminSettings/AdminSettings";
import QuestionBankContainer from "./containers/QuestionBankContainer";
import LearningPathContainer from "./containers/LearningPathContainer/LearningPathContainer";
import AdminLearningPathsContainer from "./containers/AdminLearningPathsContainer/AdminLearningPathsContainer";
import DetailedResultsView from "./containers/DetailedResultsView/DetailedResultsView";
import AdminAssessmentLandingContainer from "./containers/AdminAssessmentLandingContainer/AdminAssessmentLandingContainer";
import Logout from "./components/Logout";
import Loader from "./components/Loader";

function App() {
  const { instance, inProgress } = useMsal();
  const navigate = useNavigate();
  const { exchangeToken } = useContext(AuthContext);
  const [isHandlingRedirect, setIsHandlingRedirect] = useState(true);
  const hasHandledRedirect = useRef(false);
  const location = useLocation();

  useEffect(() => {
    logger.info("App", "Route changed", { path: location.pathname });
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        const logs = logger.exportLogs();
        const blob = new Blob([logs], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `logs_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Logs downloaded");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    logger.info("App", "MSAL inProgress changed", { inProgress });
    if (inProgress !== "none") {
      logger.info("App", "MSAL is not idle yet, waiting before handling redirect", { inProgress });
      return;
    }
    if (hasHandledRedirect.current) {
      logger.info("App", "Redirect already handled, skipping");
      setIsHandlingRedirect(false);
      return;
    }

    let cancelled = false;
    hasHandledRedirect.current = true;

    const handleRedirect = async () => {
      try {
        logger.info("App", "Calling handleRedirectPromise");
        const response = await instance.handleRedirectPromise();
        logger.info("App", "handleRedirectPromise completed", { hasResponse: !!response });

        if (cancelled) {
          logger.warn("App", "Redirect handling cancelled");
          return;
        }

        if (response) {
          instance.setActiveAccount(response.account);
          const userEmail = response.account?.username || "";
          logger.info("App", "Processing SSO response", { userEmail, account: response.account });

          await exchangeToken(response.idToken, userEmail);
          logger.info("App", "exchangeToken completed");

          const profileCompleted = localStorage.getItem("profileCompleted") === "true";
          logger.info("App", "Profile completed check", { profileCompleted });

          const destination = isAdmin(userEmail)
            ? "/admin/dashboard"
            : profileCompleted
            ? "/app/dashboard"
            : "/app/profile-setup";

          logger.info("App", "Navigating to destination", { destination, userEmail });
          navigate(destination, { replace: true });
        } else {
          logger.info("App", "No redirect response to handle");
        }
      } catch (error: any) {
        const errorCode = error?.errorCode || error?.code || "";
        logger.error("App", "Azure redirect handling failed", { message: error?.message, errorCode });

        if (errorCode === "uninitialized_public_client_application") {
          logger.warn("App", "MSAL not initialized yet, will retry when idle");
          hasHandledRedirect.current = false;
        }
      } finally {
        if (!cancelled) {
          setIsHandlingRedirect(false);
        }
      }
    };

    handleRedirect();

    return () => {
      cancelled = true;
    };
  }, [inProgress, instance, exchangeToken, navigate]);

  const isMsalBusy = inProgress && inProgress !== "none";

  if (isMsalBusy || isHandlingRedirect) {
    logger.info("App", "Showing loading screen", { inProgress, isHandlingRedirect });
    return <Loader fullscreen message="Signing you in..." />;
  }

  logger.info("App", "Rendering routes");

  return (
    <Routes>

      <Route path={client.HOME} element={<LandingPage />} />

      <Route
        path={client.LOGIN}
        element={
          <ProtectedAuthRoute>
            <LoginContainer />
          </ProtectedAuthRoute>
        }
      />

      <Route
        path={client.SIGNUP}
        element={
          <ProtectedAuthRoute>
            <SignUpContainer />
          </ProtectedAuthRoute>
        }
      />

      <Route
        path="app"
        element={
          <ProtectedRoute>
            <AppLandingContainer />
          </ProtectedRoute>
        }
      >
        <Route path={client.PROFILE_SETUP} element={<ProfileSetupContainer />} />
        <Route path={client.DASHBOARD} element={<DashboardContainer />} />
        <Route path={client.STREAK} element={<StreakContainer />} />
        <Route path={client.SETTINGS} element={<SettingsContainer />} />
        <Route path={client.ASSESSMENTS} element={<AssessmentsListContainer />} />
        <Route path={client.ONBOARDING_CANDIDATE} element={<OnboardingCandidateContainer />} />
        <Route path={client.MODULE_DETAIL} element={<ModuleDetailContainer />} />
        <Route path={client.CERTIFICATE} element={<CertificateContainer />} />
        <Route path="learning-paths" element={<EmployeeLearningPath />} />
        <Route path="learning-paths/:learningPathId" element={<EmployeeLearningPath />} />
      </Route>

      <Route
        path={client.QUIZ}
        element={
          <ProtectedProfileQuizRoute>
            <QuizContainer />
          </ProtectedProfileQuizRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="assessment" element={<AdminAssessmentLandingContainer />} />
        <Route path="assessment/setup" element={<AssessmentSetupContainer />} />
        <Route path="assessment/:id/view" element={<AssessmentViewContainer />} />
        <Route path="assessment/:id/edit" element={<AssessmentSetupContainer />} />
        <Route path="questions" element={<QuestionBankContainer />} />
        <Route path="learning-path/:sessionId" element={<LearningPathContainer />} />
        <Route path="learning-paths/assigned" element={<AdminLearningPathsContainer />} />
        <Route path="learning-paths/assigned/:employeeEmail" element={<AdminLearningPathsContainer />} />
        <Route path="learning-paths/assigned/:employeeEmail/:learningPathId" element={<AdminLearningPathsContainer />} />
        <Route path="assessment-results/:sessionId" element={<DetailedResultsView />} />
        <Route path="add-candidate" element={<AdminAddCandidate />} />
        <Route path="candidate-list" element={<AdminCandidateList />} />
        <Route path="requirement" element={<AdminRequirement />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="/logout" element={<Logout />} />
      <Route path="/candidate-assessment/:assessmentId" element={<CandidateAssessmentContainer />} />
      <Route path="/candidate-quiz" element={<QuizContainer />} />

    </Routes>
  );
}

export default App;
