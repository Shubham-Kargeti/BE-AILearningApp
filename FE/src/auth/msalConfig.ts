import type { Configuration } from "@azure/msal-browser";
import { LogLevel } from "@azure/msal-browser";

const azureAdClientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID || "aa5c0fe6-8018-425c-8979-83effe1f8d82";
const redirectUri = import.meta.env.VITE_AZURE_AD_REDIRECT_URI || window.location.origin;
const postLogoutRedirectUri = import.meta.env.VITE_AZURE_AD_POST_LOGOUT_REDIRECT_URI || window.location.origin;
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID || "699bb2f4-7783-4702-9e22-5b35bbd558e3";

export const msalConfig: Configuration = {
  auth: {
    clientId: azureAdClientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error(message);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};
