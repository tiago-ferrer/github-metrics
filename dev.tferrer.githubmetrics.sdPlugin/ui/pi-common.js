/**
 * Protocolo clássico de websocket do Property Inspector do Stream Deck (a comunicação da
 * página HTML do PI com o app é sempre esse websocket local — não passa pelo backend Node
 * nem pelo pacote @elgato/streamdeck, que só cobre o lado do plugin).
 *
 * Uso: elementos com `data-setting="chave"` são lidos/gravados nas settings da action instance;
 * elementos com `data-global-setting="chave"` são lidos/gravados nas Global Settings do plugin.
 * `data-type="number"` converte o valor para Number antes de salvar. `data-type="minutes"` é
 * como "number", mas o campo mostra/recebe minutos enquanto o valor gravado continua em
 * segundos (ex.: refreshIntervalSeconds) — só a exibição muda, a settings guardada é a mesma
 * de sempre, então configurações já salvas por versões antigas do plugin continuam valendo.
 */
(function () {
  let websocket = null;
  let piUUID = null;
  let currentSettings = {};
  let currentGlobalSettings = {};
  let ready = false;
  const readyCallbacks = [];

  // Valor exibido no campo → valor gravado na settings.
  function coerce(el, rawValue) {
    if (el.dataset.type === "minutes") return Math.round(Number(rawValue) * 60);
    if (el.dataset.type === "number") return Number(rawValue);
    return rawValue;
  }

  // Valor gravado na settings → valor exibido no campo (inverso de coerce).
  function displayValue(el, storedValue) {
    return el.dataset.type === "minutes" ? storedValue / 60 : storedValue;
  }

  function applyValues() {
    document.querySelectorAll("[data-setting]").forEach((el) => {
      const key = el.dataset.setting;
      if (key in currentSettings && currentSettings[key] !== undefined) el.value = displayValue(el, currentSettings[key]);
    });
    document.querySelectorAll("[data-global-setting]").forEach((el) => {
      const key = el.dataset.globalSetting;
      if (key in currentGlobalSettings && currentGlobalSettings[key] !== undefined) el.value = displayValue(el, currentGlobalSettings[key]);
    });
  }

  function wireInputs() {
    document.querySelectorAll("[data-setting]").forEach((el) => {
      el.addEventListener("change", () => {
        currentSettings[el.dataset.setting] = coerce(el, el.value);
        websocket.send(JSON.stringify({ event: "setSettings", context: piUUID, payload: currentSettings }));
      });
    });
    document.querySelectorAll("[data-global-setting]").forEach((el) => {
      el.addEventListener("change", () => {
        currentGlobalSettings[el.dataset.globalSetting] = coerce(el, el.value);
        websocket.send(JSON.stringify({ event: "setGlobalSettings", context: piUUID, payload: currentGlobalSettings }));
      });
    });
  }

  function fireReady() {
    if (ready) return;
    ready = true;
    readyCallbacks.splice(0).forEach((cb) => cb());
  }

  // Chamado pelo próprio Stream Deck ao carregar a página do PI.
  window.connectElgatoStreamDeckSocket = function (inPort, inPropertyInspectorUUID, inRegisterEvent, _inInfo, inActionInfo) {
    piUUID = inPropertyInspectorUUID;
    websocket = new WebSocket("ws://127.0.0.1:" + inPort);

    const actionInfo = JSON.parse(inActionInfo);
    currentSettings = actionInfo.payload?.settings ?? {};

    websocket.onopen = function () {
      websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: piUUID }));
      websocket.send(JSON.stringify({ event: "getGlobalSettings", context: piUUID }));
    };

    websocket.onmessage = function (evt) {
      const msg = JSON.parse(evt.data);
      if (msg.event === "didReceiveGlobalSettings") {
        currentGlobalSettings = msg.payload.settings ?? {};
        applyValues();
        fireReady();
      }
      if (msg.event === "didReceiveSettings") {
        currentSettings = msg.payload.settings ?? {};
        applyValues();
      }
    };
  };

  document.addEventListener("DOMContentLoaded", () => {
    wireInputs();
    applyValues();
  });

  window.PI = {
    onReady(cb) {
      if (ready) cb();
      else readyCallbacks.push(cb);
    },
  };
})();
