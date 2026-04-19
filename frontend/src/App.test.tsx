import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";

function renderWithProviders(ui: React.ReactElement, { route = "/login" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe("App", () => {
  it("renders login at /login", () => {
    renderWithProviders(<App />, { route: "/login" });
    expect(screen.getByRole("heading", { name: /CBB Stats/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
