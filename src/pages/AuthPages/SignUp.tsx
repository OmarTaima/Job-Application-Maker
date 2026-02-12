import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Saber Group - Hiring Management System - Sign Up Page"
        description="This is Saber Group - Hiring Management System - Sign Up Page"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
