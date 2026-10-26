/**
 * APP: the root of the client, the only file that knows every page.
 * It holds the router, with one route for each page.
 * Not here: data, logic, the markup of a screen (that is pages/).
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage/HomePage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Any unknown path ends up on the home page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
