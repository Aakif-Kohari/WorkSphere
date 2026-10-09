import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MultiCurrencyDeskCheckout,
  BookingCheckoutItem,
} from "@/components/billing/MultiCurrencyDeskCheckout";
import {
  createSolanaPayUrl,
  SOLANA_USDC_MINT_MAINNET,
} from "@/lib/payments/solanaPay";

describe("Solana Pay URI generation helper", () => {
  it("creates valid solana:<recipient>?amount=<amount>&spl-token=<usdc_mint> URI", () => {
    const url = createSolanaPayUrl({
      recipient: "TestRecipientWallet1111111111111111111111",
      amount: 25.5,
      splToken: SOLANA_USDC_MINT_MAINNET,
      label: "WorkSphere Desk 04 Pass",
    });

    expect(url).toContain("solana:TestRecipientWallet1111111111111111111111?");
    expect(url).toContain("amount=25.50");
    expect(url).toContain(`spl-token=${SOLANA_USDC_MINT_MAINNET}`);
    expect(url).toContain("label=WorkSphere+Desk+04+Pass");
  });
});

describe("MultiCurrencyDeskCheckout Component", () => {
  const sampleItem: BookingCheckoutItem = {
    bookingId: "booking-999",
    deskName: "Desk 04 (North Silent Window)",
    venueName: "WorkSphere SF Main",
    durationHours: 8,
    priceUsd: 45.0,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock) = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            reference: "tx_ref_test",
            status: "PENDING",
          }),
      })
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders Solana Pay USDC QR code and deep link by default", () => {
    render(<MultiCurrencyDeskCheckout item={sampleItem} />);

    expect(screen.getByTestId("multi-currency-desk-checkout")).toBeInTheDocument();
    expect(screen.getByText("Desk 04 (North Silent Window)")).toBeInTheDocument();

    const qrCodeSvg = screen.getByTestId("solana-pay-qr-code-svg");
    expect(qrCodeSvg).toBeInTheDocument();

    const deepLinkBtn = screen.getByTestId("solana-pay-deep-link-button");
    expect(deepLinkBtn).toBeInTheDocument();
    expect(deepLinkBtn.getAttribute("href")).toContain("solana:");
    expect(deepLinkBtn.getAttribute("href")).toContain("amount=45.00");
    expect(deepLinkBtn.getAttribute("href")).toContain(`spl-token=${SOLANA_USDC_MINT_MAINNET}`);
  });

  it("polls status and triggers automatic booking confirmation upon transaction signature", async () => {
    const onBookingConfirmedMock = jest.fn();

    // Mock fetch return sequence: PENDING first, then CONFIRMED
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ reference: "tx_123", status: "PENDING" }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              reference: "tx_123",
              status: "CONFIRMED",
              signature: "5K2xMockSolanaTxSignature123456789",
            }),
        })
      );

    render(
      <MultiCurrencyDeskCheckout
        item={sampleItem}
        onBookingConfirmed={onBookingConfirmedMock}
      />
    );

    // Fast-forward polling timer 2500ms
    await act(async () => {
      jest.advanceTimersByTime(2600);
    });

    await waitFor(() => {
      expect(screen.getByTestId("solana-payment-confirmed-banner")).toBeInTheDocument();
    });

    expect(screen.getByText("Solana Payment Confirmed!")).toBeInTheDocument();
    expect(onBookingConfirmedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "booking-999",
        currency: "SOL_USDC",
        amount: 45.0,
      })
    );
  });

  it("allows currency switching to traditional USD card checkout", () => {
    render(<MultiCurrencyDeskCheckout item={sampleItem} />);

    const usdTab = screen.getByTestId("currency-tab-usd");
    fireEvent.click(usdTab);

    expect(screen.getByPlaceholderText("Cardholder Name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pay \$45.00 USD/i })
    ).toBeInTheDocument();
  });
});
