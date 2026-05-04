import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/common/Spinner';
import { paths } from './Paths';

export default function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={paths.auth.signIn} replace />;
  }

  return <Outlet />;
}
