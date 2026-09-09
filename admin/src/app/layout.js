import './globals.css';
import '../../admin.css';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import AuthGuard from '../components/AuthGuard';

export const metadata = {
  title: 'TableFlow — Admin Dashboard',
  description: 'TableFlow restaurant management dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
