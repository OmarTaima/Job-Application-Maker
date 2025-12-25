import { BrowserRouter as Router, Routes, Route } from "react-router";
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
import RecruitingDashboard from "./pages/Recruiting/RecruitingDashboard";
import Companies from "./pages/Recruiting/Companies";
import PreviewCompany from "./pages/Recruiting/PreviewCompany";
import JobCreation from "./pages/Recruiting/JobCreation";
import Jobs from "./pages/Recruiting/Jobs";
import CreateJob from "./pages/Recruiting/CreateJob";
import Users from "./pages/Recruiting/Users";
import Permissions from "./pages/Recruiting/Permissions";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="recruiting" element={<RecruitingDashboard />} />
            <Route path="companies" element={<Companies />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="create-job" element={<CreateJob />} />
            <Route path="company/:companyId" element={<PreviewCompany />} />
            <Route
              path="company/:companyId/create-job"
              element={<JobCreation />}
            />

            {/* User Management */}
            <Route path="users" element={<Users />} />
            <Route path="permissions" element={<Permissions />} />

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

          {/* Auth Layout */}
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
