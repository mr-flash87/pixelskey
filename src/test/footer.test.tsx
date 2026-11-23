import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";

describe("Footer", () => {
  it("links to each existing legal page", () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Conditions générales de vente" })).toHaveAttribute("href", "/cgv");
    expect(screen.getByRole("link", { name: "Politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
    expect(screen.getByRole("link", { name: "Politique de remboursement" })).toHaveAttribute("href", "/remboursement");
  });

  it("opens delivery and payment answers", () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const delivery = screen.getByRole("button", { name: "Comment recevoir ma clé ou mes accès après l’achat ?" });
    fireEvent.click(delivery);
    expect(delivery).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Après confirmation du paiement/)).toBeVisible();
    const payment = screen.getByRole("button", { name: "Puis-je payer avec Mobile Money ?" });
    fireEvent.click(payment);
    expect(payment).toHaveAttribute("aria-expanded", "true");
    expect(delivery).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/dépendent de votre pays/)).toBeVisible();
  });
});
