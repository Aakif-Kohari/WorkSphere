import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import WorkHopPassCard from "@/components/bookings/WorkHopPassCard";

describe("WorkHopPassCard Component - Copy Pass Code", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders Copy Pass Code button with copy icon", () => {
    render(<WorkHopPassCard />);
    const copyBtn = screen.getByRole("button", { name: /copy pass code/i });
    expect(copyBtn).toBeInTheDocument();
  });

  it("copies pass code to clipboard and displays checkmark icon with toast notification", async () => {
    const writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<WorkHopPassCard />);

    const copyBtn = screen.getByRole("button", { name: /copy pass code/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledWith("whop-782914-sprint");
    expect(screen.getByTestId("copy-checkmark-icon")).toBeInTheDocument();
    expect(screen.getByText("Pass code copied to clipboard!")).toBeInTheDocument();

    // Fast-forward 3 seconds auto-dismiss
    act(() => {
      jest.advanceTimersByTime(3100);
    });

    expect(screen.queryByText("Pass code copied to clipboard!")).not.toBeInTheDocument();
  });

  it("uses accessible fallback when navigator.clipboard is unavailable", async () => {
    // Delete clipboard API
    // @ts-ignore
    delete (navigator as any).clipboard;
    const execCommandMock = jest.spyOn(document, "execCommand").mockReturnValue(true);

    render(<WorkHopPassCard />);

    const copyBtn = screen.getByRole("button", { name: /copy pass code/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(screen.getByText("Pass code copied to clipboard!")).toBeInTheDocument();
  });
});
