export type MobilePushRegistrationStatus =
  | "registered"
  | "denied"
  | "unavailable"
  | "skipped"
  | "error";

export type MobilePushRegistrationResult = {
  status: MobilePushRegistrationStatus;
  reason?: string;
  tokenHashPrefix?: string;
};

type RegisterMobilePushTokenInput = {
  token: string;
  platform: "ios" | "android" | "expo";
  deviceLabel?: string;
};

type RegisterMobilePushToken = (input: RegisterMobilePushTokenInput) => Promise<unknown>;

type PermissionResponse = {
  granted?: boolean;
  status?: string;
};

type ExpoPushTokenResponse = {
  data?: string;
};

type NotificationsLike = {
  AndroidImportance?: {
    DEFAULT?: number;
    HIGH?: number;
  };
  getPermissionsAsync: () => Promise<PermissionResponse>;
  requestPermissionsAsync: () => Promise<PermissionResponse>;
  getExpoPushTokenAsync: (options?: { projectId?: string }) => Promise<ExpoPushTokenResponse>;
  setNotificationChannelAsync?: (
    channelId: string,
    channel: {
      name: string;
      importance?: number;
      vibrationPattern?: number[];
      lightColor?: string;
    }
  ) => Promise<unknown>;
};

type ConstantsLike = {
  isDevice?: boolean;
  deviceName?: string | null;
  expoConfig?: {
    extra?: {
      eas?: {
        projectId?: string;
      };
    };
  };
  easConfig?: {
    projectId?: string;
  };
};

export type MobilePushRegistrationDependencies = {
  constants: ConstantsLike;
  notifications: NotificationsLike;
  platformOS: string;
  registerToken: RegisterMobilePushToken;
};

export async function registerMobileDeviceForPushNotifications(
  dependencies?: Partial<MobilePushRegistrationDependencies>
): Promise<MobilePushRegistrationResult> {
  try {
    const deps = await resolvePushRegistrationDependencies(dependencies);

    if (deps.platformOS === "web") {
      return { status: "unavailable", reason: "web_not_supported" };
    }

    if (deps.constants.isDevice === false) {
      return { status: "unavailable", reason: "physical_device_required" };
    }

    await configureAndroidNotificationChannel(deps);

    const permission = await getGrantedPushPermission(deps.notifications);

    if (!permission) {
      return { status: "denied", reason: "permission_denied" };
    }

    const projectId = resolveExpoProjectId(deps.constants);
    const tokenResponse = await deps.notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const rawToken = tokenResponse.data;

    if (!rawToken || typeof rawToken !== "string") {
      return { status: "unavailable", reason: "missing_expo_push_token" };
    }

    const registration = await deps.registerToken({
      token: rawToken,
      platform: "expo",
      deviceLabel: buildSafeDeviceLabel(deps)
    });

    const tokenHashPrefix = readTokenHashPrefix(registration);

    return {
      status: "registered",
      ...(tokenHashPrefix ? { tokenHashPrefix } : {})
    };
  } catch {
    return { status: "error", reason: "push_registration_failed" };
  }
}

async function resolvePushRegistrationDependencies(
  dependencies: Partial<MobilePushRegistrationDependencies> | undefined
): Promise<MobilePushRegistrationDependencies> {
  if (
    dependencies?.constants &&
    dependencies.notifications &&
    dependencies.platformOS &&
    dependencies.registerToken
  ) {
    return dependencies as MobilePushRegistrationDependencies;
  }

  const [notificationsModule, constantsModule, reactNativeModule, notificationsApiModule] = await Promise.all([
    import("expo-notifications"),
    import("expo-constants"),
    import("react-native"),
    import("./notifications-api")
  ]);

  const platform = reactNativeModule.Platform as { OS: string };
  const registerToken = notificationsApiModule.registerMobilePushToken as RegisterMobilePushToken;

  return {
    constants: dependencies?.constants ?? (constantsModule.default as ConstantsLike),
    notifications: dependencies?.notifications ?? (notificationsModule as unknown as NotificationsLike),
    platformOS: dependencies?.platformOS ?? platform.OS,
    registerToken: dependencies?.registerToken ?? registerToken
  };
}

async function configureAndroidNotificationChannel(deps: MobilePushRegistrationDependencies): Promise<void> {
  if (deps.platformOS !== "android" || !deps.notifications.setNotificationChannelAsync) {
    return;
  }

  await deps.notifications.setNotificationChannelAsync("default", {
    name: "BabyLoop",
    importance: deps.notifications.AndroidImportance?.DEFAULT ?? deps.notifications.AndroidImportance?.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#7c3aed"
  });
}

async function getGrantedPushPermission(notifications: NotificationsLike): Promise<boolean> {
  const existingPermission = await notifications.getPermissionsAsync();

  if (isPermissionGranted(existingPermission)) {
    return true;
  }

  const requestedPermission = await notifications.requestPermissionsAsync();

  return isPermissionGranted(requestedPermission);
}

function isPermissionGranted(permission: PermissionResponse): boolean {
  return permission.granted === true || permission.status === "granted";
}

function resolveExpoProjectId(constants: ConstantsLike): string | undefined {
  return constants.easConfig?.projectId ?? constants.expoConfig?.extra?.eas?.projectId;
}

function buildSafeDeviceLabel(deps: MobilePushRegistrationDependencies): string {
  const deviceName = deps.constants.deviceName?.trim();

  if (deviceName && deviceName.length <= 80) {
    return deviceName;
  }

  if (deps.platformOS === "android") {
    return "Android device";
  }

  if (deps.platformOS === "ios") {
    return "iOS device";
  }

  return "Expo device";
}

function readTokenHashPrefix(value: unknown): string | undefined {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data) || !isRecord(value.data.token)) {
    return undefined;
  }

  const tokenHashPrefix = value.data.token.tokenHashPrefix;

  return typeof tokenHashPrefix === "string" ? tokenHashPrefix : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
