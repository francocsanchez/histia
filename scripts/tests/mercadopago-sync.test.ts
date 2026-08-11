import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMovementComponents,
  parseMercadoPagoAmountToCents,
  parseMercadoPagoCsv,
} from "@/services/mercadopago-sync";

function buildBaseRow(overrides?: Partial<Parameters<typeof buildMovementComponents>[0]>) {
  return {
    sourceId: "173045260750",
    reportId: 102748383,
    paymentMethodType: "bank_transfer",
    transactionType: "SETTLEMENT",
    transactionAmountCentavos: 5_000_000,
    transactionDate: new Date("2026-08-10T12:44:45.000-03:00"),
    feeAmountCentavos: 0,
    settlementDate: new Date("2026-08-10T12:44:46.000-03:00"),
    realAmountCentavos: 4_970_000,
    taxesAmountCentavos: -30_000,
    moneyReleaseDate: new Date("2026-08-10T12:44:46.000-03:00"),
    reconciliationDifferenceCentavos: 0,
    reconciliationExpectedCentavos: 4_970_000,
    createdByUserId: "admin-id",
    ...overrides,
  };
}

test("descompone TRANSACTION positivo e impuestos negativos", () => {
  const components = buildMovementComponents(buildBaseRow());

  assert.equal(components.length, 2);
  assert.deepEqual(
    components.map((item) => ({
      externalComponent: item.externalComponent,
      direccion: item.direccion,
      montoCentavos: item.montoCentavos,
      descripcion: item.descripcion,
    })),
    [
      {
        externalComponent: "TRANSACTION",
        direccion: "ingreso",
        montoCentavos: 5_000_000,
        descripcion: "Mercado Pago",
      },
      {
        externalComponent: "TAX",
        direccion: "egreso",
        montoCentavos: 30_000,
        descripcion: "Impuestos Mercado Pago",
      },
    ],
  );
});

test("genera solo el ingreso cuando impuestos y comision son cero", () => {
  const components = buildMovementComponents(
    buildBaseRow({
      sourceId: "1748085839645",
      transactionAmountCentavos: 460_923,
      taxesAmountCentavos: 0,
      feeAmountCentavos: 0,
      realAmountCentavos: 460_923,
      reconciliationExpectedCentavos: 460_923,
    }),
  );

  assert.equal(components.length, 1);
  assert.equal(components[0]?.externalComponent, "TRANSACTION");
  assert.equal(components[0]?.direccion, "ingreso");
  assert.equal(components[0]?.montoCentavos, 460_923);
});

test("genera ingreso, impuesto y comision cuando los tres componentes impactan", () => {
  const components = buildMovementComponents(
    buildBaseRow({
      feeAmountCentavos: -50_000,
      reconciliationExpectedCentavos: 4_920_000,
      realAmountCentavos: 4_920_000,
    }),
  );

  assert.equal(components.length, 3);
  assert.deepEqual(
    components.map((item) => item.externalComponent),
    ["TRANSACTION", "TAX", "FEE"],
  );
  assert.deepEqual(
    components.map((item) => item.montoCentavos),
    [5_000_000, 30_000, 50_000],
  );
  assert.deepEqual(
    components.map((item) => item.direccion),
    ["ingreso", "egreso", "egreso"],
  );
});

test("no crea componentes sin impacto economico", () => {
  const components = buildMovementComponents(
    buildBaseRow({
      transactionAmountCentavos: 0,
      taxesAmountCentavos: 0,
      feeAmountCentavos: 0,
      realAmountCentavos: 0,
      reconciliationExpectedCentavos: 0,
    }),
  );

  assert.equal(components.length, 0);
});

test("usa REAL_AMOUNT como respaldo para egresos sin transaction, fee ni tax", () => {
  const components = buildMovementComponents(
    buildBaseRow({
      transactionAmountCentavos: 0,
      taxesAmountCentavos: 0,
      feeAmountCentavos: 0,
      realAmountCentavos: -10_060_000,
      reconciliationExpectedCentavos: 0,
      reconciliationDifferenceCentavos: 10_060_000,
    }),
  );

  assert.equal(components.length, 1);
  assert.equal(components[0]?.externalComponent, "TRANSACTION");
  assert.equal(components[0]?.direccion, "egreso");
  assert.equal(components[0]?.montoCentavos, 10_060_000);
});

test("la clave conceptual SOURCE_ID + COMPONENTE es estable entre reintentos", () => {
  const first = buildMovementComponents(
    buildBaseRow({
      feeAmountCentavos: -50_000,
      reconciliationExpectedCentavos: 4_920_000,
      realAmountCentavos: 4_920_000,
    }),
  );
  const second = buildMovementComponents(
    buildBaseRow({
      feeAmountCentavos: -50_000,
      reconciliationExpectedCentavos: 4_920_000,
      realAmountCentavos: 4_920_000,
    }),
  );

  const firstKeys = first.map((item) => `${item.sourceId}:${item.externalComponent}`);
  const secondKeys = second.map((item) => `${item.sourceId}:${item.externalComponent}`);

  assert.deepEqual(firstKeys, secondKeys);
  assert.deepEqual(firstKeys, [
    "173045260750:TRANSACTION",
    "173045260750:TAX",
    "173045260750:FEE",
  ]);
});

test("parsea CSV con ; y soporta columnas vacias", () => {
  const rows = parseMercadoPagoCsv(`SOURCE_ID;PAYMENT_METHOD_TYPE;TRANSACTION_TYPE;TRANSACTION_AMOUNT;TRANSACTION_DATE;FEE_AMOUNT;SETTLEMENT_DATE;REAL_AMOUNT;TAXES_AMOUNT;BUSINESS_UNIT;SUB_UNIT;MONEY_RELEASE_DATE
1748085839645;;SETTLEMENT;4609.23;2026-08-10T04:25:20.000-03:00;0.00;2026-08-10T04:25:20.000-03:00;4609.23;0.00;;;2026-08-10T04:25:20.000-03:00`);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.SOURCE_ID, "1748085839645");
  assert.equal(rows[0]?.PAYMENT_METHOD_TYPE, "");
  assert.equal(rows[0]?.TRANSACTION_AMOUNT, "4609.23");
});

test("CSV vacio no falla y devuelve cero filas", () => {
  assert.deepEqual(parseMercadoPagoCsv(""), []);
  assert.deepEqual(parseMercadoPagoCsv("\n"), []);
});

test("importes invalidos se rechazan explicitamente", () => {
  assert.throws(
    () => parseMercadoPagoAmountToCents("abc", "TRANSACTION_AMOUNT"),
    /TRANSACTION_AMOUNT/,
  );
});
