import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { Suspense, lazy } from "react";
const SignIn = lazy(() => import("./pages/AuthPages/SignIn"));
const SignUp = lazy(() => import("./pages/AuthPages/SignUp"));
const NotFound = lazy(() => import("./pages/OtherPage/NotFound"));
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const Videos = lazy(() => import("./pages/UiElements/Videos"));
const Images = lazy(() => import("./pages/UiElements/Images"));
const Alerts = lazy(() => import("./pages/UiElements/Alerts"));
const Badges = lazy(() => import("./pages/UiElements/Badges"));
const Avatars = lazy(() => import("./pages/UiElements/Avatars"));
const Buttons = lazy(() => import("./pages/UiElements/Buttons"));
const LineChart = lazy(() => import("./pages/Charts/LineChart"));
const BarChart = lazy(() => import("./pages/Charts/BarChart"));
const Calendar = lazy(() => import("./pages/Calendar"));
const BasicTables = lazy(() => import("./pages/Tables/BasicTables"));
const FormElements = lazy(() => import("./pages/Forms/FormElements"));
const Blank = lazy(() => import("./pages/Blank"));
const AppLayout = lazy(() => import("./layout/AppLayout"));
import { ScrollToTop } from "./components/common/ScrollToTop";
const Home = lazy(() => import("./pages/Dashboard/Home"));
const RecruitingDashboard = lazy(() => import("./pages/Recruiting/companies/createCompany"));
const Companies = lazy(() => import("./pages/Recruiting/companies/Companies"));
const PreviewCompany = lazy(() => import("./pages/Recruiting/companies/PreviewCompany"));
const CompanySettingsPage = lazy(() => import("./pages/Recruiting/companies/companysettings"));
const Jobs = lazy(() => import("./pages/Recruiting/jobs/Jobs"));
const CreateJob = lazy(() => import("./pages/Recruiting/jobs/CreateJob"));
const PreviewJob = lazy(() => import("./pages/Recruiting/jobs/PreviewJob"));
const Users = lazy(() => import("./pages/Recruiting/users/Users"));
const EditUser = lazy(() => import("./pages/Recruiting/users/EditUser"));
const Permissions = lazy(() => import("./pages/Recruiting/roles/Permissions"));
const PreviewRole = lazy(() => import("./pages/Recruiting/roles/PreviewRole"));
const PreviewUser = lazy(() => import("./pages/Recruiting/users/PreviewUser"));
const RecommendedFields = lazy(() => import("./pages/Recruiting/systemSettings/RecommendedFields"));
const SavedFields = lazy(() => import("./pages/Recruiting/savedFields/SavedFields"));
const SavedFieldsPreview = lazy(() => import("./pages/Recruiting/savedFields/savedfieldspreview"));
const CreateSavedField = lazy(() => import("./pages/Recruiting/savedFields/createSavedfield"));
const Applicants = lazy(() => import("./pages/Recruiting/applicants/Applicants"));
const ApplicantData = lazy(() => import("./pages/Recruiting/applicants/ApplicantData"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PermissionProtectedRoute from "./components/auth/PermissionProtectedRoute";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Suspense fallback={<div className="min-h-screen" />}>
          <Routes>
          {/* Public Routes */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/" element={<Navigate to="/signin" replace />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            {/* Dashboard Layout */}
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />
              <Route path="recruiting" element={<RecruitingDashboard />} />
              <Route path="companies" element={<Companies />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="create-job" element={<CreateJob />} />
              <Route path="job/:jobId" element={<PreviewJob />} />
              <Route path="company/:companyId" element={<PreviewCompany />} />
              <Route path="recruiting/company-settings" element={<CompanySettingsPage />} />
              <Route
                path="company/:companyId/create-job"
                element={<CreateJob />}
              />
              <Route path="applicants" element={<Applicants />} />
              <Route path="applicant/:id" element={<ApplicantData />} />
              <Route path="recruiting/saved-fields" element={<SavedFields />} />
              <Route path="recruiting/saved-fields/preview/:fieldId" element={<SavedFieldsPreview />} />
              <Route path="recruiting/saved-fields/create" element={<CreateSavedField />} />

              {/* Admin Routes - Protected by permissions */}
              <Route
                element={
                  <PermissionProtectedRoute
                    requiredPermissions={[
                      "User Management",
                      "Role Management",
                      "Settings Management",
                    ]}
                    requireAll={false}
                  />
                }
              >
                <Route path="users" element={<Users />} />
                <Route path="user/:id" element={<PreviewUser />} />
                <Route path="user/:id/edit" element={<EditUser />} />
                <Route path="permissions" element={<Permissions />} />
                <Route path="role/:id" element={<PreviewRole />} />
                <Route
                  path="recommended-fields"
                  element={<RecommendedFields />}
                />
              </Route>

              {/* Others Page */}
              <Route path="profile" element={<UserProfiles />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="blank" element={<Blank />} />

              {/* Forms */}
              <Route path="form-elements" element={<FormElements />} />

              {/* Tables */}
              <Route path="basic-tables" element={<BasicTables />} />

              {/* Ui Elements */}
              <Route path="alerts" element={<Alerts />} />
              <Route path="avatars" element={<Avatars />} />
              <Route path="badge" element={<Badges />} />
              <Route path="buttons" element={<Buttons />} />
              <Route path="images" element={<Images />} />
              <Route path="videos" element={<Videos />} />

              {/* Charts */}
              <Route path="line-chart" element={<LineChart />} />
              <Route path="bar-chart" element={<BarChart />} />
            </Route>
          </Route>

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}
