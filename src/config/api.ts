// API Configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || "https://application-maker.onrender.com/api/",
} as const;

// Token storage keys
export const TOKEN_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
} as const;

// Storage utilities
export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEYS.accessToken);
  },

  setAccessToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEYS.accessToken, token);
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEYS.refreshToken);
  },

  setRefreshToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEYS.refreshToken, token);
  },

  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEYS.accessToken);
    localStorage.removeItem(TOKEN_KEYS.refreshToken);
  },

  setTokens: (accessToken: string, refreshToken: string): void => {
    tokenStorage.setAccessToken(accessToken);
    tokenStorage.setRefreshToken(refreshToken);
  },
};
