"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import usePartySocketReact from "partysocket/react";
import { useAuth } from "@clerk/nextjs";
import {
  attachJitteredBackoff,
  PARTY_SOCKET_RECONNECT_OPTIONS,
} from "@/lib/partySocketReconnect";

export type PartySocketOptions = Parameters<typeof usePartySocketReact>[0] & {
  disableLeaderElection?: boolean;
  baseDelay?: number;
  maxDelay?: number;
  onConnectionStatusChange?: (
    status: "connected" | "reconnecting" | "offline",
  ) => void;
};

export type ConnectionStatus = "connected" | "reconnecting" | "offline";

export interface CalculateJitteredBackoffOptions {
  baseDelay?: number;
  maxDelay?: number;
  random?: () => number;
}

/**
 * Full-jitter exponential backoff formula (#3769):
 * twait = min(tmax, tbase * 2^attempt) * random(0.8, 1.2)
 */
export function calculateJitteredBackoff(
  attempt: number,
  options: CalculateJitteredBackoffOptions = {},
): number {
  if (attempt <= 0) return 0;

  const baseDelay =
    options.baseDelay ?? PARTY_SOCKET_RECONNECT_OPTIONS.minReconnectionDelay; // 1,000ms
  const maxDelay =
    options.maxDelay ?? PARTY_SOCKET_RECONNECT_OPTIONS.maxReconnectionDelay; // 30,000ms
  const randomFn = options.random ?? Math.random;

  const cappedBase = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
  const jitterFactor = 0.8 + randomFn() * 0.4;
  const delayWithJitter = cappedBase * jitterFactor;

  return Math.round(Math.min(maxDelay, Math.max(0, delayWithJitter)));
}

interface LeaderHeartbeatMessage {
  type: "LEADER_HEARTBEAT";
  tabId: string;
  room: string;
  timestamp: number;
}

interface LeaderClaimMessage {
  type: "LEADER_CLAIM";
  tabId: string;
  room: string;
  timestamp: number;
}

interface LeaderResignMessage {
  type: "LEADER_RESIGN";
  tabId: string;
  room: string;
}

interface RelayInboundMessage {
  type: "RELAY_INBOUND";
  room: string;
  data: string;
}

interface RelayOutboundMessage {
  type: "RELAY_OUTBOUND";
  room: string;
  data: string;
}

interface RelayStateMessage {
  type: "RELAY_STATE";
  room: string;
  event: "open" | "close";
  details?: any;
}

type CrossTabMessage =
  | LeaderHeartbeatMessage
  | LeaderClaimMessage
  | LeaderResignMessage
  | RelayInboundMessage
  | RelayOutboundMessage
  | RelayStateMessage;

const HEARTBEAT_INTERVAL_MS = 1000;
const HEARTBEAT_TIMEOUT_MS = 2500;

/**
 * Custom PartySocket hook with:
 * 1. Multi-tab leadership coordination via BroadcastChannel (only 1 active WebSocket connection) (#3767).
 * 2. Full-jitter exponential backoff on disconnection up to a 30s cap (#3769).
 * 3. Connection status indicator support ("Reconnecting...").
 * 4. Message handshake retry counter resets.
 * 5. Automatic leader election and smooth transfer on tab close.
 * 6. Token re-authentication interceptor (Clerk 4001).
 */
