import axios from "axios";
import {  tokenStorage } from "./api";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhance error with detailed validation messages
    if (error.response) {
      const { data } = error.response;
      
      // Create a user-friendly error message
      let errorMessage = 'An error occurred';
      
      // Check for Joi validation errors (details array)
      if (data?.details && Array.isArray(data.details)) {
        errorMessage = data.details
          .map((detail: any) => {
            const field = detail.path?.join('.') || detail.context?.key || '';
            const message = detail.message || '';
            return field ? `${field}: ${message}` : message;
          })
          .join('\n');
      }
      // Check for express-validator errors
      else if (data?.errors && Array.isArray(data.errors)) {
        errorMessage = data.errors
          .map((e: any) => {
            const field = e.param || e.path || '';
            const message = e.msg || e.message || '';
            return field ? `${field}: ${message}` : message;
          })
          .join('\n');
      }
      // Standard error message
      else if (data?.message) {
        errorMessage = data.message;
      }
      
      // Attach enhanced message to error
      error.message = errorMessage;
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
