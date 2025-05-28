'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = '/login',
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !currentUser) {
        // User is not authenticated and this page requires authentication
        router.push(redirectTo);
      } else if (!requireAuth && currentUser) {
        // User is authenticated but this page is only for unauthenticated users
        router.push('/documents');
      }
    }
  }, [currentUser, loading, requireAuth, redirectTo, router]);

  if (loading || (requireAuth && !currentUser) || (!requireAuth && currentUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return <>{children}</>;
}
