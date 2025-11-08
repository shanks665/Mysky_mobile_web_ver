import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Toaster } from './components/ui/toaster';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import CirclesPage from './pages/CirclesPage';
import EventsPage from './pages/EventsPage';
import ProfilePage from './pages/ProfilePage';
import ExplorePage from './pages/ExplorePage';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}
        >
          <Route index element={<FeedPage />} />
          <Route path="circles" element={<CirclesPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="profile/:userId" element={<ProfilePage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
