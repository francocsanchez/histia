"use client";

import {
  Document,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { RenditionDto } from "@/types/domain";

const palette = {
  ink: "#17343A",
  teal: "#247A70",
  mint: "#B6E3D5",
  mist: "#EDF6F4",
  rule: "#D5E4E1",
  muted: "#61777B",
  credit: "#187047",
  debit: "#B42318",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: { paddingTop: 98, paddingBottom: 38, paddingHorizontal: 34, color: palette.ink, fontFamily: "Helvetica", fontSize: 8 },
  header: { position: "absolute", top: 34, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderColor: palette.teal, paddingBottom: 9 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 21, letterSpacing: -0.6, color: palette.teal },
  reportName: { fontFamily: "Helvetica-Bold", fontSize: 10, marginTop: 2 },
  meta: { textAlign: "right", color: palette.muted, fontSize: 7, lineHeight: 1.5 },
  eyebrow: { fontSize: 6.5, letterSpacing: 1.25, color: palette.muted, textTransform: "uppercase" },
  lead: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  professional: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  periods: { color: palette.muted, fontSize: 7.5, marginTop: 3 },
  net: { color: palette.teal, fontSize: 16, fontFamily: "Courier-Bold", textAlign: "right" },
  kpis: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: palette.rule },
  kpi: { width: "25%", padding: 7, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: palette.rule, minHeight: 45 },
  kpiLabel: { color: palette.muted, fontSize: 6.2, letterSpacing: 0.7, textTransform: "uppercase" },
  kpiValue: { marginTop: 5, fontSize: 10, fontFamily: "Courier-Bold" },
  section: { marginTop: 17 },
  sectionTitle: { borderBottomWidth: 0.75, borderColor: palette.rule, paddingBottom: 4, marginBottom: 8, color: palette.muted, fontSize: 6.5, letterSpacing: 1.2, textTransform: "uppercase" },
  charts: { flexDirection: "row", gap: 14 },
  chartBox: { flex: 1, borderWidth: 0.5, borderColor: palette.rule, padding: 9, minHeight: 126 },
  chartTitle: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 6 },
  chartSub: { color: palette.muted, fontSize: 6.5, marginBottom: 7 },
  legendRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  swatch: { width: 6, height: 6, marginRight: 4 },
  legendName: { flex: 1, fontSize: 6.5 },
  legendValue: { fontFamily: "Courier-Bold", fontSize: 6.5 },
  table: { borderWidth: 0.5, borderColor: palette.rule },
  tableHead: { flexDirection: "row", backgroundColor: palette.mist, borderBottomWidth: 0.5, borderColor: palette.rule },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: palette.rule, minHeight: 18, alignItems: "center" },
  tableLastRow: { borderBottomWidth: 0 },
  cellHead: { paddingHorizontal: 4, paddingVertical: 4, fontSize: 5.8, color: palette.muted, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cell: { paddingHorizontal: 4, paddingVertical: 3, fontSize: 6.5 },
  cellMoney: { fontFamily: "Courier-Bold", textAlign: "right" },
  reconciliation: { marginTop: 17, marginLeft: "50%", borderTopWidth: 1, borderColor: palette.teal },
  reconRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderColor: palette.rule },
  reconTotal: { paddingTop: 6, fontFamily: "Helvetica-Bold", fontSize: 10, color: palette.teal },
  footer: { position: "absolute", left: 34, right: 34, bottom: 15, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderColor: palette.rule, paddingTop: 5, color: palette.muted, fontSize: 6 },
  empty: { color: palette.muted, fontSize: 7.5, paddingVertical: 8 },
});

