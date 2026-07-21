import { useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { clearApplicationSession } from "../auth/appSession";
import Loader from "./Loader";

const Logout = () => {
  const { instance } = useMsal();

  useEffect(() => {
    // Clear the backend JWT first, then let MSAL clear its Microsoft account cache.
    clearApplicationSession();
    void instance.logoutRedirect({
      account: instance.getActiveAccount() ?? undefined,
      postLogoutRedirectUri: window.location.origin,
    });
  }, [instance]);

  return <Loader fullscreen message="Signing out of Microsoft..." />;
};

export default Logout;
