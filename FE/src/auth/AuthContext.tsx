import React, { createContext, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { msalConfig } from "./msalConfig";
import { authService } from "../API/services";
import { logger } from "../utils/logger";

interface AuthContextType {
  loginWithAzure: () => void;
  logout: () => Promise<void>;
  loading: boolean;
  exchangeToken: (idToken: string, username: string) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);

  const loginWithAzure = useCallback(() => {
    instance.loginRedirect({
      scopes: ["openid", "profile", "email"],
    });
  }, [instance]);

  const exchangeToken = useCallback(async (idToken: string, username: string) => {
    setLoading(true);
    logger.info("AuthContext", "exchangeToken started", { username, idTokenLength: idToken.length });
    try {
      const tokenResponse = await authService.azureLogin(idToken);
      logger.info("AuthContext", "azureLogin API response received", {
        hasAccessToken: !!tokenResponse.access_token,
        hasRefreshToken: !!tokenResponse.refresh_token,
        role: tokenResponse.role,
        candidate_id: tokenResponse.candidate_id,
      });

      if (tokenResponse.access_token) {
        localStorage.setItem("authToken", tokenResponse.access_token);
        logger.info("AuthContext", "Stored authToken in localStorage");
      }
      if (tokenResponse.refresh_token) {
        localStorage.setItem("refreshToken", tokenResponse.refresh_token);
        logger.info("AuthContext", "Stored refreshToken in localStorage");
      }
      if (tokenResponse.role) {
        localStorage.setItem("userRole", tokenResponse.role);
        logger.info("AuthContext", "Stored userRole in localStorage", { role: tokenResponse.role });
      }
      if (tokenResponse.candidate_id) {
        localStorage.setItem("candidateId", tokenResponse.candidate_id);
        logger.info("AuthContext", "Stored candidateId in localStorage", { candidateId: tokenResponse.candidate_id });
      }

      if (username) {
        localStorage.setItem("loggedInUser", username);
        logger.info("AuthContext", "Stored loggedInUser in localStorage", { username });
      }

      logger.info("AuthContext", "exchangeToken completed successfully");
    } catch (error) {
      logger.error("AuthContext", "Azure token exchange failed", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri,
      });
    } catch (error) {
      console.error("Azure AD logout failed:", error);
    } finally {
      localStorage.clear();
    }
  }, [instance]);

  return (
    <AuthContext.Provider value={{ loginWithAzure, logout, loading, exchangeToken }}>
      {children}
    </AuthContext.Provider>
  );
};
