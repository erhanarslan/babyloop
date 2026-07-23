import type { ConfigContext, ExpoConfig } from "expo/config";
import baseConfig from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...baseConfig.expo,
  android: {
    ...baseConfig.expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
