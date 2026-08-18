import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import AdminOnboardingModule from "./containers/AdminOnboardingModule/AdminOnboardingModule";
import AdminOnboardingQuizUpload from "./containers/AdminOnboardingQuizUpload/AdminOnboardingQuizUpload";
import AdminOnboardingKeyConceptUpload from "./containers/AdminOnboardingKeyConceptUpload/AdminOnboardingKeyConceptUpload";
import AdminOnboardingModulesUpload from "./containers/AdminOnboardingModulesUpload/AdminOnboardingModulesUpload";
import AdminCandidateList from "./containers/AdminCandidateList/AdminCandidateList";
import AdminRequirement from "./containers/AdminRequirement/AdminRequirement";
import AdminSettings from "./containers/AdminSettings/AdminSettings";
import QuestionBankContainer from "./containers/QuestionBankContainer";
import LearningPathContainer from "./containers/LearningPathContainer/LearningPathContainer";
import AdminLearningPathsContainer from "./containers/AdminLearningPathsContainer/AdminLearningPathsContainer";
//import LearningPathsContainer from "./containers/LearningPathsContainer/LearningPathsContainer";
import DetailedResultsView from "./containers/DetailedResultsView/DetailedResultsView";
import AdminAssessmentLandingContainer from "./containers/AdminAssessmentLandingContainer/AdminAssessmentLandingContainer";
import Logout from "./components/Logout";

function App() {
  return (
    <BrowserRouter>
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
          {/*<Route path="learning-paths" element={<LearningPathsContainer />} /> */}
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
          {/* <Route path="assessment" element={<AssessmentSetupContainer />} /> */}
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
          <Route path="onboarding-module" element={<AdminOnboardingModule />} />
          <Route path="onboarding-quiz-upload" element={<AdminOnboardingQuizUpload />} />
          <Route path="onboarding-modules-upload" element={<AdminOnboardingModulesUpload />} />
          <Route path="onboarding-keyconcepts-upload" element={<AdminOnboardingKeyConceptUpload />} />
          <Route path="candidate-list" element={<AdminCandidateList />} />
          <Route path="requirement" element={<AdminRequirement />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="/logout" element={<Logout />} />
        <Route path="/candidate-assessment/:assessmentId" element={<CandidateAssessmentContainer />} />
        <Route path="/candidate-quiz" element={<QuizContainer />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
