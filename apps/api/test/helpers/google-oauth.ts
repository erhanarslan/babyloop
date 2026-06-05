import type {
  GoogleOAuthClient,
  GoogleUserInfo
} from "../../src/services/google-oauth.service.js";

export function createFakeGoogleOAuthClient(
  profilesByCode: Record<string, GoogleUserInfo>
): GoogleOAuthClient {
  return {
    async exchangeCodeForTokens(code) {
      if (!(code in profilesByCode)) {
        throw new Error("Unknown fake Google code.");
      }

      return {
        accessToken: `fake-google-access-token:${code}`
      };
    },
    async fetchUserInfo(accessToken) {
      const code = accessToken.replace("fake-google-access-token:", "");
      const profile = profilesByCode[code];

      if (!profile) {
        throw new Error("Unknown fake Google access token.");
      }

      return profile;
    }
  };
}
