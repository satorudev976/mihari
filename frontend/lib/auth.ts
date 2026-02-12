import * as AuthSession from "expo-auth-session";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export function useGoogleAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "subscripnotify" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri };
}

// Simple UID management (in production, use Firebase Auth or similar)
export async function getOrCreateUid(): Promise<string> {
  let uid = await SecureStore.getItemAsync("uid");
  if (!uid) {
    uid = Crypto.randomUUID();
    await SecureStore.setItemAsync("uid", uid);
  }
  return uid;
}
