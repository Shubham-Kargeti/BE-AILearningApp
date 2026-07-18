import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";

/**
 * The application-wide MSAL singleton.
 * A single instance keeps account selection, redirect processing, and the token cache
 * consistent for every component rendered beneath MsalProvider.
 */
export const msalInstance = new PublicClientApplication(msalConfig);

