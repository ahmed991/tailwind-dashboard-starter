import { useAuth0 } from "@auth0/auth0-react";

const LogoutButton = () => {
    const { logout, isAuthenticated } = useAuth0();

    if (!isAuthenticated) return null;

    return (
        <button onClick={() => logout({ returnTo: window.location.origin })}>
            Sign Out
        </button>
    );
};

export default LogoutButton;
