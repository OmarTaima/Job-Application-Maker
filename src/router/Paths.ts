export const paths = {
  auth: {
    signIn: '/signin',
    signUp: '/signup',
  },

  dashboard: {
    home: '/',
  },

  recruiting: {
    root: '/recruiting',
    companySettings: '/recruiting/company-settings',
    interviewSettings: '/recruiting/interview-settings',
    savedFields: '/recruiting/saved-fields',
    savedFieldsCreate: '/recruiting/saved-fields/create',
    savedFieldsPreview: (fieldId: string) =>
      `/recruiting/saved-fields/preview/${fieldId}`,
    savedQuestions: '/recruiting/saved-questions',
  },

  companies: {
    root: '/companies',
    preview: (companyId: string) => `/company/${companyId}`,
    createJob: (companyId: string) => `/company/${companyId}/create-job`,
  },

  jobs: {
    root: '/jobs',
    create: '/create-job',
    preview: (jobId: string) => `/job/${jobId}`,
  },

  applicants: {
    root: '/applicants',
    mobile: '/applicants/mobile',
    mailPreview: '/applicants/mail-preview',
    page: (pageName: string) => `/applicants/page/${pageName}`,
    details: (id: string) => `/applicant-details/${id}`,
  },

  admin: {
    users: '/users',
    userAdd: '/user/add',
    userPreview: (id: string) => `/user/${id}`,
    userEdit: (id: string) => `/user/${id}/edit`,
    permissions: '/permissions',
    rolePreview: (id: string) => `/role/${id}`,
    recommendedFields: '/recommended-fields',
  },

  misc: {
    profile: '/profile',
    calendar: '/calendar',
    blank: '/blank',
    formElements: '/form-elements',
    basicTables: '/basic-tables',
    alerts: '/alerts',
    avatars: '/avatars',
    badge: '/badge',
    buttons: '/buttons',
    images: '/images',
    videos: '/videos',
    lineChart: '/line-chart',
    barChart: '/bar-chart',
  },
} as const;

export const patterns = {
  recruiting: {
    savedFieldsPreview: 'recruiting/saved-fields/preview/:fieldId',
  },

  companies: {
    preview: 'company/:companyId',
    createJob: 'company/:companyId/create-job',
  },

  jobs: {
    preview: 'job/:jobId',
  },

  applicants: {
    page: 'applicants/page/:pageName',
    details: 'applicant-details/:id',
  },

  admin: {
    userPreview: 'user/:id',
    userEdit: 'user/:id/edit',
    rolePreview: 'role/:id',
  },
} as const;
