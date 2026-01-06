import { configureStore } from "@reduxjs/toolkit";
import applicantsReducer from "./slices/applicantsSlice";
import companiesReducer from "./slices/companiesSlice";
import departmentsReducer from "./slices/departmentsSlice";
import jobPositionsReducer from "./slices/jobPositionsSlice";
import usersReducer from "./slices/usersSlice";
import rolesReducer from "./slices/rolesSlice";
import recommendedFieldsReducer from "./slices/recommendedFieldsSlice";

export const store = configureStore({
  reducer: {
    applicants: applicantsReducer,
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
