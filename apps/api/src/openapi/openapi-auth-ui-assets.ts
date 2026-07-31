export const BABYLOOP_SWAGGER_AUTH_SCRIPT = String.raw`
(() => {
  "use strict";

  const PANEL_ID = "babyloop-swagger-session-panel";
  const MODE_STORAGE_KEY = "babyloop-swagger-session-mode";
  const PUBLIC_CSRF_STORAGE_KEY = "babyloop-swagger-public-csrf";
  const BACKOFFICE_CSRF_STORAGE_KEY =
    "babyloop-swagger-backoffice-csrf";

  let initialSessionCheckCompleted = false;

  function getStorage() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }

  function readMode() {
    const value = getStorage()?.getItem(MODE_STORAGE_KEY);

    return value === "backoffice" ? "backoffice" : "public";
  }

  function saveMode(mode) {
    getStorage()?.setItem(MODE_STORAGE_KEY, mode);
  }

  function getCsrfStorageKey(mode) {
    return mode === "backoffice"
      ? BACKOFFICE_CSRF_STORAGE_KEY
      : PUBLIC_CSRF_STORAGE_KEY;
  }

  function getLoginPath(mode) {
    return mode === "backoffice"
      ? "/api/v1/auth/backoffice/login"
      : "/api/v1/auth/login";
  }

  function getMePath(mode) {
    return mode === "backoffice"
      ? "/api/v1/auth/backoffice/me"
      : "/api/v1/auth/me";
  }

  function getCsrfPath(mode) {
    return mode === "backoffice"
      ? "/api/v1/auth/backoffice/csrf"
      : "/api/v1/auth/csrf";
  }

  function getLogoutPath(mode) {
    return mode === "backoffice"
      ? "/api/v1/auth/backoffice/logout"
      : "/api/v1/auth/logout";
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function getErrorMessage(body, fallback) {
    if (
      body &&
      typeof body === "object" &&
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.message === "string"
    ) {
      return body.error.message;
    }

    return fallback;
  }

  function getPanel() {
    return document.getElementById(PANEL_ID);
  }

  function getStatusElement() {
    return document.getElementById(
      "babyloop-swagger-session-status"
    );
  }

  function setStatus(kind, message) {
    const status = getStatusElement();

    if (!status) {
      return;
    }

    status.dataset.kind = kind;
    status.textContent = message;

    document.documentElement.classList.toggle(
      "babyloop-swagger-authenticated",
      kind === "success"
    );
  }

  function updateModeButtons(mode) {
    for (const button of document.querySelectorAll(
      "[data-babyloop-auth-mode]"
    )) {
      const active =
        button.getAttribute("data-babyloop-auth-mode") === mode;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    const helper = document.getElementById(
      "babyloop-swagger-session-helper"
    );

    if (helper) {
      helper.textContent =
        mode === "backoffice"
          ? "Yetkili ekip hesabına staff, normal hesaba salt okunur tanıtım scope’u ile HttpOnly cookie oturumu açar."
          : "Public kullanıcı hesabıyla cookie oturumu açar. Swagger isteğinde clientType mobile kullanılır.";
    }
  }

  async function preauthorizeBearerToken(body) {
    const token =
      body &&
      typeof body === "object" &&
      body.data &&
      typeof body.data === "object" &&
      typeof body.data.accessToken === "string"
        ? body.data.accessToken
        : null;

    if (!token) {
      return;
    }

    const swaggerUi = window.ui;

    if (
      swaggerUi &&
      typeof swaggerUi.preauthorizeApiKey === "function"
    ) {
      swaggerUi.preauthorizeApiKey("bearerAuth", token);
    }
  }

  async function refreshCsrf(mode) {
    const response = await fetch(getCsrfPath(mode), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    const body = await readJson(response);

    if (!response.ok || !body || body.ok !== true) {
      throw new Error(
        getErrorMessage(
          body,
          "CSRF oturumu hazırlanamadı."
        )
      );
    }

    const csrfToken =
      body.data &&
      typeof body.data === "object" &&
      typeof body.data.csrfToken === "string"
        ? body.data.csrfToken
        : null;

    if (!csrfToken) {
      throw new Error("CSRF token response içinde bulunamadı.");
    }

    getStorage()?.setItem(
      getCsrfStorageKey(mode),
      csrfToken
    );

    return csrfToken;
  }

  async function verifySession(mode, options = {}) {
    if (!options.silent) {
      setStatus("loading", "Oturum doğrulanıyor…");
    }

    const response = await fetch(getMePath(mode), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });

    const body = await readJson(response);

    if (!response.ok || !body || body.ok !== true) {
      if (!options.silent) {
        setStatus(
          "idle",
          mode === "backoffice"
            ? "Aktif backoffice oturumu bulunamadı."
            : "Aktif public oturum bulunamadı."
        );
      }

      return false;
    }

    const user =
      body.data &&
      typeof body.data === "object" &&
      body.data.user &&
      typeof body.data.user === "object"
        ? body.data.user
        : null;

    const email =
      user && typeof user.email === "string"
        ? user.email
        : null;

    const role =
      user && typeof user.role === "string"
        ? user.role
        : null;

    const identity = [email, role]
      .filter(Boolean)
      .join(" · ");

    setStatus(
      "success",
      identity
        ? "Oturum aktif · " + identity
        : "Oturum aktif"
    );

    saveMode(mode);
    updateModeButtons(mode);

    return true;
  }

  async function login(event) {
    event.preventDefault();

    const panel = getPanel();

    if (!panel) {
      return;
    }

    const mode = readMode();
    const emailInput = panel.querySelector(
      "[data-babyloop-auth-email]"
    );
    const passwordInput = panel.querySelector(
      "[data-babyloop-auth-password]"
    );
    const submitButton = panel.querySelector(
      "[data-babyloop-auth-submit]"
    );

    if (
      !(emailInput instanceof HTMLInputElement) ||
      !(passwordInput instanceof HTMLInputElement) ||
      !(submitButton instanceof HTMLButtonElement)
    ) {
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setStatus(
        "error",
        "E-posta ve parola alanlarını doldur."
      );
      return;
    }

    submitButton.disabled = true;
    setStatus("loading", "Oturum açılıyor…");

    const payload =
      mode === "backoffice"
        ? {
            email,
            password
          }
        : {
            email,
            password,
            clientType: "mobile"
          };

    try {
      getStorage()?.removeItem(getCsrfStorageKey(mode));

      const response = await fetch(getLoginPath(mode), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = await readJson(response);

      if (!response.ok || !body || body.ok !== true) {
        throw new Error(
          getErrorMessage(body, "Oturum açılamadı.")
        );
      }

      const responseData =
        body.data && typeof body.data === "object"
          ? body.data
          : null;

      if (
        responseData &&
        (responseData.mfaRequired === true ||
          responseData.approvalRequired === true ||
          typeof responseData.challengeId === "string")
      ) {
        throw new Error(
          "Bu hesap ek doğrulama istiyor. MFA veya giriş onayı endpoint'ini tamamla ya da Swagger için MFA kapalı demo hesabı kullan."
        );
      }

      await preauthorizeBearerToken(body);
      await refreshCsrf(mode);

      const verified = await verifySession(mode, {
        silent: true
      });

      if (!verified) {
        throw new Error(
          "Login başarılı göründü fakat cookie oturumu doğrulanamadı."
        );
      }

      passwordInput.value = "";
    } catch (error) {
      setStatus(
        "error",
        error instanceof Error
          ? error.message
          : "Oturum açılamadı."
      );
    } finally {
      submitButton.disabled = false;
    }
  }

  async function logout() {
    const mode = readMode();
    const csrfToken =
      getStorage()?.getItem(getCsrfStorageKey(mode)) ?? null;

    setStatus("loading", "Oturum kapatılıyor…");

    try {
      await fetch(getLogoutPath(mode), {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(csrfToken
            ? {
                "x-babyloop-csrf-token": csrfToken
              }
            : {})
        }
      });
    } finally {
      getStorage()?.removeItem(getCsrfStorageKey(mode));

      const swaggerUi = window.ui;

      if (
        swaggerUi &&
        swaggerUi.authActions &&
        typeof swaggerUi.authActions.logout === "function"
      ) {
        swaggerUi.authActions.logout(["bearerAuth"]);
      }

      setStatus("idle", "Oturum kapatıldı.");
    }
  }

  function mountSessionPanel() {
    if (getPanel()) {
      return;
    }

    const tools = document.getElementById(
      "babyloop-swagger-tools"
    );

    if (!tools) {
      return;
    }

    const searchRow = tools.querySelector(
      ".babyloop-swagger-tools__search-row"
    );

    if (!searchRow) {
      return;
    }

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.className = "babyloop-swagger-session";

    panel.innerHTML = [
      '<div class="babyloop-swagger-session__header">',
      "  <div>",
      '    <span class="babyloop-swagger-session__eyebrow">TEST SESSION</span>',
      "    <strong>Swagger oturumu</strong>",
      '    <p id="babyloop-swagger-session-helper"></p>',
      "  </div>",
      '  <span id="babyloop-swagger-session-status" data-kind="idle">Oturum yok</span>',
      "</div>",

      '<div class="babyloop-swagger-session__modes" role="group" aria-label="Oturum türü">',
      '  <button type="button" data-babyloop-auth-mode="public">Public kullanıcı</button>',
      '  <button type="button" data-babyloop-auth-mode="backoffice">Backoffice</button>',
      "</div>",

      '<form class="babyloop-swagger-session__form">',
      '  <label>',
      "    <span>E-posta</span>",
      '    <input type="email" data-babyloop-auth-email autocomplete="username" placeholder="demo@babyloop.local" />',
      "  </label>",
      '  <label>',
      "    <span>Parola</span>",
      '    <input type="password" data-babyloop-auth-password autocomplete="current-password" placeholder="••••••••" />',
      "  </label>",
      '  <button type="submit" data-babyloop-auth-submit>Oturum aç</button>',
      "</form>",

      '<div class="babyloop-swagger-session__actions">',
      '  <button type="button" data-babyloop-auth-verify>Oturumu doğrula</button>',
      '  <button type="button" data-babyloop-auth-logout>Çıkış yap</button>',
      "  <span>Parola tarayıcı depolamasına yazılmaz.</span>",
      "</div>"
    ].join("");

    searchRow.insertAdjacentElement("beforebegin", panel);

    const form = panel.querySelector("form");

    form?.addEventListener("submit", login);

    for (const button of panel.querySelectorAll(
      "[data-babyloop-auth-mode]"
    )) {
      button.addEventListener("click", () => {
        const requestedMode = button.getAttribute(
          "data-babyloop-auth-mode"
        );

        if (
          requestedMode !== "public" &&
          requestedMode !== "backoffice"
        ) {
          return;
        }

        saveMode(requestedMode);
        updateModeButtons(requestedMode);
        setStatus("idle", "Oturum türü değiştirildi.");
      });
    }

    panel
      .querySelector("[data-babyloop-auth-verify]")
      ?.addEventListener("click", () => {
        verifySession(readMode());
      });

    panel
      .querySelector("[data-babyloop-auth-logout]")
      ?.addEventListener("click", logout);

    const mode = readMode();

    updateModeButtons(mode);

    if (!initialSessionCheckCompleted) {
      initialSessionCheckCompleted = true;

      verifySession(mode, {
        silent: true
      }).then((verified) => {
        if (!verified) {
          setStatus("idle", "Oturum yok");
        }
      });
    }
  }

  function polishAuthorizeModal() {
    const modal = document.querySelector(
      ".swagger-ui .dialog-ux .modal-ux"
    );

    if (!modal) {
      return;
    }

    const hiddenSchemes = [
      "publiccookieauth",
      "backofficecookieauth",
      "refreshcookieauth",
      "csrfheader"
    ];

    for (const container of modal.querySelectorAll(
      ".auth-container"
    )) {
      const text = String(
        container.textContent ?? ""
      ).toLocaleLowerCase("tr-TR");

      container.hidden = hiddenSchemes.some((scheme) =>
        text.includes(scheme)
      );
    }

    const content = modal.querySelector(
      ".modal-ux-content"
    );

    if (
      content &&
      !content.querySelector(".babyloop-auth-modal-note")
    ) {
      const note = document.createElement("div");
      note.className = "babyloop-auth-modal-note";
      note.innerHTML = [
        "<strong>Manuel Bearer yetkilendirmesi</strong>",
        "<p>HttpOnly cookie ve CSRF alanları elle doldurulmaz. Public veya backoffice oturumu için sayfanın üstündeki Swagger oturumu panelini kullan.</p>"
      ].join("");

      content.prepend(note);
    }
  }

  let framePending = false;

  function scheduleEnhancement() {
    if (framePending) {
      return;
    }

    framePending = true;

    requestAnimationFrame(() => {
      framePending = false;
      mountSessionPanel();
      polishAuthorizeModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleEnhancement,
      {
        once: true
      }
    );
  } else {
    scheduleEnhancement();
  }

  new MutationObserver(scheduleEnhancement).observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );
})();
`;

