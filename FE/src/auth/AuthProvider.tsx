import { useEffect, useState, type ReactNode } from "react";
import { Alert, Box, Button } from "@mui/material";
import axios from "axios";
import { MsalProvider, useMsal } from "@azure/msal-react";
import Loader from "../components/Loader";
import { authService } from "../API/services";
import { getAuthConfigurationError, loginRequest } from "./authConfig";
import { hasApplicationSession, saveApplicationSession } from "./appSession";
import { msalInstance } from "./msalInstance";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Keeps MSAL's active account aligned with the accounts restored from its own cache.
 * No account details are copied into application storage or a custom React context.
 */
const ActiveAccountSynchronizer = ({ children }: AuthProviderProps) => {
  const { instance, accounts } = useMsal();

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  return children;
};

/**
 * Initializes the MSAL singleton and completes any Azure redirect before rendering
 * routes. The loading and error screens prevent route guards from making decisions
 * while redirect state is still being processed.
 */
const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeAuthentication = async () => {
      const configurationError = getAuthConfigurationError();
      if (configurationError) {
        if (isMounted) setAuthError(configurationError);
        return;
      }

      try {
        await msalInstance.initialize();
        const redirectResult = await msalInstance.handleRedirectPromise();
        const restoredAccount =
          redirectResult?.account ??
          msalInstance.getActiveAccount() ??
          msalInstance.getAllAccounts()[0];

        if (restoredAccount) {
          msalInstance.setActiveAccount(restoredAccount);

          // Reuse the ID token returned by loginRedirect. On a later page reload,
          // acquireTokenSilent obtains a valid cached/refreshed result from MSAL.
          if (!hasApplicationSession()) {
            const authenticationResult =
              redirectResult ??
              (await msalInstance.acquireTokenSilent({
                scopes: loginRequest.scopes,
                account: restoredAccount,
              }));

            if (!authenticationResult.idToken) {
              throw new Error("Microsoft did not return an ID token for the session exchange.");
            }

            const applicationSession = await authService.exchangeAzureToken(
              authenticationResult.idToken,
            );
            saveApplicationSession(applicationSession);
          }
        }

        if (isMounted) setIsReady(true);
      } catch (error) {
        const backendMessage = axios.isAxiosError(error)
          ? error.response?.data?.detail
          : undefined;
        const message =
          backendMessage ||
          (error instanceof Error ? error.message : "Unknown authentication error.");
        if (isMounted) {
          setAuthError(`Sign-in could not create an application session: ${message}`);
        }
      }
    };

    void initializeAuthentication();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authError) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
          sx={{ maxWidth: 760 }}
        >
          {authError}
        </Alert>
      </Box>
    );
  }

  if (!isReady) {
    return <Loader fullscreen message="Completing Microsoft sign-in..." />;
  }

  return (
    <MsalProvider instance={msalInstance}>
      <ActiveAccountSynchronizer>{children}</ActiveAccountSynchronizer>
    </MsalProvider>
  );
};

export default AuthProvider;
