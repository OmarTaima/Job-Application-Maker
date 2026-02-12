import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Saber Group - Hiring Management System - Sign In Page"
        description="This is Saber Group - Hiring Management System - Sign In Page"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
