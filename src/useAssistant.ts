import { useEffect, useRef, useCallback } from "react";
import { createAssistant, createSmartappDebugger } from "@salutejs/client";
import type { Assistant, AssistantSmartAppData } from "@salutejs/client";

export type VoiceCommand =
  | { type: "DROP_COLUMN"; col: number }
  | { type: "NEW_GAME" }
  | { type: "MENU" }
  | { type: "START_PVP" }
  | { type: "START_BOT"; level: number }
  | { type: "UNKNOWN"; text: string };

export interface AssistantApi {
  sendAction: (actionId: string, parameters?: Record<string, unknown>) => void;
}

interface UseAssistantOptions {
  getState: () => Record<string, unknown>;
  onCommand: (cmd: VoiceCommand) => void;
  onReady?: (api: AssistantApi) => void;
}

function parseCommand(data: any): VoiceCommand | null {
  if (data?.type !== "smart_app_data") return null;

  const sad = data.smart_app_data;

  switch (sad.type) {
    case "DROP_COLUMN":
      return { type: "DROP_COLUMN", col: Number(sad.payload?.col ?? 1) };
    case "NEW_GAME":
      return { type: "NEW_GAME" };
    case "MENU":
      return { type: "MENU" };
    case "START_PVP":
      return { type: "START_PVP" };
    case "START_BOT":
      return { type: "START_BOT", level: Number(sad.payload?.level ?? 2) };
    case "UNKNOWN":
      return { type: "UNKNOWN", text: String(sad.payload?.text ?? "") };
    default:
      return null;
  }
}

export function useAssistant({ getState, onCommand, onReady }: UseAssistantOptions): void {
  const assistantRef = useRef<Assistant<AssistantSmartAppData> | null>(null);
  const onCommandRef = useRef(onCommand);
  const getStateRef = useRef(getState);
  const onReadyRef = useRef(onReady);

  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { getStateRef.current = getState; }, [getState]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const sendAction = useCallback((actionId: string, parameters: Record<string, unknown> = {}) => {
    assistantRef.current?.sendData({
      action: {
        action_id: actionId,
        parameters,
      },
    });
  }, []);

  const handleData = useCallback((data: any) => {
    console.log("[SALUTE RAW]", data);

    const cmd = parseCommand(data);

    if (cmd) {
      console.info("[Салют] ← команда:", cmd);
      onCommandRef.current(cmd);
      return;
    }

    const backCommand = data?.navigation?.command ?? data?.system?.command;

    if (String(backCommand).toUpperCase() === "BACK") {
      onCommandRef.current({ type: "MENU" });
    }
  }, []);

  useEffect(() => {
    let client: Assistant<AssistantSmartAppData>;

    const token = import.meta.env.VITE_SALUTE_TOKEN;
    const isDev = import.meta.env.DEV;

    if (isDev) {
      client = createSmartappDebugger({
        token,
        initPhrase: "запусти 4 фишки",
        getState: () => getStateRef.current(),
        nativePanel: {
          defaultText: "сделай ход",
        },
      }) as any;
    } else {
      
      client = createAssistant({
        getState: () => getStateRef.current(),
      }) as any;
    }

    assistantRef.current = client;
    onReadyRef.current?.({ sendAction });

    client.on("data", handleData);

    client.on("start", () => {
      console.info("[Салют] готов");
    });

    return () => {
      client.close?.();
    };
  }, [handleData, sendAction]);
}
