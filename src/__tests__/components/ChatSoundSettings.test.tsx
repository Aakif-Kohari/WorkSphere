import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ChatSoundToggle } from "@/components/settings/ChatSoundToggle";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  CHAT_SOUND_STORAGE_KEY,
  isChatSoundEnabled,
  setChatSoundEnabled,
  playChatMessageSound,
} from "@/lib/chatSound";

describe("ChatSoundSettings (#3464)", () => {
  let playMock: jest.Mock;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    playMock = jest.fn().mockResolvedValue(undefined);
    window.Audio = jest.fn().mockImplementation(() => ({
      play: playMock,
      pause: jest.fn(),
    })) as unknown as typeof Audio;
  });

  describe("LocalStorage & chatSound utility persistence", () => {
    it("defaults to enabled (true) when unset", () => {
      expect(isChatSoundEnabled()).toBe(true);
    });

    it("respects explicitly stored false value", () => {
      localStorage.setItem(CHAT_SOUND_STORAGE_KEY, "false");
      expect(isChatSoundEnabled()).toBe(false);
    });

    it("respects explicitly stored true value", () => {
      localStorage.setItem(CHAT_SOUND_STORAGE_KEY, "true");
      expect(isChatSoundEnabled()).toBe(true);
    });

    it("persists updates through setChatSoundEnabled", () => {
      setChatSoundEnabled(false);
      expect(localStorage.getItem(CHAT_SOUND_STORAGE_KEY)).toBe("false");
      expect(isChatSoundEnabled()).toBe(false);

      setChatSoundEnabled(true);
      expect(localStorage.getItem(CHAT_SOUND_STORAGE_KEY)).toBe("true");
      expect(isChatSoundEnabled()).toBe(true);
    });

    it("plays audio when enabled and silences audio when disabled", () => {
      setChatSoundEnabled(true);
      const playedWhenEnabled = playChatMessageSound();
      expect(playedWhenEnabled).toBe(true);
      expect(playMock).toHaveBeenCalledTimes(1);

      setChatSoundEnabled(false);
      const playedWhenDisabled = playChatMessageSound();
      expect(playedWhenDisabled).toBe(false);
      expect(playMock).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe("ChatSoundToggle Component", () => {
    it("renders toggle switch and defaults to checked", () => {
      render(<ChatSoundToggle />);
      const toggle = screen.getByRole("switch", { name: "Chat Sound Effects" });
      expect(toggle).toBeInTheDocument();
      expect(toggle).toBeChecked();
    });

    it("initializes to unchecked if localStorage has false", () => {
      localStorage.setItem(CHAT_SOUND_STORAGE_KEY, "false");
      render(<ChatSoundToggle />);
      const toggle = screen.getByRole("switch", { name: "Chat Sound Effects" });
      expect(toggle).not.toBeChecked();
    });

    it("toggles state and updates localStorage on user interaction", () => {
      render(<ChatSoundToggle />);
      const toggle = screen.getByRole("switch", { name: "Chat Sound Effects" });

      expect(toggle).toBeChecked();

      // Click to disable sound
      fireEvent.click(toggle);
      expect(toggle).not.toBeChecked();
      expect(localStorage.getItem(CHAT_SOUND_STORAGE_KEY)).toBe("false");
      expect(isChatSoundEnabled()).toBe(false);

      // Click to re-enable sound
      fireEvent.click(toggle);
      expect(toggle).toBeChecked();
      expect(localStorage.getItem(CHAT_SOUND_STORAGE_KEY)).toBe("true");
      expect(isChatSoundEnabled()).toBe(true);
    });
  });

  describe("ChatPanel Audio Hook Integration", () => {
    it("plays incoming audio chime when sound is enabled", () => {
      setChatSoundEnabled(true);

      const initialMessages = [{ id: "1", role: "user", content: "Hello" }];
      const { rerender } = render(<ChatPanel messages={initialMessages} />);

      expect(playMock).not.toHaveBeenCalled();

      // Incoming assistant message
      const updatedMessages = [
        ...initialMessages,
        { id: "2", role: "assistant", content: "Hi! How can I help you today?" },
      ];
      rerender(<ChatPanel messages={updatedMessages} />);

      expect(playMock).toHaveBeenCalledTimes(1);
    });

    it("silences incoming audio chime when sound is disabled", () => {
      setChatSoundEnabled(false);

      const initialMessages = [{ id: "1", role: "user", content: "Hello" }];
      const { rerender } = render(<ChatPanel messages={initialMessages} />);

      // Incoming assistant message while muted
      const updatedMessages = [
        ...initialMessages,
        { id: "2", role: "assistant", content: "Hi! How can I help you today?" },
      ];
      rerender(<ChatPanel messages={updatedMessages} />);

      expect(playMock).not.toHaveBeenCalled();
    });

    it("does not play audio chime for outgoing user messages", () => {
      setChatSoundEnabled(true);

      const initialMessages = [{ id: "1", role: "user", content: "Hello" }];
      const { rerender } = render(<ChatPanel messages={initialMessages} />);

      // User sends another message
      const updatedMessages = [
        ...initialMessages,
        { id: "2", role: "user", content: "Another question" },
      ];
      rerender(<ChatPanel messages={updatedMessages} />);

      expect(playMock).not.toHaveBeenCalled();
    });
  });
});
