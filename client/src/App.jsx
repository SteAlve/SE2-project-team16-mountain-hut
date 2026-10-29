/**
 * APP: the root of the client, the only file that knows every page.
 * It holds the router, with one route for each page, inside the AuthProvider (who is logged in).
 * Not here: data, logic, the markup of a screen (that is pages/).
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthProvider.js';
import { BookTablePage } from './pages/BookTablePage/BookTablePage.jsx';
import { HomePage } from './pages/HomePage/HomePage.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/book" element={<BookTablePage />} />
          {/* Any unknown path ends up on the home page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
