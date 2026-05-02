import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { Suspense, lazy } from 'react';
import { ScrollToTop } from '../components/common/ScrollToTop';
import ProtectedRoute from './ProtectedRoute';
import PermissionProtectedRoute from './PermissionProtectedRoute';
import { paths, patterns } from './Paths';

const SignIn = lazy(() => import('../pages/AuthPages/SignIn'));
const SignUp = lazy(() => import('../pages/AuthPages/SignUp'));
const NotFound = lazy(() => import('../pages/OtherPage/NotFound'));
const AppLayout = lazy(() => import('../layout/AppLayout'));
const Home = lazy(() => import('../pages/Dashboard/Home'));

// Recruiting
const CreateCompany = lazy(
  () => import('../pages/Recruiting/companies/createCompany')
);
const Companies = lazy(() => import('../pages/Recruiting/companies/Companies'));
const PreviewCompany = lazy(
  () => import('../pages/Recruiting/companies/PreviewCompany')
);
const CompanySettingsPage = lazy(
  () => import('../pages/Recruiting/companies/companysettings')
);
const InterviewCompanySettingsPage = lazy(
  () => import('../pages/Recruiting/Settings/interviewCompany')
);
const SavedQuestions = lazy(
  () => import('../pages/Recruiting/Settings/interviewPerUser')
);

// Jobs
const Jobs = lazy(() => import('../pages/Recruiting/jobs/Jobs'));
const CreateJob = lazy(() => import('../pages/Recruiting/jobs/CreateJob'));
const PreviewJob = lazy(() => import('../pages/Recruiting/jobs/PreviewJob'));

// Applicants
const Applicants = lazy(
  () => import('../pages/Recruiting/applicants/Table/ApplicantsTable')
);
const ApplicantDynamicPage = lazy(
  () => import('../pages/Recruiting/applicants/Table/ApplicantDynamicPage')
);
const ApplicantData = lazy(
  () => import('../pages/Recruiting/applicants/ApplicantPage/ApplicantData')
);
const MailPreview = lazy(
  () => import('../pages/Recruiting/applicants/MailPreview')
);

// Saved Fields
const SavedFields = lazy(
  () => import('../pages/Recruiting/savedFields/SavedFields')
);
const SavedFieldsPreview = lazy(
  () => import('../pages/Recruiting/savedFields/SavedFieldsPreview')
);
const CreateSavedField = lazy(
  () => import('../pages/Recruiting/savedFields/CreateSavedField')
);

// Admin
const Users = lazy(() => import('../pages/Recruiting/users/Users'));
const CreateUser = lazy(() => import('../pages/Recruiting/users/CreateUser'));
const EditUser = lazy(() => import('../pages/Recruiting/users/EditUser'));
const PreviewUser = lazy(() => import('../pages/Recruiting/users/PreviewUser'));
const Permissions = lazy(() => import('../pages/Recruiting/roles/Permissions'));
const PreviewRole = lazy(() => import('../pages/Recruiting/roles/PreviewRole'));
const RecommendedFields = lazy(
  () => import('../pages/Recruiting/systemSettings/RecommendedFields')
);

