import mongoose from "mongoose";

import { createPayment, listPaymentCandidates } from "@/services/pagos";

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
  const baseDate = new Date("2026-08-06T12:00:00.000Z");

  const testAttentionIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];
  const testLineIds = [
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

    if (!codeOnly || !coseguroOnly || !both) {
      throw new Error("No se encontraron las lineas de prueba");
    }

    const payment1 = await createPayment(
      {
        userId: odontologoId,
        attentionMonth: month,
        selectedItems: [
          {
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
            lineId: coseguroOnly.lineId,
            payCode: false,
            payCoseguroOdonto: true,
          },
        ],
      },
      adminId,
    );
    paymentIds.push(new mongoose.Types.ObjectId(payment2.id));
    console.log("payment2", payment2.id);

    const payment3 = await createPayment(
      {
        userId: odontologoId,
        attentionMonth: month,
        selectedItems: [
          {
            lineId: both.lineId,
            payCode: true,
            payCoseguroOdonto: true,
          },
        ],
      },
      adminId,
    );
    paymentIds.push(new mongoose.Types.ObjectId(payment3.id));
    console.log("payment3", payment3.id);

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
