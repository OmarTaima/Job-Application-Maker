import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import RecruitingDashboard from "./pages/Recruiting/companies/createCompany";
import Companies from "./pages/Recruiting/companies/Companies";
import PreviewCompany from "./pages/Recruiting/companies/PreviewCompany";
import Jobs from "./pages/Recruiting/jobs/Jobs";
import CreateJob from "./pages/Recruiting/jobs/CreateJob";
import PreviewJob from "./pages/Recruiting/jobs/PreviewJob";
import Users from "./pages/Recruiting/users/Users";
import EditUser from "./pages/Recruiting/users/EditUser";
import Permissions from "./pages/Recruiting/roles/Permissions";
import PreviewRole from "./pages/Recruiting/roles/PreviewRole";
import PreviewUser from "./pages/Recruiting/users/PreviewUser";
import RecommendedFields from "./pages/Recruiting/systemSettings/RecommendedFields";
import Applicants from "./pages/Recruiting/applicants/Applicants";
import ApplicantData from "./pages/Recruiting/applicants/ApplicantData";
import CVPreview from "./pages/Recruiting/applicants/CVPreview";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PermissionProtectedRoute from "./components/auth/PermissionProtectedRoute";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
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
              <Route
                path="company/:companyId/create-job"
                element={<CreateJob />}
              />
              <Route path="applicants" element={<Applicants />} />
              <Route path="applicant/:id" element={<ApplicantData />} />
              <Route path="applicant/:id/cv" element={<CVPreview />} />

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
      </Router>
    </>
  );
}
