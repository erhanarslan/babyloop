export const BABYLOOP_SWAGGER_UI_SCRIPT = String.raw`
(() => {
  "use strict";

  const ROOT_ID = "babyloop-swagger-tools";
  const SEARCH_ID = "babyloop-swagger-search";
  const RESULT_ID = "babyloop-swagger-search-result";
  const ENDPOINT_COUNT_ID = "babyloop-swagger-endpoint-count";
  const MODULE_COUNT_ID = "babyloop-swagger-module-count";

  function normalize(value) {
    return String(value ?? "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/ı/gu, "i")
      .trim();
  }

  function setText(element, value) {
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  function enhanceInformationHeader() {
    const info = document.querySelector(".swagger-ui .info");

    if (!info || info.querySelector(".babyloop-api-kicker")) {
      return;
    }

    const kicker = document.createElement("div");
    kicker.className = "babyloop-api-kicker";
    kicker.textContent = "BABYLOOP TECHNICAL PLATFORM";

    info.prepend(kicker);

    const description = info.querySelector(".description");

    if (description && !info.querySelector(".babyloop-api-badges")) {
      const badges = document.createElement("div");
      badges.className = "babyloop-api-badges";
      badges.innerHTML = [
        "<span>OpenAPI 3.0</span>",
        "<span>Fastify 5</span>",
        "<span>Cookie + Bearer</span>",
        "<span>CSRF korumalı</span>",
        "<span>AI / RAG</span>"
      ].join("");

      description.insertAdjacentElement("afterend", badges);
    }
  }

  function mountTools() {
    if (document.getElementById(ROOT_ID)) {
      return;
    }

    const information = document.querySelector(
      ".swagger-ui .information-container"
    );

    if (!information) {
      return;
    }

    const section = document.createElement("section");
    section.id = ROOT_ID;
    section.className = "babyloop-swagger-tools";

    section.innerHTML = [
      '<div class="babyloop-swagger-tools__header">',
      '  <div class="babyloop-swagger-tools__heading">',
      '    <span class="babyloop-swagger-tools__eyebrow">API EXPLORER</span>',
      "    <strong>BabyLoop API gezgini</strong>",
      "    <p>Method, endpoint yolu, işlem özeti veya modül adıyla ara.</p>",
      "  </div>",
      '  <span class="babyloop-swagger-tools__status">',
      '    <span class="babyloop-swagger-tools__status-dot"></span>',
      "    Cookie + CSRF otomasyonu aktif",
      "  </span>",
      "</div>",

      '<div class="babyloop-swagger-tools__metrics">',
      '  <div class="babyloop-swagger-tools__metric">',
      '    <strong id="' + ENDPOINT_COUNT_ID + '">—</strong>',
      "    <span>endpoint</span>",
      "  </div>",
      '  <div class="babyloop-swagger-tools__metric">',
      '    <strong id="' + MODULE_COUNT_ID + '">—</strong>',
      "    <span>API modülü</span>",
      "  </div>",
      '  <div class="babyloop-swagger-tools__metric">',
      "    <strong>3.0.3</strong>",
      "    <span>OpenAPI contract</span>",
      "  </div>",
      '  <div class="babyloop-swagger-tools__metric">',
      "    <strong>JWT</strong>",
      "    <span>Bearer + HttpOnly cookie</span>",
      "  </div>",
      "</div>",

      '<div class="babyloop-swagger-tools__search-row">',
      '  <label for="' + SEARCH_ID + '">API ara</label>',
      '  <div class="babyloop-swagger-tools__search-field">',
      '    <span aria-hidden="true">⌕</span>',
      '    <input id="' + SEARCH_ID + '" type="search"',
      '      placeholder="auth/login, ilan, çocuk, POST, rag..."',
      '      autocomplete="off" spellcheck="false" />',
      "  </div>",
      '  <button type="button" id="' + SEARCH_ID + '-clear">Temizle</button>',
      "</div>",

      '<p id="' + RESULT_ID + '" class="babyloop-swagger-tools__result"></p>',

      '<details class="babyloop-swagger-tools__auth">',
      "  <summary>",
      '    <span class="babyloop-swagger-tools__auth-icon">↳</span>',
      "    Swagger üzerinden oturum ve yetkilendirme",
      "  </summary>",
      '  <div class="babyloop-swagger-tools__auth-content">',
      "    <ol>",
      "      <li>Public kullanıcı için <code>POST /api/v1/auth/login</code> çalıştır. Swagger örneğinde <code>clientType: mobile</code> kullanılır.</li>",
      "      <li>Backoffice için <code>POST /api/v1/auth/backoffice/login</code> çalıştır.</li>",
      "      <li>HttpOnly cookie sonraki isteklere otomatik eklenir.</li>",
      "      <li>Mutation işlemlerinde uygun CSRF token otomatik alınır.</li>",
      "      <li>Response bearer token içerirse Swagger Authorize alanı otomatik güncellenir.</li>",
      "    </ol>",
      "  </div>",
      "</details>"
    ].join("");

    information.insertAdjacentElement("afterend", section);

    const input = document.getElementById(SEARCH_ID);
    const clearButton = document.getElementById(SEARCH_ID + "-clear");

    input?.addEventListener("input", applySearch);

    clearButton?.addEventListener("click", () => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      input.value = "";
      input.focus();
      applySearch();
    });
  }

  function isSectionOpen(section) {
    return section.classList.contains("is-open");
  }

  function setSectionOpen(section, shouldOpen) {
    const currentlyOpen = isSectionOpen(section);

    if (currentlyOpen === shouldOpen) {
      return;
    }

    const tagButton = section.querySelector(".opblock-tag");

    if (tagButton instanceof HTMLElement) {
      tagButton.click();
    }
  }

  function updateMetrics(totalOperations, totalModules) {
    setText(
      document.getElementById(ENDPOINT_COUNT_ID),
      String(totalOperations)
    );

    setText(
      document.getElementById(MODULE_COUNT_ID),
      String(totalModules)
    );
  }

  function applySearch() {
    const input = document.getElementById(SEARCH_ID);
    const result = document.getElementById(RESULT_ID);

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const query = normalize(input.value);
    const sections = Array.from(
      document.querySelectorAll(".swagger-ui .opblock-tag-section")
    );

    let visibleOperations = 0;
    let totalOperations = 0;

    for (const section of sections) {
      const tagElement = section.querySelector(".opblock-tag");
      const tagText = normalize(tagElement?.textContent);
      const tagMatches = query.length > 0 && tagText.includes(query);
      const operations = Array.from(section.querySelectorAll(".opblock"));

      let sectionHasMatch = query.length === 0 || tagMatches;

      for (const operation of operations) {
        totalOperations += 1;

        const method = normalize(
          operation.querySelector(".opblock-summary-method")?.textContent
        );
        const path = normalize(
          operation.querySelector(".opblock-summary-path")?.textContent
        );
        const description = normalize(
          operation.querySelector(".opblock-summary-description")?.textContent
        );
        const operationText = normalize(operation.textContent);

        const matches =
          query.length === 0 ||
          tagMatches ||
          method.includes(query) ||
          path.includes(query) ||
          description.includes(query) ||
          operationText.includes(query);

        operation.hidden = !matches;

        if (matches) {
          visibleOperations += 1;
          sectionHasMatch = true;
        }
      }

      section.hidden = !sectionHasMatch;

      if (query.length > 0 && sectionHasMatch) {
        if (!isSectionOpen(section)) {
          section.dataset.babyloopSearchOpened = "true";
          setSectionOpen(section, true);
        }
      } else if (
        query.length === 0 &&
        section.dataset.babyloopSearchOpened === "true"
      ) {
        delete section.dataset.babyloopSearchOpened;
        setSectionOpen(section, false);
      }
    }

    updateMetrics(totalOperations, sections.length);

    if (query.length === 0) {
      setText(
        result,
        totalOperations > 0
          ? totalOperations +
              " endpoint, " +
              sections.length +
              " operasyon modülünde kataloglandı."
          : "Endpoint kataloğu hazırlanıyor."
      );
      return;
    }

    setText(
      result,
      visibleOperations > 0
        ? visibleOperations + " eşleşen endpoint bulundu."
        : "Bu aramayla eşleşen endpoint bulunamadı."
    );
  }

  let scheduled = false;

  function scheduleRender() {
    if (scheduled) {
      return;
    }

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      enhanceInformationHeader();
      mountTools();
      applySearch();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleRender, {
      once: true
    });
  } else {
    scheduleRender();
  }

  const observer = new MutationObserver(scheduleRender);

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
`;

