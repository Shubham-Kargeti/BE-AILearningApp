import { Navigate } from "react-router-dom";
import { isOnboardingCandidate } from "../../utils/adminUsers";

type OnboardingRedirectProps = {
  to?: string;
  children?: React.ReactNode;
};

const OnboardingRedirect = ({ to = "/app/onboarding-candidate", children }: OnboardingRedirectProps) => {
  if (isOnboardingCandidate()) {
    return <Navigate to={to} replace />;
  }
  return children ? <>{children}</> : null;
};

export default OnboardingRedirect;