export const BABYLOOP_SWAGGER_AUTH_CSS = String.raw`
/* Swagger session panel */

.babyloop-swagger-session {
  margin: 18px 0;
  padding: 17px;
  border: 1px solid rgba(135, 153, 188, 0.16);
  border-radius: 14px;
  background: rgba(8, 13, 21, 0.34);
}

.babyloop-swagger-session__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.babyloop-swagger-session__eyebrow {
  display: block;
  margin-bottom: 5px;
  color: #9d87c4;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.babyloop-swagger-session__header strong {
  display: block;
  margin-bottom: 4px;
  color: #f0f3f8;
  font-size: 15px;
}

.babyloop-swagger-session__header p {
  margin: 0;
  color: #8793a6;
  font-size: 11px;
}

#babyloop-swagger-session-status {
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid rgba(139, 154, 184, 0.19);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.025);
  color: #9aa5b6;
  font-size: 10px;
  font-weight: 750;
}

#babyloop-swagger-session-status[data-kind="success"] {
  border-color: rgba(89, 211, 148, 0.28);
  background: rgba(67, 184, 122, 0.1);
  color: #8ce0b3;
}

#babyloop-swagger-session-status[data-kind="error"] {
  border-color: rgba(223, 94, 108, 0.3);
  background: rgba(200, 64, 79, 0.09);
  color: #f0a4ae;
}

#babyloop-swagger-session-status[data-kind="loading"] {
  border-color: rgba(101, 163, 225, 0.3);
  color: #9dc8f0;
}

.babyloop-swagger-session__modes {
  display: inline-flex;
  gap: 4px;
  margin-top: 14px;
  padding: 4px;
  border: 1px solid rgba(135, 153, 188, 0.14);
  border-radius: 10px;
  background: rgba(5, 9, 15, 0.35);
}

.babyloop-swagger-session__modes button {
  padding: 7px 11px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #8793a6;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
}

.babyloop-swagger-session__modes button.is-active {
  background: rgba(151, 127, 192, 0.16);
  color: #d2c5e5;
}

.babyloop-swagger-session__form {
  display: grid;
  grid-template-columns:
    minmax(190px, 1fr)
    minmax(190px, 1fr)
    auto;
  align-items: end;
  gap: 10px;
  margin-top: 13px;
}

.babyloop-swagger-session__form label {
  display: grid;
  gap: 6px;
  color: #9ca7b7;
  font-size: 10px;
  font-weight: 700;
}

.babyloop-swagger-session__form input {
  box-sizing: border-box !important;
  width: 100% !important;
  min-height: 40px;
  padding: 9px 11px !important;
  border: 1px solid rgba(139, 156, 188, 0.22) !important;
  border-radius: 9px !important;
  background: #0f151e !important;
  color: #eef2f7 !important;
  font-family: inherit !important;
  font-size: 12px !important;
  outline: none;
}

.babyloop-swagger-session__form input:focus {
  border-color: rgba(163, 139, 204, 0.56) !important;
  box-shadow: 0 0 0 3px rgba(147, 123, 188, 0.1);
}

.babyloop-swagger-session__form button {
  min-height: 40px;
  padding: 8px 15px;
  border: 1px solid rgba(88, 210, 145, 0.35);
  border-radius: 9px;
  background: rgba(72, 187, 125, 0.12);
  color: #8de0b4;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
}

.babyloop-swagger-session__form button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.babyloop-swagger-session__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.babyloop-swagger-session__actions button {
  padding: 6px 9px;
  border: 1px solid rgba(139, 155, 186, 0.17);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
  color: #aab3c1;
  cursor: pointer;
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
}

.babyloop-swagger-session__actions span {
  margin-left: auto;
  color: #687488;
  font-size: 9px;
}

/* Keep explorer search dark even when Swagger styles load later */

.babyloop-swagger-tools__search-field {
  background: #0f151e !important;
}

.babyloop-swagger-tools__search-row input {
  background: transparent !important;
  color: #eef2f7 !important;
  -webkit-text-fill-color: #eef2f7 !important;
}

.babyloop-swagger-tools__search-row input::placeholder {
  color: #697589 !important;
}

/* Authorization lock icons */

.swagger-ui .authorization__btn {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  opacity: 1 !important;
}

.swagger-ui .authorization__btn svg {
  fill: #8d9aae !important;
  color: #8d9aae !important;
  opacity: 1 !important;
}

.swagger-ui .authorization__btn.unlocked svg,
.babyloop-swagger-authenticated
  .swagger-ui
  .authorization__btn
  svg {
  fill: #63d49a !important;
  color: #63d49a !important;
}

.swagger-ui .opblock-control-arrow svg,
.swagger-ui .expand-operation svg,
.swagger-ui .models-control svg {
  fill: #9aa6b8 !important;
}

/* Authorization dialog */

.swagger-ui .dialog-ux .backdrop-ux {
  background: rgba(3, 7, 12, 0.82) !important;
}

.swagger-ui .dialog-ux .modal-ux {
  width: min(690px, calc(100vw - 32px)) !important;
  max-width: 690px !important;
  max-height: 88vh;
  margin: 5vh auto !important;
  overflow: hidden;
  border: 1px solid rgba(142, 158, 190, 0.22) !important;
  border-radius: 17px !important;
  background: #171e29 !important;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.48) !important;
}

.swagger-ui .dialog-ux .modal-ux-header {
  padding: 18px 22px !important;
  border-bottom: 1px solid rgba(142, 158, 190, 0.16) !important;
}

.swagger-ui .dialog-ux .modal-ux-header h3 {
  color: #eef2f7 !important;
  font-size: 18px !important;
}

.swagger-ui .dialog-ux .modal-ux-header .close-modal svg {
  fill: #a7b1bf !important;
}

.swagger-ui .dialog-ux .modal-ux-content {
  box-sizing: border-box;
  max-height: calc(88vh - 70px);
  overflow-y: auto;
  padding: 20px 22px !important;
}

.swagger-ui .auth-container {
  margin: 0 !important;
  padding: 18px 0 !important;
  border-bottom: 1px solid rgba(142, 158, 190, 0.14) !important;
}

.swagger-ui .auth-container[hidden] {
  display: none !important;
}

.swagger-ui .auth-container h4,
.swagger-ui .auth-container label,
.swagger-ui .auth-container p {
  color: #cfd6e1 !important;
}

.swagger-ui .auth-container input[type="text"],
.swagger-ui .auth-container input[type="password"] {
  box-sizing: border-box !important;
  width: 100% !important;
  min-height: 42px;
  border: 1px solid rgba(145, 162, 194, 0.28) !important;
  background: #0f151e !important;
  color: #eef2f7 !important;
}

.swagger-ui .auth-btn-wrapper {
  display: flex !important;
  justify-content: flex-start !important;
  gap: 9px;
  padding: 13px 0 0 !important;
}

.babyloop-auth-modal-note {
  margin-bottom: 4px;
  padding: 13px 15px;
  border: 1px solid rgba(110, 172, 229, 0.21);
  border-radius: 11px;
  background: rgba(73, 129, 185, 0.08);
}

.babyloop-auth-modal-note strong {
  display: block;
  margin-bottom: 4px;
  color: #b9d8f2;
  font-size: 12px;
}

.babyloop-auth-modal-note p {
  margin: 0;
  color: #94a6b8;
  font-size: 11px;
  line-height: 1.55;
}

/* Expanded operation readability */

.swagger-ui .opblock .opblock-section-header {
  min-height: 48px;
  padding: 12px 20px !important;
  border-top: 1px solid rgba(139, 156, 187, 0.14);
  border-bottom: 1px solid rgba(139, 156, 187, 0.14);
  background: #161d28 !important;
  box-shadow: none !important;
}

.swagger-ui .opblock .opblock-section-header h4,
.swagger-ui .opblock .opblock-section-header label {
  color: #d9e0e9 !important;
}

.swagger-ui .parameters-container,
.swagger-ui .responses-inner,
.swagger-ui .execute-wrapper {
  background: #0d131c !important;
}

.swagger-ui .parameters-container {
  padding: 8px 20px 18px;
}

.swagger-ui .responses-inner {
  padding: 14px 20px 22px;
}

.swagger-ui table tbody tr td {
  border-bottom-color: rgba(139, 156, 187, 0.12) !important;
  color: #aeb8c7 !important;
}

.swagger-ui .parameter__name,
.swagger-ui .response-col_status {
  color: #e1e6ee !important;
}

.swagger-ui .parameter__in,
.swagger-ui .parameter__type,
.swagger-ui .parameter__deprecated {
  color: #8895a8 !important;
}

.swagger-ui .btn.execute {
  border-color: #4fc78a !important;
  background: rgba(60, 186, 119, 0.12) !important;
  color: #7cdfaa !important;
}

.swagger-ui .btn.cancel {
  border-color: #e26773 !important;
  background: rgba(202, 67, 82, 0.08) !important;
  color: #f0929b !important;
}

.swagger-ui .highlight-code,
.swagger-ui .microlight,
.swagger-ui .curl-command {
  background: #090e15 !important;
  color: #cdd5e0 !important;
}

.swagger-ui .response-control-media-type__accept-message {
  color: #8592a5 !important;
}

@media (max-width: 760px) {
  .babyloop-swagger-session__header {
    flex-direction: column;
  }

  #babyloop-swagger-session-status {
    align-self: flex-start;
  }

  .babyloop-swagger-session__form {
    grid-template-columns: 1fr;
  }

  .babyloop-swagger-session__actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .babyloop-swagger-session__actions span {
    margin-left: 0;
  }
}
`;
