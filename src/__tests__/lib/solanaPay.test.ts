import {
  DEFAULT_MAX_RELAY_FEE_LAMPORTS,
  validateRelayFeeLamports,
  getSolanaExplorerUrl,
  getSolscanUrl,
} from "@/lib/payments/solanaPay";

describe("validateRelayFeeLamports", () => {
  it("accepts fees within the configured ceiling", () => {
    expect(validateRelayFeeLamports(5_000, 10_000)).toBe(5_000);
  });

  it("uses a conservative default fee ceiling", () => {
    expect(() =>
      validateRelayFeeLamports(DEFAULT_MAX_RELAY_FEE_LAMPORTS + 1),
    ).toThrow("Transaction fee exceeds the relayer limit");
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid fee value %p",
    (fee) => {
      expect(() => validateRelayFeeLamports(fee)).toThrow(
        "Relay fee must be a non-negative integer",
      );
    },
  );

  it("rejects an invalid configured ceiling", () => {
    expect(() => validateRelayFeeLamports(1, -1)).toThrow(
      "Maximum relay fee must be a non-negative integer",
    );
  });
});

describe("Solana Explorer URL helpers", () => {
  it("constructs mainnet Solana Explorer URL", () => {
    const url = getSolanaExplorerUrl("5K2xMockTxSignature123");
    expect(url).toBe("https://explorer.solana.com/tx/5K2xMockTxSignature123");
  });

  it("constructs cluster-specific Solana Explorer URL", () => {
    const url = getSolanaExplorerUrl("5K2xMockTxSignature123", "devnet");
    expect(url).toBe("https://explorer.solana.com/tx/5K2xMockTxSignature123?cluster=devnet");
  });

  it("constructs Solscan URL", () => {
    const url = getSolscanUrl("5K2xMockTxSignature123");
    expect(url).toBe("https://solscan.io/tx/5K2xMockTxSignature123");
  });
});

