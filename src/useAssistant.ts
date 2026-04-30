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

const SALUTE_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJqdGkiOiIwMTlkZGRmNy04ODVlLTdjMDEtYjlmZS0yZDA3ZDljZDUwY2QiLCJzdWIiOiJlN2VmMWI0OWMwNjk2ODVkZDJhNzg0Y2E3MWE1NjQ4MzM3MTZiZWFlNTBjMDg4NTUxYTlmZTE3ZWMzOTE5MGEzNTM5YmU5MjcwMDQyNjI5OCIsImlzcyI6IktFWU1BU1RFUiIsImV4cCI6MTc3NzYzMTg4MCwiYXVkIjoiVlBTIiwidXNyIjoiMDE5Y2QzNTEtZGYyYi03OGVjLWFkNjMtMThlYTI0YWVlMWQ0IiwiaWF0IjoxNzc3NTQ1NDcwLCJzaWQiOiIwMTlkZGRmNy04ODVlLTdjODItYjlmZi01YmRiMDZhYjZkNTMifQ.joheTqBthZ_dXHr-5P3mSnXwmNWS4TnkSIyWApfl9e4eL4kkTroLHvnRpVXlDi4oMg3okwbazyYdaPK-SdMDfy2uL2Chq6biJ5AyAfCAzQPq0MDKXjM8TqudCSNyMpOvYy1PX5aEdnaejN0On4KvbSGMMi6Ht8zYe9Vte3-LngPyh-pAyIRwCzq9JVDfcpFW8SnPbnMB8YcY2uygetnuaogXBa9lsgnvPk2KjFNoP9FD5cc-GS7uJI9UpuxBIdPBoIA2KNA3z8E9G4Da0xRlD6MIhCEQ9h_c2pjkchPrx0GzJxIKMaBpV-aXVohMjxyE6CHhLrnbtfgnRHoL8YCKTalYYdH1pbo-ysJq8Q6d_YNIst6bwtV6B4ehPkT1jMGoVmNaVItxIQnoM23TdErhc9-Wvzx1fXsC9Ah1-CZvBTlysEvJ6gLWnLzGmhQoKCD1ZIsYTNFIVL70NJZA9KquMrc0VckEqGFTrsER0KiL4Y3CwQrqBO9tKoiTa6b8SJjJFt6kV2DQpQ-2SUH6zGY0fjWOjkfl9enrAPvCVXUGeV3__Ajln00EVG7LIgHggoNbbJZuatNSqNqUcjplgkHOKSH5GbwEQd-BHN61Xr27MVBI6oA__OdGMQcy37ROBRrYLN-Yep2TwwCgPwAtATUHVUgBPEz8yL9A_zWdMllVRGM";

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

    const isDev = import.meta.env.DEV;

    if (isDev) {
      client = createSmartappDebugger({
        token: SALUTE_TOKEN,
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
