import test from "node:test";
import assert from "node:assert/strict";

import {
  getVisibleWhatsAppPhoneNumber,
  getWhatsAppReconnectDelayMs,
  getWhatsAppStatusPollingIntervalMs,
} from "@/lib/surveys";

test("getWhatsAppReconnectDelayMs aplica backoff limitado", () => {
  assert.equal(getWhatsAppReconnectDelayMs(0), 5_000);
  assert.equal(getWhatsAppReconnectDelayMs(1), 10_000);
  assert.equal(getWhatsAppReconnectDelayMs(2), 20_000);
  assert.equal(getWhatsAppReconnectDelayMs(3), 30_000);
  assert.equal(getWhatsAppReconnectDelayMs(4), 30_000);
});

test("getWhatsAppStatusPollingIntervalMs acelera el polling en estados transitorios", () => {
  assert.equal(getWhatsAppStatusPollingIntervalMs("connected"), 10_000);
  assert.equal(getWhatsAppStatusPollingIntervalMs("connecting"), 2_500);
  assert.equal(getWhatsAppStatusPollingIntervalMs("qr_required"), 2_500);
  assert.equal(getWhatsAppStatusPollingIntervalMs("disconnecting"), 2_500);
  assert.equal(getWhatsAppStatusPollingIntervalMs("error"), 5_000);
  assert.equal(getWhatsAppStatusPollingIntervalMs("disconnected"), 5_000);
});

test("getVisibleWhatsAppPhoneNumber solo muestra el numero cuando la sesion esta conectada", () => {
  assert.equal(getVisibleWhatsAppPhoneNumber("connected", "5492996737467"), "5492996737467");
  assert.equal(getVisibleWhatsAppPhoneNumber("disconnecting", "5492996737467"), null);
  assert.equal(getVisibleWhatsAppPhoneNumber("error", "5492996737467"), null);
  assert.equal(getVisibleWhatsAppPhoneNumber("connected", null), null);
});
