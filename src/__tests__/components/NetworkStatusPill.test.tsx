import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NetworkStatusPill } from "@/components/NetworkStatusPill";
import * as offlineSyncModule from "@/hooks/useOfflineSync";

jest.mock("@/hooks/useOfflineSync");

describe("NetworkStatusPill", () => {
  const mockUseOfflineSync = jest.spyOn(offlineSyncModule, "useOfflineSync");

  beforeEach(() => {
    jest.useFakeTimers();
    mockUseOfflineSync.mockReturnValue({
      isOffline: false,
      hasPendingChanges: false,
      isSyncing: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("renders nothing when user is initially online", () => {
    const { container } = render(<NetworkStatusPill />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("displays amber 'Offline' badge when disconnected", () => {
    mockUseOfflineSync.mockReturnValue({
      isOffline: true,
      hasPendingChanges: false,
      isSyncing: false,
    });

    render(<NetworkStatusPill />);

    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Offline");
    expect(badge).toHaveAttribute("aria-live", "polite");
    expect(badge.className).toContain("bg-amber-50");
  });

  it("transitions to green 'Back online' badge when connectivity resumes", () => {
    const { rerender } = render(<NetworkStatusPill />);

    // 1. Go offline
    mockUseOfflineSync.mockReturnValue({
      isOffline: true,
      hasPendingChanges: false,
      isSyncing: false,
    });
    rerender(<NetworkStatusPill />);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");

    // 2. Go back online
    mockUseOfflineSync.mockReturnValue({
      isOffline: false,
      hasPendingChanges: false,
      isSyncing: false,
    });
    rerender(<NetworkStatusPill />);

    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Back online");
    expect(badge.className).toContain("bg-emerald-50");
  });

  it("fades out and removes 'Back online' badge after duration expires", () => {
    const { rerender, container } = render(
      <NetworkStatusPill onlineFlashDurationMs={2000} />,
    );

    // 1. Offline
    mockUseOfflineSync.mockReturnValue({
      isOffline: true,
      hasPendingChanges: false,
      isSyncing: false,
    });
    rerender(<NetworkStatusPill onlineFlashDurationMs={2000} />);
    expect(screen.getByText("Offline")).toBeInTheDocument();

    // 2. Online
    mockUseOfflineSync.mockReturnValue({
      isOffline: false,
      hasPendingChanges: false,
      isSyncing: false,
    });
    rerender(<NetworkStatusPill onlineFlashDurationMs={2000} />);
    expect(screen.getByText("Back online")).toBeInTheDocument();

    // 3. Fast-forward timer by 2000ms
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("applies custom className", () => {
    mockUseOfflineSync.mockReturnValue({
      isOffline: true,
      hasPendingChanges: false,
      isSyncing: false,
    });

    render(<NetworkStatusPill className="custom-test-class" />);

    const badge = screen.getByRole("status");
    expect(badge.className).toContain("custom-test-class");
  });
});
