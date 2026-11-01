/**
 * APP: the root of the client, the only file that knows every page.
 * It holds the router, with one route for each page, inside the AuthProvider (who is logged in).
 * Login and sign-up have their own layout; every other page sits under the navbar (AppLayout).
 * A protected page is wrapped in RequireRole, with the words the login shows ("Log in to <page>.").
 * Not here: data, logic, the markup of a screen (that is pages/).
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthProvider.js';
import { ROLES, STAFF_ROLES } from './lib/roles.js';
import { AppLayout } from './pages/AppLayout/AppLayout.jsx';
import { BookPage } from './pages/BookPage/BookPage.jsx';
import { HomePage } from './pages/HomePage/HomePage.jsx';
import { LoginPage } from './pages/LoginPage/LoginPage.jsx';
import { RequireRole } from './pages/RequireRole.jsx';
import { SignUpPage } from './pages/SignUpPage/SignUpPage.jsx';
import { SlotsPage } from './pages/SlotsPage/SlotsPage.jsx';
import { StaffOnlyPage } from './pages/StaffOnlyPage/StaffOnlyPage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/book"
              element={
                <RequireRole roles={[ROLES.HIKER]} page="book a table">
                  <BookPage />
                </RequireRole>
              }
            />
            <Route
              path="/slots"
              element={
                <RequireRole roles={STAFF_ROLES} page="see the slots and tables" denied={<StaffOnlyPage />}>
                  <SlotsPage />
                </RequireRole>
              }
            />
          </Route>
          {/* Any unknown path ends up on the home page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
