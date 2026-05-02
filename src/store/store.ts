import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import companiesReducer from "./slices/companiesSlice";
import departmentsReducer from "./slices/departmentsSlice";
import jobPositionsReducer from "./slices/jobPositionsSlice";
import usersReducer from "./slices/usersSlice";
import rolesReducer from "./slices/rolesSlice";
import recommendedFieldsReducer from "./slices/SystemSettings";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    companies: companiesReducer,
    departments: departmentsReducer,
    jobPositions: jobPositionsReducer,
    users: usersReducer,
    roles: rolesReducer,
    recommendedFields: recommendedFieldsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
