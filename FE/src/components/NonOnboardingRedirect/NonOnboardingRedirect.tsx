import { Navigate } from "react-router-dom";
import { isOnboardingCandidate } from "../../utils/adminUsers";

type NonOnboardingRedirectProps = {
  to?: string;
  children?: React.ReactNode;
};

const NonOnboardingRedirect = ({ to = "/app/dashboard", children }: NonOnboardingRedirectProps) => {
  if (isOnboardingCandidate()) {
    return children ? <>{children}</> : null;
  }
  return <Navigate to={to} replace />;
};

export default NonOnboardingRedirect;
