import { registerMobileDeviceForPushNotifications } from "./mobile-push-registration";

function createNotificationsMock(overrides: Partial<{
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getExpoPushTokenAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  setNotificationHandler: jest.Mock;
}> = {}) {
  return {
    AndroidImportance: {
      DEFAULT: 3,
      HIGH: 4
    },
    getPermissionsAsync: overrides.getPermissionsAsync ?? jest.fn().mockResolvedValue({ granted: true, status: "granted" }),
    requestPermissionsAsync: overrides.requestPermissionsAsync ?? jest.fn().mockResolvedValue({ granted: true, status: "granted" }),
    getExpoPushTokenAsync: overrides.getExpoPushTokenAsync ?? jest.fn().mockResolvedValue({ data: "ExponentPushToken[raw-device-token]" }),
    setNotificationChannelAsync: overrides.setNotificationChannelAsync ?? jest.fn().mockResolvedValue(undefined),
    setNotificationHandler: overrides.setNotificationHandler ?? jest.fn()
  };
}

describe("mobile push registration", () => {
  it("registers an Expo push token without exposing the raw token in the result", async () => {
    const notifications = createNotificationsMock();
    const registerToken = jest.fn().mockResolvedValue({
      success: true,
      data: {
        token: {
          id: "token-id",
          platform: "expo",
          tokenHashPrefix: "abcdef123456",
          deviceLabel: "Galaxy S22"
        }
      }
    });

    const result = await registerMobileDeviceForPushNotifications({
      constants: {
        isDevice: true,
        deviceName: "Galaxy S22",
        easConfig: {
          projectId: "project-id"
        }
      },
      notifications,
      platformOS: "android",
      registerToken
    });

    expect(result).toEqual({
      status: "registered",
      tokenHashPrefix: "abcdef123456"
    });
    expect(notifications.setNotificationHandler).toHaveBeenCalled();
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        importance: 4,
        name: "BabyLoop",
        sound: "default"
      })
    );
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "project-id" });
    expect(registerToken).toHaveBeenCalledWith({
      token: "ExponentPushToken[raw-device-token]",
      platform: "expo",
      deviceLabel: "Galaxy S22"
    });
    expect(JSON.stringify(result)).not.toContain("raw-device-token");
  });

  it("requests permission and returns denied when permission is not granted", async () => {
    const notifications = createNotificationsMock({
      getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, status: "undetermined" }),
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, status: "denied" })
    });
    const registerToken = jest.fn();

    const result = await registerMobileDeviceForPushNotifications({
      constants: {
        isDevice: true
      },
      notifications,
      platformOS: "ios",
      registerToken
    });

    expect(result).toEqual({
      status: "denied",
      reason: "permission_denied"
    });
    expect(registerToken).not.toHaveBeenCalled();
  });

  it("skips unsupported devices without registering a token", async () => {
    const notifications = createNotificationsMock();
    const registerToken = jest.fn();

    const result = await registerMobileDeviceForPushNotifications({
      constants: {
        isDevice: false
      },
      notifications,
      platformOS: "android",
      registerToken
    });

    expect(result).toEqual({
      status: "unavailable",
      reason: "physical_device_required"
    });
    expect(registerToken).not.toHaveBeenCalled();
  });

  it("handles provider errors without throwing or leaking raw token values", async () => {
    const notifications = createNotificationsMock({
      getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExponentPushToken[raw-device-token]" })
    });
    const registerToken = jest.fn().mockRejectedValue(new Error("network failed"));

    const result = await registerMobileDeviceForPushNotifications({
      constants: {
        isDevice: true
      },
      notifications,
      platformOS: "android",
      registerToken
    });

    expect(result).toEqual({
      status: "error",
      reason: "push_registration_failed"
    });
    expect(JSON.stringify(result)).not.toContain("raw-device-token");
  });
  it("does not claim registered when the API push-token registration fails", async () => {
    const notifications = createNotificationsMock();
    const registerToken = jest.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "API_UNAVAILABLE",
        message: "BabyLoop bildirimleri şu an yüklenemedi."
      }
    });

    const result = await registerMobileDeviceForPushNotifications({
      constants: {
        isDevice: true,
        deviceName: "Galaxy S22",
        easConfig: {
          projectId: "project-id"
        }
      },
      notifications,
      platformOS: "android",
      registerToken
    });

    expect(result).toEqual({
      status: "error",
      reason: "push_token_register_failed"
    });
    expect(registerToken).toHaveBeenCalledWith({
      token: "ExponentPushToken[raw-device-token]",
      platform: "expo",
      deviceLabel: "Galaxy S22"
    });
  });

});
