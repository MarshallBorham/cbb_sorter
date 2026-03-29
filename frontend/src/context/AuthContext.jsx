import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("token") || null);
  const [username, setUsername] = useState(() => sessionStorage.getItem("username") || null);
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem("guest") === "true");

  function login(newToken, newUsername) {
    sessionStorage.setItem("token", newToken);
    sessionStorage.setItem("username", newUsername);
    sessionStorage.removeItem("guest");
    setToken(newToken);
    setUsername(newUsername);
    setIsGuest(false);
  }

  function loginAsGuest() {
    sessionStorage.setItem("guest", "true");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    setToken(null);
    setUsername(null);
    setIsGuest(true);
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("guest");
    setToken(null);
    setUsername(null);
    setIsGuest(false);
  }

  function authFetch(url, options = {}) {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  return (
    <AuthContext.Provider value={{
      token,
      username,
      isGuest,
      login,
      loginAsGuest,
      logout,
      authFetch,
      isLoggedIn: !!token || isGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}