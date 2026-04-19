import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isGuest: boolean;
  isLoggedIn: boolean;
  login: (newToken: string, newUsername: string) => void;
  loginAsGuest: () => void;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("token") || null);
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem("username") || null);
  const [isGuest, setIsGuest] = useState<boolean>(() => sessionStorage.getItem("guest") === "true");

  function login(newToken: string, newUsername: string) {
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

  function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