// Misc
const UserProfiles = lazy(() => import('../pages/UserProfiles'));
const Calendar = lazy(() => import('../pages/Calendar'));
const Blank = lazy(() => import('../pages/Blank'));
const FormElements = lazy(() => import('../pages/Forms/FormElements'));
const BasicTables = lazy(() => import('../pages/Tables/BasicTables'));
const Alerts = lazy(() => import('../pages/UiElements/Alerts'));
const Avatars = lazy(() => import('../pages/UiElements/Avatars'));
const Badges = lazy(() => import('../pages/UiElements/Badges'));
const Buttons = lazy(() => import('../pages/UiElements/Buttons'));
const Images = lazy(() => import('../pages/UiElements/Images'));
const Videos = lazy(() => import('../pages/UiElements/Videos'));
const LineChart = lazy(() => import('../pages/Charts/LineChart'));
const BarChart = lazy(() => import('../pages/Charts/BarChart'));

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          {/* Public Routes */}
          <Route path={paths.auth.signIn} element={<SignIn />} />
          <Route path={paths.auth.signUp} element={<SignUp />} />
          <Route
            path="/"
            element={<Navigate to={paths.auth.signIn} replace />}
          />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Home />} />

              {/* Recruiting */}
              <Route path={paths.recruiting.root} element={<CreateCompany />} />
              <Route
                path={paths.recruiting.companySettings}
                element={<CompanySettingsPage />}
              />
              <Route
                path={paths.recruiting.savedFields}
                element={<SavedFields />}
              />
              <Route
                path={paths.recruiting.savedFieldsCreate}
                element={<CreateSavedField />}
              />
              <Route
                path={patterns.recruiting.savedFieldsPreview}
                element={<SavedFieldsPreview />}
              />
              <Route
                path={paths.recruiting.savedQuestions}
                element={<SavedQuestions />}
              />
              <Route
                element={
                  <PermissionProtectedRoute
                    requiredPermissions={[
                      'Interview Settings Management',
                      'Company Management',
                      'Settings Management',
                    ]}
                    accessLevel="read"
                  />
                }
              >
                <Route
                  path={paths.recruiting.interviewSettings}
                  element={<InterviewCompanySettingsPage />}
                />
              </Route>

              {/* Companies */}
              <Route path={paths.companies.root} element={<Companies />} />
              <Route path={patterns.companies.preview} element={<PreviewCompany />} />
              <Route
                path={patterns.companies.createJob}
                element={<CreateJob />}
              />

              {/* Jobs */}
              <Route path={paths.jobs.root} element={<Jobs />} />
              <Route path={paths.jobs.create} element={<CreateJob />} />
              <Route path={patterns.jobs.preview} element={<PreviewJob />} />

              {/* Applicants */}
              <Route path={paths.applicants.root} element={<Applicants />} />
              <Route
                path={patterns.applicants.page}
                element={<ApplicantDynamicPage />}
              />
              <Route
                path={patterns.applicants.details}
                element={<ApplicantData />} />
              <Route
                element={
                  <PermissionProtectedRoute
                    requiredPermissions={['Mail Management']}
                    accessLevel="read"
                  />
                }
              >
                <Route
                  path={paths.applicants.mailPreview}
                  element={<MailPreview />}
                />
              </Route>

              {/* Admin */}
              <Route
                element={
                  <PermissionProtectedRoute
                    requiredPermissions={[
                      'User Management',
                      'Role Management',
                      'Settings Management',
                    ]}
                    requireAll={false}
                  />
                }
              >
                <Route path={paths.admin.users} element={<Users />} />
                <Route path={paths.admin.userAdd} element={<CreateUser />} />
                <Route path={patterns.admin.userPreview} element={<PreviewUser />} />
                <Route path={patterns.admin.userEdit} element={<EditUser />} />
                <Route
                  path={paths.admin.permissions}
                  element={<Permissions />}
                />
                <Route path={patterns.admin.rolePreview} element={<PreviewRole />} />
                <Route
                  path={paths.admin.recommendedFields}
                  element={<RecommendedFields />}
                />
              </Route>

              {/* Misc */}
              <Route path={paths.misc.profile} element={<UserProfiles />} />
              <Route path={paths.misc.calendar} element={<Calendar />} />
              <Route path={paths.misc.blank} element={<Blank />} />
              <Route
                path={paths.misc.formElements}
                element={<FormElements />}
              />
              <Route path={paths.misc.basicTables} element={<BasicTables />} />
              <Route path={paths.misc.alerts} element={<Alerts />} />
              <Route path={paths.misc.avatars} element={<Avatars />} />
              <Route path={paths.misc.badge} element={<Badges />} />
              <Route path={paths.misc.buttons} element={<Buttons />} />
              <Route path={paths.misc.images} element={<Images />} />
              <Route path={paths.misc.videos} element={<Videos />} />
              <Route path={paths.misc.lineChart} element={<LineChart />} />
              <Route path={paths.misc.barChart} element={<BarChart />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
