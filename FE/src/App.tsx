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

import AdminProtectedRoute from "./components/adminProtectedRoute/AdminProtectedRoute";
import AdminDashboard from "./containers/AdminDashboard";
import AdminLayout from "./containers/AdminLayout";
import AdminAddCandidate from "./containers/AdminAddCandidate/AdminAddCandidate";
import AdminRequirement from "./containers/AdminRequirement/AdminRequirement";
import AdminSettings from "./containers/AdminSettings/AdminSettings";
import QuestionBankContainer from "./containers/QuestionBankContainer";
import LearningPathContainer from "./containers/LearningPathContainer/LearningPathContainer";
import LearningPathsContainer from "./containers/LearningPathsContainer/LearningPathsContainer";
import DetailedResultsView from "./containers/DetailedResultsView/DetailedResultsView";

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
          <Route path="learning-paths" element={<LearningPathsContainer />} />
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
          <Route path="assessment" element={<AssessmentSetupContainer />} />
          <Route path="assessment/:id/view" element={<AssessmentViewContainer />} />
          <Route path="assessment/:id/edit" element={<AssessmentSetupContainer />} />
          <Route path="questions" element={<QuestionBankContainer />} />
          <Route path="learning-path/:sessionId" element={<LearningPathContainer />} />
          <Route path="assessment-results/:sessionId" element={<DetailedResultsView />} />
          <Route path="add-candidate" element={<AdminAddCandidate />} />
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