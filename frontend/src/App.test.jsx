import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "./context/AuthContext.jsx";
import App from "./App.jsx";

function renderWithProviders(ui, { route = "/login" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe("App", () => {
  it("renders login at /login", () => {
    renderWithProviders(<App />, { route: "/login" });
    expect(screen.getByRole("heading", { name: /CBB Sorter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
