import mongoose from "mongoose";

import { createPayment, listPaymentCandidates, listPayments } from "@/services/pagos";

const adminId = "6a6fc50dd7dda1844092cd9c";
const odontologoId = "6a73b1aeb4cc795b03bfa8dd";
const obraSocialId = "6a6fc563dc19886695416493";
const codigoId = "6a6fc571dc19886695416494";
const pacienteId = "6a731e01ae6d9141633639cd";
const month = "2026-08";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, {
    dbName: process.env.MONGODB_DB_NAME!,
  });

  const db = mongoose.connection.db!;
  const attentionCollection = db.collection("attentions");
  const paymentCollection = db.collection("payments");
  const movementCollection = db.collection("movements");
  const baseDate = new Date("2026-08-06T12:00:00.000Z");

  const testAttentionIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];
  const testLineIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];

  await attentionCollection.insertMany([
    {
      _id: testAttentionIds[0],
      fecha: baseDate,
      pacienteId: new mongoose.Types.ObjectId(pacienteId),
      obraSocialId: new mongoose.Types.ObjectId(obraSocialId),
      usuarioCargaId: new mongoose.Types.ObjectId(odontologoId),
      observacionGeneral: "test pago codigo",
      codigos: [
        {
          _id: testLineIds[0],
          codigoObraSocialId: new mongoose.Types.ObjectId(codigoId),
          pieza: "11",
          coseguroCentavos: 0,
          coseguroOdontoCentavos: 0,
          observacion: null,
          pagoOdontologoCentavos: 100100,
          estado: "ok",
          codePaymentStatus: "pendiente",
          codePaymentId: null,
          codePaidAt: null,
          coseguroOdontoPaymentStatus: "pendiente",
          coseguroOdontoPaymentId: null,
          coseguroOdontoPaidAt: null,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    },
    {
      _id: testAttentionIds[1],
      fecha: baseDate,
      pacienteId: new mongoose.Types.ObjectId(pacienteId),
      obraSocialId: new mongoose.Types.ObjectId(obraSocialId),
      usuarioCargaId: new mongoose.Types.ObjectId(odontologoId),
      observacionGeneral: "test pago coseguro",
      codigos: [
        {
          _id: testLineIds[1],
          codigoObraSocialId: new mongoose.Types.ObjectId(codigoId),
          pieza: "12",
          coseguroCentavos: 0,
          coseguroOdontoCentavos: 20200,
          observacion: null,
          pagoOdontologoCentavos: 0,
          estado: "denegado",
          codePaymentStatus: "pendiente",
          codePaymentId: null,
          codePaidAt: null,
          coseguroOdontoPaymentStatus: "pendiente",
          coseguroOdontoPaymentId: null,
          coseguroOdontoPaidAt: null,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    },
    {
      _id: testAttentionIds[2],
      fecha: baseDate,
      pacienteId: new mongoose.Types.ObjectId(pacienteId),
      obraSocialId: new mongoose.Types.ObjectId(obraSocialId),
      usuarioCargaId: new mongoose.Types.ObjectId(odontologoId),
      observacionGeneral: "test pago ambos",
      codigos: [
        {
          _id: testLineIds[2],
          codigoObraSocialId: new mongoose.Types.ObjectId(codigoId),
          pieza: "13",
          coseguroCentavos: 0,
          coseguroOdontoCentavos: 30300,
          observacion: null,
          pagoOdontologoCentavos: 40400,
          estado: "ok",
          codePaymentStatus: "pendiente",
          codePaymentId: null,
          codePaidAt: null,
          coseguroOdontoPaymentStatus: "pendiente",
          coseguroOdontoPaymentId: null,
          coseguroOdontoPaidAt: null,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    },
    {
      _id: testAttentionIds[3],
      fecha: new Date("2026-07-28T12:00:00.000Z"),
      pacienteId: new mongoose.Types.ObjectId(pacienteId),
      obraSocialId: new mongoose.Types.ObjectId(obraSocialId),
      usuarioCargaId: new mongoose.Types.ObjectId(odontologoId),
      observacionGeneral: "test pago mes anterior",
      codigos: [
        {
          _id: testLineIds[3],
          codigoObraSocialId: new mongoose.Types.ObjectId(codigoId),
          pieza: "14",
          coseguroCentavos: 0,
          coseguroOdontoCentavos: 0,
          observacion: null,
          pagoOdontologoCentavos: 50500,
          estado: "ok",
          codePaymentStatus: "pendiente",
          codePaymentId: null,
          codePaidAt: null,
          coseguroOdontoPaymentStatus: "pendiente",
          coseguroOdontoPaymentId: null,
          coseguroOdontoPaidAt: null,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    },
  ]);

  const paymentIds: mongoose.Types.ObjectId[] = [];

  try {
    const candidates = await listPaymentCandidates({
      page: 1,
      limit: 100,
      userId: odontologoId,
      attentionMonth: month,
      attentionStatus: undefined,
      search: undefined,
    });

    console.log(
      "candidates",
      JSON.stringify(
        candidates.data.map((item) => ({
          lineId: item.lineId,
          canPayCode: item.canPayCode,
          canPayCoseguroOdonto: item.canPayCoseguroOdonto,
          estado: item.estado,
          pago: item.pagoOdontologoCentavos,
          coseg: item.coseguroOdontoCentavos,
        })),
        null,
        2,
      ),
    );

    const codeOnly = candidates.data.find(
      (item) => String(item.lineId) === String(testLineIds[0]),
    );
    const coseguroOnly = candidates.data.find(
      (item) => String(item.lineId) === String(testLineIds[1]),
    );
    const both = candidates.data.find(
      (item) => String(item.lineId) === String(testLineIds[2]),
    );

    const allCandidates = await listPaymentCandidates({
      page: 1,
      limit: 100,
      userId: odontologoId,
      attentionMonth: undefined,
      attentionStatus: undefined,
      search: undefined,
    });
    const previousMonthCode = allCandidates.data.find(
      (item) => String(item.lineId) === String(testLineIds[3]),
    );

    if (!codeOnly || !coseguroOnly || !both || !previousMonthCode) {
      throw new Error("No se encontraron las lineas de prueba");
    }

    const payment1 = await createPayment(
      {
        userId: odontologoId,
        attentionMonth: month,
        selectedItems: [
          {
            sourceType: "attention",
            lineId: codeOnly.lineId,
            payCode: true,
            payCoseguroOdonto: false,
          },
        ],
      },
      adminId,
    );
    paymentIds.push(new mongoose.Types.ObjectId(payment1.id));
    console.log("payment1", payment1.id);

    const payment2 = await createPayment(
      {
        userId: odontologoId,
        attentionMonth: month,
        selectedItems: [
          {
            sourceType: "attention",
            lineId: coseguroOnly.lineId,
            payCode: false,
            payCoseguroOdonto: true,
          },
        ],
        debitItems: [{ montoCentavos: 20200, observacion: "Retiro total" }],
      },
      adminId,
    );
    paymentIds.push(new mongoose.Types.ObjectId(payment2.id));
    console.log("payment2", payment2.id);

    if (payment2.totalNetoPagarCentavos !== 0) {
      throw new Error("El pago con debito total deberia dejar un neto de cero");
    }

    const zeroMovement = await movementCollection.findOne({
      origenTipo: "payment",
      origenId: new mongoose.Types.ObjectId(payment2.id),
    });

    if (zeroMovement?.montoCentavos !== 0) {
      throw new Error("El movimiento de un pago neto cero deberia conservar el importe cero");
    }

    const payment3 = await createPayment(
      {
        userId: odontologoId,
        attentionMonth: month,
        selectedItems: [
          {
            sourceType: "attention",
            lineId: both.lineId,
            payCode: true,
            payCoseguroOdonto: true,
          },
          {
            sourceType: "attention",
            lineId: previousMonthCode.lineId,
            payCode: true,
            payCoseguroOdonto: false,
          },
        ],
        debitItems: [
          { montoCentavos: 10000, observacion: "Retiro de dinero" },
          { montoCentavos: 5000, observacion: "Anticipo" },
        ],
      },
      adminId,
    );
    paymentIds.push(new mongoose.Types.ObjectId(payment3.id));
    console.log("payment3", payment3.id);

    if (
      payment3.totalDebitosCentavos !== 15000 ||
      payment3.totalNetoPagarCentavos !== 106200 ||
      payment3.debitItems.length !== 2 ||
      payment3.attentionMonths.join(",") !== "2026-08,2026-07"
    ) {
      throw new Error("El pago con debitos no persistio los totales esperados");
    }

    const movement = await movementCollection.findOne({
      origenTipo: "payment",
      origenId: new mongoose.Types.ObjectId(payment3.id),
    });

    if (movement?.montoCentavos !== 106200) {
      throw new Error("El movimiento no uso el total neto del pago");
    }

    const julyHistory = await listPayments({
      page: 1,
      limit: 10,
      userId: odontologoId,
      attentionMonth: "2026-07",
    });

    if (!julyHistory.data.some((payment) => payment.id === payment3.id)) {
      throw new Error("El historial no encontro el pago multimes al filtrar julio");
    }

    await createPayment(
      {
        userId: odontologoId,
        attentionMonth: month,
        selectedItems: [
          {
            sourceType: "attention",
            lineId: codeOnly.lineId,
            payCode: true,
            payCoseguroOdonto: false,
          },
        ],
        debitItems: [{ montoCentavos: 100101, observacion: "Debito excedido" }],
      },
      adminId,
    ).then(
      () => {
        throw new Error("Se permitio un debito mayor al total bruto");
      },
      (error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes("no pueden superar")) {
          throw error;
        }
      },
    );

    const persistedAttentions = await attentionCollection
      .find({ _id: { $in: testAttentionIds } })
      .toArray();

    console.log(
      "persisted",
      JSON.stringify(
        persistedAttentions.map((attention) => attention.codigos[0]),
        null,
        2,
      ),
    );
  } finally {
    if (paymentIds.length > 0) {
      await movementCollection.deleteMany({ origenId: { $in: paymentIds } });
      await paymentCollection.deleteMany({ _id: { $in: paymentIds } });
    }

    await attentionCollection.deleteMany({ _id: { $in: testAttentionIds } });
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
