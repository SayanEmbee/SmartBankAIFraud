// Microsoft Entra ID (Azure AD) configuration settings

export const msalConfig = {
  auth: {
    clientId: "ec3d584e-b6d5-4e68-8bd0-20958496b6bb", // RMSI Application Client ID
    authority: "https://login.microsoftonline.com/718a9912-4d8d-4d9d-af9a-abe3dca42cb2", // RMSI Tenant ID
    redirectUri: window.location.origin, // Returns directly to active dashboard
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "sessionStorage", // High-security memory cache
    storeAuthStateInCookie: false,
  }
};

// Default Microsoft profile read scopes
export const loginRequest = {
  scopes: ["User.Read"]
};
