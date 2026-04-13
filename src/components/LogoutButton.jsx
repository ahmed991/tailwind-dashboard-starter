import { useAuth } from "../context/AuthContext";

const LogoutButton = ({ className = "" }) => {
  const { isAuthenticated, logout } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <button
      onClick={logout}
      className={`text-white/70 hover:text-red-400 text-sm transition-colors ${className}`}
    >
      Sign Out
    </button>
  );
};

export default LogoutButton;
