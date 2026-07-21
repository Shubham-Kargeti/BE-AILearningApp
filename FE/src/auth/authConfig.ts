import type { Configuration, RedirectRequest } from "@azure/msal-browser";

// Vite exposes only variables prefixed with VITE_ to browser-side code.
const clientId = import.meta.env.VITE_CLIENT_ID?.trim() ?? "";
const tenantId = import.meta.env.VITE_TENANT_ID?.trim() ?? "";

// Azure must have this exact origin registered as a Single-page application redirect URI.
const applicationOrigin = window.location.origin;

/**
 * MSAL configuration for this single-tenant React SPA.
 * localStorage matches the application's existing browser token storage behavior and
 * lets MSAL restore the signed-in account across tabs and browser restarts.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: applicationOrigin,
    postLogoutRedirectUri: applicationOrigin,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

// User.Read is the delegated Microsoft Graph permission requested during sign-in.
export const loginRequest: RedirectRequest = {
  scopes: ["User.Read"],
};

/**
 * Return a user-facing setup error before MSAL starts if required Vite values are absent.
 * Client IDs and tenant IDs are public application identifiers, not client secrets.
 */
export const getAuthConfigurationError = (): string | null => {
  const missingVariables = [
    !clientId && "VITE_CLIENT_ID",
    !tenantId && "VITE_TENANT_ID",
  ].filter(Boolean);

  if (missingVariables.length === 0) return null;

  return `Azure AD authentication is not configured. Set ${missingVariables.join(
    " and ",
  )} in FE/.env and restart the Vite server.`;
};