function currency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value / 100);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function arcPath(start: number, end: number) {
  const point = (angle: number) => [43 + 29 * Math.cos(angle), 43 + 29 * Math.sin(angle)];
  const [x1, y1] = point(start);
  const [x2, y2] = point(end - 0.025);
  return `M${x1} ${y1}A29 29 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
}

function Donut({ rendition }: { rendition: RenditionDto }) {
  const colors = [palette.teal, "#57A998", "#8ECCC0", "#B8DCD5", "#496E71"];
  const slices = rendition.obrasSociales.slice(0, 5).reduce<{
    angle: number;
    values: Array<{ nombre: string; pacientes: number; porcentaje: number; color: string; start: number; end: number }>;
  }>((accumulator, item, index) => {
    const start = accumulator.angle;
    const end = start + (item.porcentaje / 100) * Math.PI * 2;
    return {
      angle: end,
      values: [...accumulator.values, { ...item, color: colors[index], start, end }],
    };
  }, { angle: -Math.PI / 2, values: [] }).values;

  if (slices.length === 0) return <Text style={styles.empty}>No hay atenciones incluidas en esta liquidación.</Text>;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Svg width={76} height={76} viewBox="0 0 86 86">
        {slices.map((slice) => <Path key={slice.nombre} d={arcPath(slice.start, slice.end)} stroke={slice.color} strokeWidth={14} fill="none" />)}
        <Text x={43} y={40} style={{ fontSize: 9, textAnchor: "middle", fill: palette.ink }}>{rendition.pacientesUnicos}</Text>
        <Text x={43} y={49} style={{ fontSize: 4.5, textAnchor: "middle", fill: palette.muted }}>PACIENTES</Text>
      </Svg>
      <View style={{ flex: 1, marginLeft: 9 }}>
        {slices.map((slice) => (
          <View key={slice.nombre} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: slice.color }]} />
            <Text style={styles.legendName}>{slice.nombre}</Text>
            <Text style={styles.legendValue}>{slice.porcentaje}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DailyBars({ rendition }: { rendition: RenditionDto }) {
  const items = rendition.atencionesPorDia;
  const max = Math.max(...items.map((item) => item.total), 1);
  if (items.length === 0) return <Text style={styles.empty}>No hay atenciones incluidas en esta liquidación.</Text>;
  return (
    <View>
      <Svg width="100%" height={76} viewBox={`0 0 ${Math.max(items.length * 23, 120)} 76`}>
        {items.map((item, index) => {
          const height = Math.max((item.total / max) * 51, 5);
          return <Rect key={item.date} x={index * 23 + 6} y={61 - height} width={13} height={height} fill={palette.teal} />;
        })}
        <Path d={`M2 61H${Math.max(items.length * 23 + 2, 120)}`} stroke={palette.rule} strokeWidth={0.7} />
      </Svg>
      <View style={{ flexDirection: "row" }}>
        {items.map((item) => <Text key={item.date} style={{ width: `${100 / items.length}%`, textAlign: "center", fontSize: 5.4, color: palette.muted }}>{item.date.slice(8)}</Text>)}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function AttentionTable({ title, rows, coseguro = false }: { title: string; rows: RenditionDto["codigosPagados"]; coseguro?: boolean }) {
  return (
    <Section title={title}>
      {rows.length === 0 ? <Text style={styles.empty}>No se incluyeron conceptos de este tipo.</Text> : (
        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.cellHead, { width: "13%" }]}>Fecha</Text><Text style={[styles.cellHead, { width: "22%" }]}>Paciente</Text><Text style={[styles.cellHead, { width: "18%" }]}>Obra social</Text><Text style={[styles.cellHead, { width: "30%" }]}>Código</Text><Text style={[styles.cellHead, { width: "17%", textAlign: "right" }]}>Importe</Text>
          </View>
          {rows.map((line, index) => <View key={`${line.attentionId}-${line.codigoObraSocialId}-${index}`} style={[styles.tableRow, index === rows.length - 1 ? styles.tableLastRow : {}]} wrap={false}>
            <Text style={[styles.cell, { width: "13%" }]}>{dateLabel(line.attentionFecha)}</Text><Text style={[styles.cell, { width: "22%" }]}>{line.pacienteNombre}</Text><Text style={[styles.cell, { width: "18%" }]}>{line.obraSocialNombre}</Text><Text style={[styles.cell, { width: "30%" }]}>{line.codigo} {line.codigoNombre}{line.pieza ? ` · Pieza ${line.pieza}` : ""}</Text><Text style={[styles.cell, styles.cellMoney, { width: "17%" }]}>{currency(coseguro ? line.coseguroOdontoCentavos ?? 0 : line.pagoOdontologoCentavos)}</Text>
          </View>)}
        </View>
      )}
    </Section>
  );
}

function AdjustmentsTable({ title, items, sign }: { title: string; items: { montoCentavos: number; observacion: string }[]; sign: "+" | "-" }) {
  if (items.length === 0) return null;
  return <Section title={title}><View style={styles.table}><View style={styles.tableHead} fixed><Text style={[styles.cellHead, { width: "75%" }]}>Observación</Text><Text style={[styles.cellHead, { width: "25%", textAlign: "right" }]}>Importe</Text></View>{items.map((item, index) => <View key={`${item.observacion}-${index}`} style={[styles.tableRow, index === items.length - 1 ? styles.tableLastRow : {}]} wrap={false}><Text style={[styles.cell, { width: "75%" }]}>{item.observacion}</Text><Text style={[styles.cell, styles.cellMoney, { width: "25%", color: sign === "+" ? palette.credit : palette.debit }]}>{sign} {currency(item.montoCentavos)}</Text></View>)}</View></Section>;
}

export function RendicionPdf({ rendition }: { rendition: RenditionDto }) {
  const { payment } = rendition;
  const filename = `Rendicion ${payment.usuarioNombreSnapshot}`;
  return (
    <Document title={filename} author="Histia" subject="Detalle de liquidación profesional">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed><View><Text style={styles.brand}>Histia</Text><Text style={styles.reportName}>RENDICIÓN PROFESIONAL</Text></View><View style={styles.meta}><Text>Liquidación #{payment.id.slice(-8).toUpperCase()}</Text><Text>Emitida el {dateLabel(payment.paidAt)}</Text></View></View>
        <View style={styles.lead}><View><Text style={styles.eyebrow}>Profesional</Text><Text style={styles.professional}>{payment.usuarioNombreSnapshot}</Text><Text style={styles.periods}>Períodos de atención: {payment.attentionMonths.join(", ")}</Text></View><View><Text style={styles.eyebrow}>Neto pagado</Text><Text style={styles.net}>{currency(payment.totalNetoPagarCentavos)}</Text></View></View>
        <View style={styles.kpis}>
          <Kpi label="Pacientes" value={String(rendition.pacientesUnicos)} /><Kpi label="Atenciones" value={String(rendition.atencionesUnicas)} /><Kpi label="Códigos OK" value={currency(payment.totalPagoCodigosCentavos)} /><Kpi label="Coseguros" value={currency(payment.totalCoseguroOdontoCentavos)} /><Kpi label="Ortodoncia" value={currency(payment.totalOrtodonciaCentavos)} /><Kpi label="Placas" value={currency(payment.totalPlacasBruxismoCentavos ?? 0)} /><Kpi label="Créditos" value={`+ ${currency(payment.totalCreditosCentavos)}`} /><Kpi label="Débitos" value={`- ${currency(payment.totalDebitosCentavos)}`} /><Kpi label="Conceptos" value={String(payment.quantityConceptsPaid)} />
        </View>
        <Section title="Actividad incluida"><View style={styles.charts}><View style={styles.chartBox}><Text style={styles.chartTitle}>Pacientes por obra social</Text><Text style={styles.chartSub}>Participación sobre pacientes únicos</Text><Donut rendition={rendition} /></View><View style={styles.chartBox}><Text style={styles.chartTitle}>Atenciones por día</Text><Text style={styles.chartSub}>Fecha de prestación</Text><DailyBars rendition={rendition} /></View></View></Section>
        <AttentionTable title="Códigos pagados - estado OK" rows={rendition.codigosPagados} />
        <AttentionTable title="Coseguros pagados" rows={rendition.cosegurosPagados} coseguro />
        {rendition.ortodonciaPagada.length > 0 ? <Section title="Pagos de ortodoncia"><View style={styles.table}><View style={styles.tableHead} fixed><Text style={[styles.cellHead, { width: "20%" }]}>Fecha</Text><Text style={[styles.cellHead, { width: "38%" }]}>Paciente</Text><Text style={[styles.cellHead, { width: "22%" }]}>Tratamiento</Text><Text style={[styles.cellHead, { width: "20%", textAlign: "right" }]}>Importe</Text></View>{rendition.ortodonciaPagada.map((line, index) => <View key={line.orthodonticPaymentId} style={[styles.tableRow, index === rendition.ortodonciaPagada.length - 1 ? styles.tableLastRow : {}]} wrap={false}><Text style={[styles.cell, { width: "20%" }]}>{dateLabel(line.paymentDate)}</Text><Text style={[styles.cell, { width: "38%" }]}>{line.patientName}</Text><Text style={[styles.cell, { width: "22%" }]}>{line.treatmentType}</Text><Text style={[styles.cell, styles.cellMoney, { width: "20%" }]}>{currency(line.orthodontistAmountCentavos)}</Text></View>)}</View></Section> : null}
        {(rendition.placasBruxismoPagadas ?? []).length > 0 ? <Section title="Placas de bruxismo"><View style={styles.table}><View style={styles.tableHead} fixed><Text style={[styles.cellHead, { width: "25%" }]}>Fecha</Text><Text style={[styles.cellHead, { width: "45%" }]}>Paciente</Text><Text style={[styles.cellHead, { width: "30%", textAlign: "right" }]}>Honorario</Text></View>{(rendition.placasBruxismoPagadas ?? []).map((line, index) => <View key={line.bruxismPlateId} style={[styles.tableRow, index === (rendition.placasBruxismoPagadas ?? []).length - 1 ? styles.tableLastRow : {}]} wrap={false}><Text style={[styles.cell, { width: "25%" }]}>{dateLabel(line.plateDate)}</Text><Text style={[styles.cell, { width: "45%" }]}>{line.patientName}</Text><Text style={[styles.cell, styles.cellMoney, { width: "30%" }]}>{currency(line.dentistAmountCentavos)}</Text></View>)}</View></Section> : null}
        <AdjustmentsTable title="Créditos aplicados" items={payment.creditItems} sign="+" />
        <AdjustmentsTable title="Débitos aplicados" items={payment.debitItems} sign="-" />
        <View style={styles.reconciliation} wrap={false}><ReconRow label="Total códigos" value={currency(payment.totalPagoCodigosCentavos)} /><ReconRow label="Total coseguros" value={currency(payment.totalCoseguroOdontoCentavos)} /><ReconRow label="Total ortodoncia" value={currency(payment.totalOrtodonciaCentavos)} /><ReconRow label="Total placas" value={currency(payment.totalPlacasBruxismoCentavos ?? 0)} /><ReconRow label="Créditos" value={`+ ${currency(payment.totalCreditosCentavos)}`} /><ReconRow label="Débitos" value={`- ${currency(payment.totalDebitosCentavos)}`} /><View style={[styles.reconRow, styles.reconTotal]}><Text>Neto pagado</Text><Text>{currency(payment.totalNetoPagarCentavos)}</Text></View></View>
        <View style={styles.footer} fixed render={({ pageNumber }) => <><Text>Histia - Rendición de pago</Text><Text>Página {pageNumber}</Text></>} />
      </Page>
    </Document>
  );
}

function Kpi({ label, value }: { label: string; value: string }) { return <View style={styles.kpi}><Text style={styles.kpiLabel}>{label}</Text><Text style={styles.kpiValue}>{value}</Text></View>; }
function ReconRow({ label, value }: { label: string; value: string }) { return <View style={styles.reconRow}><Text>{label}</Text><Text style={{ fontFamily: "Courier-Bold" }}>{value}</Text></View>; }
