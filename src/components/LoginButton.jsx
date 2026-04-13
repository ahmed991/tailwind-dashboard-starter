import { useAuth } from "../context/AuthContext";

const LoginButton = ({ className = "", onClick }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return null;

  return (
    <button
      onClick={onClick}
      className={`bg-lime-400 hover:bg-lime-300 text-gray-900 font-semibold rounded-lg px-4 py-2 text-sm transition-colors ${className}`}
    >
      Sign In
    </button>
  );
};

export default LoginButton;