export const BABYLOOP_SWAGGER_UI_CSS = String.raw`
:root {
  color-scheme: dark;
}

html,
body {
  min-height: 100%;
  background:
    radial-gradient(circle at 12% -10%, rgba(134, 109, 176, 0.16), transparent 30%),
    radial-gradient(circle at 90% 0%, rgba(74, 181, 142, 0.09), transparent 25%),
    #10141b !important;
}

.swagger-ui {
  min-height: 100vh;
  color: #e9edf5;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.swagger-ui .wrapper {
  max-width: 1460px;
  padding-right: 28px;
  padding-left: 28px;
}

.swagger-ui .topbar {
  display: none;
}

/* Product hero */

.swagger-ui .information-container {
  margin: 32px auto 22px;
  padding: 0;
}

.swagger-ui .info {
  position: relative;
  margin: 0 !important;
  padding: 34px 38px 32px;
  overflow: hidden;
  border: 1px solid rgba(173, 157, 211, 0.2);
  border-radius: 22px;
  background:
    linear-gradient(
      135deg,
      rgba(34, 37, 50, 0.97),
      rgba(21, 27, 37, 0.97)
    );
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.24),
    inset 0 1px rgba(255, 255, 255, 0.035);
}

.swagger-ui .info::after {
  position: absolute;
  top: -120px;
  right: -80px;
  width: 330px;
  height: 330px;
  border-radius: 999px;
  background:
    radial-gradient(
      circle,
      rgba(159, 128, 207, 0.16),
      rgba(159, 128, 207, 0)
    );
  content: "";
  pointer-events: none;
}

.babyloop-api-kicker {
  position: relative;
  z-index: 1;
  margin-bottom: 10px;
  color: #a996ce;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.swagger-ui .info .title {
  position: relative;
  z-index: 1;
  margin: 0 0 12px !important;
  color: #f6f7fb !important;
  font-size: clamp(34px, 4vw, 52px) !important;
  font-weight: 760 !important;
  letter-spacing: -0.045em;
}

.swagger-ui .info .title small {
  vertical-align: middle;
}

.swagger-ui .info .title small pre {
  border: 1px solid rgba(166, 145, 207, 0.26);
  border-radius: 999px;
  background: rgba(155, 130, 199, 0.15) !important;
  color: #cfc0e8 !important;
}

.swagger-ui .info p,
.swagger-ui .info li,
.swagger-ui .info table {
  position: relative;
  z-index: 1;
  color: #aeb7c6 !important;
}

.swagger-ui .info a {
  position: relative;
  z-index: 1;
  color: #8ed8b2 !important;
}

.babyloop-api-badges {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.babyloop-api-badges span {
  padding: 6px 10px;
  border: 1px solid rgba(142, 216, 178, 0.17);
  border-radius: 999px;
  background: rgba(142, 216, 178, 0.07);
  color: #a7dfc1;
  font-size: 11px;
  font-weight: 700;
}

/* Explorer panel */

.babyloop-swagger-tools {
  box-sizing: border-box;
  max-width: 1460px;
  margin: 0 auto 28px;
  padding: 24px 28px 20px;
  border: 1px solid rgba(139, 158, 193, 0.18);
  border-radius: 20px;
  background:
    linear-gradient(
      145deg,
      rgba(27, 33, 44, 0.98),
      rgba(19, 24, 33, 0.98)
    );
  box-shadow:
    0 18px 44px rgba(0, 0, 0, 0.22),
    inset 0 1px rgba(255, 255, 255, 0.035);
  color: #e8edf5;
}

.babyloop-swagger-tools__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.babyloop-swagger-tools__heading {
  min-width: 0;
}

.babyloop-swagger-tools__eyebrow {
  display: block;
  margin-bottom: 7px;
  color: #9c88c2;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.babyloop-swagger-tools__header strong {
  display: block;
  margin-bottom: 5px;
  color: #f4f6fa;
  font-size: 20px;
  letter-spacing: -0.02em;
}

.babyloop-swagger-tools__header p {
  margin: 0;
  color: #9ba6b6;
  font-size: 13px;
}

.babyloop-swagger-tools__status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(86, 196, 139, 0.23);
  border-radius: 999px;
  background: rgba(71, 172, 119, 0.09);
  color: #99deb9;
  font-size: 11px;
  font-weight: 750;
}

.babyloop-swagger-tools__status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #61d194;
  box-shadow: 0 0 0 4px rgba(97, 209, 148, 0.11);
}

.babyloop-swagger-tools__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.babyloop-swagger-tools__metric {
  min-width: 0;
  padding: 14px 15px;
  border: 1px solid rgba(137, 152, 181, 0.13);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.025);
}

.babyloop-swagger-tools__metric strong {
  display: block;
  overflow: hidden;
  margin-bottom: 3px;
  color: #f1f3f7;
  font-size: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.babyloop-swagger-tools__metric span {
  color: #8490a3;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.025em;
}

.babyloop-swagger-tools__search-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
}

.babyloop-swagger-tools__search-row label {
  color: #cbd2dd;
  font-size: 12px;
  font-weight: 750;
}

.babyloop-swagger-tools__search-field {
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid rgba(142, 157, 187, 0.2);
  border-radius: 11px;
  background: rgba(7, 11, 17, 0.52);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.babyloop-swagger-tools__search-field:focus-within {
  border-color: rgba(167, 142, 208, 0.58);
  background: rgba(9, 13, 20, 0.8);
  box-shadow: 0 0 0 3px rgba(150, 126, 190, 0.11);
}

.babyloop-swagger-tools__search-field > span {
  flex: 0 0 auto;
  padding-left: 13px;
  color: #7f8ba0;
  font-size: 21px;
}

.babyloop-swagger-tools__search-row input {
  box-sizing: border-box;
  width: 100%;
  min-height: 43px;
  padding: 9px 13px 9px 9px;
  border: 0;
  background: transparent;
  color: #eef1f6;
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.babyloop-swagger-tools__search-row input::placeholder {
  color: #697488;
}

.babyloop-swagger-tools__search-row button {
  min-height: 43px;
  padding: 8px 15px;
  border: 1px solid rgba(142, 157, 187, 0.2);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.035);
  color: #d5dbe5;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 750;
  transition:
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.babyloop-swagger-tools__search-row button:hover {
  border-color: rgba(168, 143, 208, 0.35);
  background: rgba(155, 129, 196, 0.1);
  color: #f3eefb;
}

.babyloop-swagger-tools__result {
  min-height: 17px;
  margin: 8px 0 0;
  color: #7f8a9d;
  font-size: 11px;
}

.babyloop-swagger-tools__auth {
  margin-top: 13px;
  border-top: 1px solid rgba(139, 153, 182, 0.12);
  padding-top: 13px;
}

.babyloop-swagger-tools__auth summary {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #bdc5d2;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  list-style: none;
}

.babyloop-swagger-tools__auth summary::-webkit-details-marker {
  display: none;
}

.babyloop-swagger-tools__auth-icon {
  color: #a68bc9;
  font-size: 16px;
}

.babyloop-swagger-tools__auth-content {
  margin-top: 12px;
  padding: 13px 15px;
  border: 1px solid rgba(139, 153, 182, 0.12);
  border-radius: 12px;
  background: rgba(7, 11, 17, 0.28);
}

.babyloop-swagger-tools__auth ol {
  margin: 0 0 0 19px;
  padding: 0;
  color: #929daf;
  font-size: 12px;
  line-height: 1.7;
}

.babyloop-swagger-tools__auth code {
  border: 1px solid rgba(162, 139, 199, 0.13);
  border-radius: 5px;
  background: rgba(147, 121, 188, 0.09);
  padding: 2px 5px;
  color: #cabbe1;
}

/* Server / authorization surface */

.swagger-ui .scheme-container {
  max-width: 1460px;
  margin: 0 auto 28px;
  padding: 18px 22px;
  border: 1px solid rgba(139, 153, 182, 0.15);
  border-radius: 16px;
  background: rgba(24, 30, 40, 0.84) !important;
  box-shadow: none !important;
}

.swagger-ui .scheme-container .schemes-title {
  color: #9ba6b7;
}

.swagger-ui select {
  border: 1px solid rgba(139, 153, 182, 0.28) !important;
  border-radius: 9px !important;
  background: #151b24 !important;
  color: #e2e7ef !important;
}

.swagger-ui .btn.authorize {
  border-color: #5ec88f !important;
  border-radius: 9px;
  color: #74dca4 !important;
}

.swagger-ui .btn.authorize svg {
  fill: #74dca4;
}

/* Tag groups */

.swagger-ui .opblock-tag-section {
  margin: 0 0 13px;
  overflow: hidden;
  border: 1px solid rgba(135, 150, 179, 0.13);
  border-radius: 15px;
  background: rgba(21, 27, 36, 0.72);
  box-shadow: 0 7px 22px rgba(0, 0, 0, 0.11);
}

.swagger-ui .opblock-tag {
  margin: 0 !important;
  padding: 17px 19px !important;
  border-bottom: 0 !important;
  color: #edf0f6 !important;
  font-size: 20px !important;
  letter-spacing: -0.025em;
  transition: background 140ms ease;
}

.swagger-ui .opblock-tag:hover {
  background: rgba(148, 124, 188, 0.055);
}

.swagger-ui .opblock-tag small {
  color: #8f9aac !important;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
}

.swagger-ui .opblock-tag svg {
  fill: #8e9aaf;
}

/* Operations */

.swagger-ui .opblock {
  margin: 8px 10px !important;
  overflow: hidden;
  border-width: 1px !important;
  border-radius: 10px !important;
  background: rgba(10, 15, 23, 0.46) !important;
  box-shadow: none !important;
}

.swagger-ui .opblock:last-child {
  margin-bottom: 10px !important;
}

.swagger-ui .opblock .opblock-summary {
  min-height: 50px;
  padding: 7px 10px;
  border-bottom: 0;
}

.swagger-ui .opblock .opblock-summary-method {
  min-width: 72px;
  border-radius: 7px;
  box-shadow: none;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.025em;
  text-shadow: none;
}

.swagger-ui .opblock-summary-path {
  color: #ecf0f6 !important;
  font-family:
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    monospace !important;
  font-size: 14px !important;
  font-weight: 660 !important;
}

.swagger-ui .opblock-summary-description {
  color: #8c98aa !important;
  font-size: 11px !important;
  font-weight: 500;
}

.swagger-ui .opblock-summary-operation-id {
  display: none !important;
}

.swagger-ui .opblock-summary-control:focus {
  outline: 2px solid rgba(165, 138, 207, 0.45);
  outline-offset: -2px;
}

.swagger-ui .opblock.opblock-get {
  border-color: rgba(82, 146, 221, 0.4) !important;
}

.swagger-ui .opblock.opblock-post {
  border-color: rgba(49, 190, 130, 0.4) !important;
}

.swagger-ui .opblock.opblock-put,
.swagger-ui .opblock.opblock-patch {
  border-color: rgba(211, 166, 74, 0.42) !important;
}

.swagger-ui .opblock.opblock-delete {
  border-color: rgba(218, 91, 103, 0.42) !important;
}

.swagger-ui .opblock-body {
  background: rgba(8, 12, 19, 0.7);
}

.swagger-ui .opblock-description-wrapper p,
.swagger-ui .opblock-external-docs-wrapper p,
.swagger-ui .opblock-title_normal p {
  color: #a5afbe !important;
}

/* Tables, parameters, response and models */

.swagger-ui table thead tr td,
.swagger-ui table thead tr th,
.swagger-ui .parameter__name,
.swagger-ui .response-col_status,
.swagger-ui .response-col_links {
  color: #dce2eb !important;
}

.swagger-ui .parameter__type,
.swagger-ui .parameter__deprecated,
.swagger-ui .response-col_description,
.swagger-ui .markdown p,
.swagger-ui .markdown li {
  color: #95a1b3 !important;
}

.swagger-ui input[type="text"],
.swagger-ui input[type="email"],
.swagger-ui input[type="password"],
.swagger-ui textarea {
  border: 1px solid rgba(139, 153, 182, 0.25) !important;
  border-radius: 8px !important;
  background: #111720 !important;
  color: #edf1f6 !important;
}

.swagger-ui .model-box,
.swagger-ui section.models,
.swagger-ui .model-container {
  border-color: rgba(139, 153, 182, 0.15) !important;
  background: rgba(20, 26, 35, 0.82) !important;
  color: #dce2eb !important;
}

.swagger-ui section.models {
  border-radius: 14px;
}

.swagger-ui section.models h4,
.swagger-ui .model-title,
.swagger-ui .model {
  color: #dce2eb !important;
}

.swagger-ui .prop-type {
  color: #9a84c1 !important;
}

.swagger-ui .prop-format {
  color: #7f8ba0 !important;
}

/* Dialog */

.swagger-ui .dialog-ux .modal-ux {
  border: 1px solid rgba(139, 153, 182, 0.2);
  border-radius: 16px;
  background: #171d27;
  color: #e8edf5;
}

.swagger-ui .dialog-ux .modal-ux-header {
  border-bottom-color: rgba(139, 153, 182, 0.15);
}

.swagger-ui .dialog-ux .modal-ux-header h3,
.swagger-ui .dialog-ux .modal-ux-content h4,
.swagger-ui .dialog-ux .modal-ux-content p {
  color: #dfe5ed;
}

/* Search visibility */

.swagger-ui .filter-container {
  display: none !important;
}

.swagger-ui .opblock-tag-section[hidden],
.swagger-ui .opblock[hidden] {
  display: none !important;
}

/* Responsive */

@media (max-width: 900px) {
  .babyloop-swagger-tools__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .swagger-ui .info {
    padding: 28px;
  }
}

@media (max-width: 760px) {
  .swagger-ui .wrapper {
    padding-right: 12px;
    padding-left: 12px;
  }

  .swagger-ui .information-container {
    margin-top: 14px;
  }

  .swagger-ui .info {
    padding: 23px 20px;
    border-radius: 17px;
  }

  .swagger-ui .info .title {
    font-size: 34px !important;
  }

  .babyloop-swagger-tools {
    margin-right: 12px;
    margin-left: 12px;
    padding: 19px 17px;
    border-radius: 17px;
  }

  .babyloop-swagger-tools__header {
    flex-direction: column;
  }

  .babyloop-swagger-tools__status {
    align-self: flex-start;
  }

  .babyloop-swagger-tools__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .babyloop-swagger-tools__search-row {
    grid-template-columns: 1fr auto;
  }

  .babyloop-swagger-tools__search-row label {
    grid-column: 1 / -1;
  }

  .swagger-ui .scheme-container {
    margin-right: 12px;
    margin-left: 12px;
  }

  .swagger-ui .opblock-tag {
    align-items: flex-start;
    font-size: 17px !important;
  }

  .swagger-ui .opblock-tag small {
    display: block;
    margin-top: 5px;
  }

  .swagger-ui .opblock .opblock-summary {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .swagger-ui .opblock-summary-path {
    width: calc(100% - 88px);
    font-size: 12px !important;
    word-break: break-word;
  }

  .swagger-ui .opblock-summary-description {
    width: 100%;
    margin: 5px 0 0 82px;
  }
}
`;
