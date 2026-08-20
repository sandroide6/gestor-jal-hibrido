import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import RoleGuard from './components/ui/RoleGuard';
import OfflineBanner from './components/ui/OfflineBanner';
import ServerStatusBanner from './components/ui/ServerStatusBanner';
import UpdatePrompt from './components/ui/UpdatePrompt';
import InstallPrompt from './components/ui/InstallPrompt';
import ToastContainer from './components/ui/ToastContainer';
import { api } from './services/api';

// Sondea /health periódicamente para que el banner de "servidor/BD no disponible"
// se actualice incluso si el usuario no está haciendo ninguna otra petición (ej.
// mirando una pantalla sin recargar datos). api.get ya reporta el resultado a
// serverStatusStore como efecto secundario — aquí solo hace falta ignorar el throw
// en caso de 503 (degraded) o de fallo de red (unreachable).
const HEALTH_POLL_INTERVAL_MS = 30_000;

function useServerHealthPolling() {
  useEffect(() => {
    const poll = () => { api.get('/health').catch(() => {}); };
    poll();
    const id = setInterval(poll, HEALTH_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}

const LoginPage      = lazy(() => import('./pages/LoginPage'));
const HabeasDataPage = lazy(() => import('./pages/HabeasDataPage'));
const DashboardPage  = lazy(() => import('./pages/DashboardPage'));
const GeneratorPage = lazy(() => import('./pages/GeneratorPage'));
const EdilPage      = lazy(() => import('./pages/EdilPage'));
const UsersPage     = lazy(() => import('./pages/UsersPage'));
const DocTypesPage  = lazy(() => import('./pages/DocTypesPage'));
const ReportsPage   = lazy(() => import('./pages/ReportsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const ProfilePage   = lazy(() => import('./pages/ProfilePage'));
const JalConfigPage = lazy(() => import('./pages/JalConfigPage'));
const BackupPage    = lazy(() => import('./pages/BackupPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">Cargando…</div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, loading } = useAuthStore();
  useServerHealthPolling();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">Cargando…</div>
      </div>
    );
  }

  return (
    <>
      <OfflineBanner />
      <ServerStatusBanner />
      <UpdatePrompt />
      <InstallPrompt />
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/generador" replace /> : <LoginPage />}
        />

        <Route
          path="/habeas-data"
          element={
            <RoleGuard requireAuth roles={['administrador', 'edil', 'auxiliar']}>
              <HabeasDataPage />
            </RoleGuard>
          }
        />

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/generador' : '/login'} replace />}
        />

        <Route
          path="/generador"
          element={
            <RoleGuard requireAuth roles={['auxiliar', 'administrador', 'edil']}>
              <GeneratorPage />
            </RoleGuard>
          }
        />

        <Route
          path="/edil"
          element={
            <RoleGuard requireAuth roles={['edil', 'administrador']}>
              <EdilPage />
            </RoleGuard>
          }
        />

        <Route
          path="/admin"
          element={
            <RoleGuard requireAuth roles={['administrador', 'edil']}>
              <DashboardPage />
            </RoleGuard>
          }
        />

        <Route
          path="/admin/usuarios"
          element={
            <RoleGuard requireAuth roles={['administrador']}>
              <UsersPage />
            </RoleGuard>
          }
        />

        <Route
          path="/admin/tipos-documento"
          element={
            <RoleGuard requireAuth roles={['administrador']}>
              <DocTypesPage />
            </RoleGuard>
          }
        />

        <Route
          path="/reportes"
          element={
            <RoleGuard requireAuth roles={['edil', 'administrador']}>
              <ReportsPage />
            </RoleGuard>
          }
        />

        <Route
          path="/admin/auditoria"
          element={
            <RoleGuard requireAuth roles={['administrador', 'edil']}>
              <AuditLogsPage />
            </RoleGuard>
          }
        />

        <Route
          path="/admin/jal-config"
          element={
            <RoleGuard requireAuth roles={['administrador']}>
              <JalConfigPage />
            </RoleGuard>
          }
        />

        <Route
          path="/admin/configuracion/backup"
          element={
            <RoleGuard requireAuth roles={['administrador']}>
              <BackupPage />
            </RoleGuard>
          }
        />

        <Route
          path="/perfil"
          element={
            <RoleGuard requireAuth roles={['administrador', 'edil', 'auxiliar']}>
              <ProfilePage />
            </RoleGuard>
          }
        />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/generador' : '/login'} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