export function usePartySocket(options: PartySocketOptions) {
  const { getToken } = useAuth();
  const room = (options as any)?.room ?? "default-room";
  const channelName = `worksphere:partysocket:${room}`;
  const tabIdRef = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).substring(2, 9)}`,
  );

  const [isLeader, setIsLeader] = useState<boolean>(() => {
    if (typeof window === "undefined" || options.disableLeaderElection) return true;
    return false;
  });

  const isLeaderRef = useRef<boolean>(isLeader);
  isLeaderRef.current = isLeader;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("offline");
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const reconnectAttemptRef = useRef<number>(0);

  const {
    baseDelay = PARTY_SOCKET_RECONNECT_OPTIONS.minReconnectionDelay,
    maxDelay = PARTY_SOCKET_RECONNECT_OPTIONS.maxReconnectionDelay,
    onConnectionStatusChange,
    ...socketOptions
  } = options;

  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastLeaderHeartbeatRef = useRef<number>(0);
  const followerListenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(
    new Map(),
  );

  // Helper to dispatch mock events to follower socket listeners
  const dispatchFollowerEvent = useCallback((eventName: string, eventObj: any) => {
    const listeners = followerListenersRef.current.get(eventName);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(eventObj);
        } catch (err) {
          console.error(`[PartySocket follower] Error in ${eventName} listener:`, err);
        }
      });
    }
  }, []);

  // Multi-tab leader election & presence coordinator
  useEffect(() => {
    if (typeof window === "undefined" || options.disableLeaderElection) {
      setIsLeader(true);
      return;
    }

    if (typeof BroadcastChannel === "undefined") {
      setIsLeader(true);
      return;
    }

    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(channelName);
      channelRef.current = channel;
    } catch {
      setIsLeader(true);
      return;
    }

    const tabId = tabIdRef.current;

    const handleChannelMessage = (ev: MessageEvent<CrossTabMessage>) => {
      const msg = ev.data;
      if (!msg || msg.room !== room) return;

      if (msg.type === "LEADER_HEARTBEAT") {
        lastLeaderHeartbeatRef.current = Date.now();
        if (msg.tabId !== tabId && isLeaderRef.current) {
          if (msg.tabId < tabId) {
            setIsLeader(false);
          }
        }
      } else if (msg.type === "LEADER_CLAIM") {
        lastLeaderHeartbeatRef.current = Date.now();
        if (msg.tabId !== tabId) {
          setIsLeader(false);
        }
      } else if (msg.type === "LEADER_RESIGN") {
        lastLeaderHeartbeatRef.current = 0;
        setIsLeader(true);
        channel.postMessage({
          type: "LEADER_CLAIM",
          tabId,
          room,
          timestamp: Date.now(),
        });
      } else if (msg.type === "RELAY_INBOUND") {
        if (!isLeaderRef.current) {
          dispatchFollowerEvent("message", {
            type: "message",
            data: msg.data,
            origin: "",
            lastEventId: "",
            source: null,
            ports: [],
          });
        }
      } else if (msg.type === "RELAY_STATE") {
        if (!isLeaderRef.current) {
          dispatchFollowerEvent(msg.event, {
            type: msg.event,
            ...msg.details,
          });
        }
      }
    };

    channel.addEventListener("message", handleChannelMessage);

    const claimTimer = setTimeout(() => {
      if (Date.now() - lastLeaderHeartbeatRef.current > HEARTBEAT_TIMEOUT_MS) {
        setIsLeader(true);
        channel.postMessage({
          type: "LEADER_CLAIM",
          tabId,
          room,
          timestamp: Date.now(),
        });
      }
    }, 150 + Math.random() * 150);

    const heartbeatInterval = setInterval(() => {
      if (isLeaderRef.current) {
        channel.postMessage({
          type: "LEADER_HEARTBEAT",
          tabId,
          room,
          timestamp: Date.now(),
        });
      } else {
        if (Date.now() - lastLeaderHeartbeatRef.current > HEARTBEAT_TIMEOUT_MS) {
          setIsLeader(true);
          channel.postMessage({
            type: "LEADER_CLAIM",
            tabId,
            room,
            timestamp: Date.now(),
          });
        }
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handleBeforeUnload = () => {
      if (isLeaderRef.current) {
        channel.postMessage({
          type: "LEADER_RESIGN",
          tabId,
          room,
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearTimeout(claimTimer);
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (isLeaderRef.current) {
        channel.postMessage({
          type: "LEADER_RESIGN",
          tabId,
          room,
        });
      }
      channel.removeEventListener("message", handleChannelMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [channelName, room, options.disableLeaderElection, dispatchFollowerEvent]);

  // Only the elected leader opens the active WebSocket connection to PartyKit
  const socket = usePartySocketReact({
    ...PARTY_SOCKET_RECONNECT_OPTIONS,
    ...socketOptions,
    startClosed: !isLeader || options.startClosed,
  });

  const attachedSocket = attachJitteredBackoff(socket);

  // Attach full-jitter exponential backoff override
  if (attachedSocket) {
    (attachedSocket as any)._getNextDelay = function () {
      const attempt = (this._retryCount ?? 0) + 1;
      return calculateJitteredBackoff(attempt, { baseDelay, maxDelay });
    };
  }

  // Leader tab: relay inbound messages & connection state across BroadcastChannel
  useEffect(() => {
    if (!isLeader || !attachedSocket) return;

    const handleLeaderOpen = () => {
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setConnectionStatus("connected");
      onConnectionStatusChange?.("connected");

      channelRef.current?.postMessage({
        type: "RELAY_STATE",
        room,
        event: "open",
      });
    };

    const handleLeaderClose = (ev: any) => {
      reconnectAttemptRef.current += 1;
      setReconnectAttempt(reconnectAttemptRef.current);
      setConnectionStatus("reconnecting");
      onConnectionStatusChange?.("reconnecting");

      channelRef.current?.postMessage({
        type: "RELAY_STATE",
        room,
        event: "close",
        details: { code: ev?.code, reason: ev?.reason },
      });
    };

    const handleLeaderMessage = (ev: any) => {
      if (reconnectAttemptRef.current > 0) {
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
      }
      setConnectionStatus("connected");

      channelRef.current?.postMessage({
        type: "RELAY_INBOUND",
        room,
        data: typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data),
      });
    };

    const handleError = () => {
      setConnectionStatus("reconnecting");
      onConnectionStatusChange?.("reconnecting");
    };

    (attachedSocket as any).addEventListener?.("open", handleLeaderOpen);
    (attachedSocket as any).addEventListener?.("close", handleLeaderClose);
    (attachedSocket as any).addEventListener?.("message", handleLeaderMessage);
    (attachedSocket as any).addEventListener?.("error", handleError);

    if ((attachedSocket as any).readyState === 1) {
      setConnectionStatus("connected");
    }

    const handleFollowerOutbound = (ev: MessageEvent<CrossTabMessage>) => {
      if (ev.data?.type === "RELAY_OUTBOUND" && ev.data.room === room) {
        try {
          (attachedSocket as any).send?.(ev.data.data);
        } catch (err) {
          console.error("[PartySocket leader] Failed to send relayed message:", err);
        }
      }
    };

    channelRef.current?.addEventListener("message", handleFollowerOutbound);

    return () => {
      (attachedSocket as any).removeEventListener?.("open", handleLeaderOpen);
      (attachedSocket as any).removeEventListener?.("close", handleLeaderClose);
      (attachedSocket as any).removeEventListener?.("message", handleLeaderMessage);
      (attachedSocket as any).removeEventListener?.("error", handleError);
      channelRef.current?.removeEventListener("message", handleFollowerOutbound);
    };
  }, [isLeader, attachedSocket, room, onConnectionStatusChange]);

  // Intercept 4001 token expiration codes to refresh Clerk token
  useEffect(() => {
    if (
      !attachedSocket ||
      typeof (attachedSocket as any).addEventListener !== "function"
    )
      return;

    const handleAuthClose = async (event: any) => {
      if (event?.code === 4001) {
        try {
          const freshToken = await getToken({ skipCache: true });
          if (freshToken) {
            if ((attachedSocket as any).query) {
              (attachedSocket as any).query.token = freshToken;
            }
            (attachedSocket as any).__worksphereForceReconnect?.();
          }
        } catch (err) {
          console.error(
            "[PartySocket] Failed to refresh expired Clerk token:",
            err,
          );
        }
      }
    };

    (attachedSocket as any).addEventListener("close", handleAuthClose);
    return () => {
      if (typeof (attachedSocket as any).removeEventListener === "function") {
        (attachedSocket as any).removeEventListener("close", handleAuthClose);
      }
    };
  }, [attachedSocket, getToken]);

  // Return augmented socket proxy supporting followers & status
  const proxySocket = useRef<any>(null);
  if (!proxySocket.current || proxySocket.current.__target !== attachedSocket) {
    proxySocket.current = new Proxy(attachedSocket, {
      get(target, prop, receiver) {
        if (prop === "isLeader") {
          return isLeader;
        }
        if (prop === "connectionStatus") {
          return connectionStatus;
        }
        if (prop === "isReconnecting") {
          return connectionStatus === "reconnecting";
        }
        if (prop === "reconnectAttempt") {
          return reconnectAttempt;
        }
        if (prop === "addEventListener") {
          return (eventName: string, listener: (...args: any[]) => void) => {
            if (!followerListenersRef.current.has(eventName)) {
              followerListenersRef.current.set(eventName, new Set());
            }
            followerListenersRef.current.get(eventName)!.add(listener);

            if (typeof target.addEventListener === "function") {
              target.addEventListener(eventName, listener);
            }
          };
        }
        if (prop === "removeEventListener") {
          return (eventName: string, listener: (...args: any[]) => void) => {
            followerListenersRef.current.get(eventName)?.delete(listener);

            if (typeof target.removeEventListener === "function") {
              target.removeEventListener(eventName, listener);
            }
          };
        }
        if (prop === "send") {
          return (data: any) => {
            if (isLeaderRef.current) {
              return typeof target.send === "function" ? target.send(data) : undefined;
            } else {
              const serialized = typeof data === "string" ? data : JSON.stringify(data);
              channelRef.current?.postMessage({
                type: "RELAY_OUTBOUND",
                room,
                data: serialized,
              });
            }
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    proxySocket.current.__target = attachedSocket;
  }

  return proxySocket.current;
}

export default usePartySocket;