import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
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
import RecruitingDashboard from "./pages/Recruiting/RecruitingDashboard";
import Companies from "./pages/Recruiting/Companies";
import PreviewCompany from "./pages/Recruiting/PreviewCompany";
import Jobs from "./pages/Recruiting/Jobs";
import CreateJob from "./pages/Recruiting/CreateJob";
import PreviewJob from "./pages/Recruiting/PreviewJob";
import Users from "./pages/Recruiting/Users";
import Permissions from "./pages/Recruiting/Permissions";
import PreviewRole from "./pages/Recruiting/PreviewRole";
import RecommendedFields from "./pages/Recruiting/RecommendedFields";
import Applicants from "./pages/Recruiting/Applicants";
import ApplicantData from "./pages/Recruiting/ApplicantData";
import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Public Routes */}
          <Route path="/signin" element={<SignIn />} />

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

              {/* User Management */}
              <Route path="users" element={<Users />} />
              <Route path="permissions" element={<Permissions />} />
              <Route path="role/:id" element={<PreviewRole />} />
              <Route
                path="recommended-fields"
                element={<RecommendedFields />}
              />
              <Route path="applicants" element={<Applicants />} />
              <Route path="applicant/:id" element={<ApplicantData />} />

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
