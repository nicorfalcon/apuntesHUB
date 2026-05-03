export interface ActiveSession {
  id: string;
  label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  is_current?: boolean;
}

export interface LoginOkResponse {
  status: "ok";
}

export interface LoginLimitExceededResponse {
  status: "session_limit_exceeded";
  login_intent_token: string;
  active_sessions: ActiveSession[];
  recommended_session_id: string | null;
}

export interface LoginErrorResponse {
  status: "error";
  error:
    | "invalid_credentials"
    | "invalid_body"
    | "missing_credentials"
    | "missing_session"
    | "server_error";
  message: string;
}

export type LoginResponse =
  | LoginOkResponse
  | LoginLimitExceededResponse
  | LoginErrorResponse;

export interface LoginIntentState {
  token: string;
  sessions: ActiveSession[];
  recommendedSessionId: string | null;
  redirectTo: string;
}

export interface FinalizeLoginResponse {
  status: "ok" | "error";
  error?:
    | "invalid_body"
    | "missing_fields"
    | "intent_expired"
    | "intent_invalid"
    | "intent_consumed"
    | "device_not_found"
    | "device_limit"
    | "server_error";
  message?: string;
}
