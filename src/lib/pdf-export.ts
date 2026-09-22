import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AdherenceRangeResult } from "./adherence-range.functions";

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusLabel(s: string | null) {
  if (s === "on_time") return "Tepat waktu";
  if (s === "late") return "Telat";
  if (s === "missed") return "Lewat";
  return "-";
}

export function exportAdherencePdf(result: AdherenceRangeResult) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Laporan Kepatuhan Minum Obat", 40, 50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text("SehatPantau", 40, 66);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, pageWidth - 40, 66, {
    align: "right",
  });
  doc.setTextColor(0);

  // Patient
  const p = result.patient;
  const lines: string[] = [];
  lines.push(`Nama Pasien : ${p?.full_name || "-"}`);
  if (p?.gender) lines.push(`Jenis Kelamin: ${p.gender === "male" ? "Laki-laki" : "Perempuan"}`);
  if (p?.age != null) lines.push(`Usia         : ${p.age} tahun`);
  lines.push(`Periode      : ${fmtDate(result.from)} — ${fmtDate(result.to)}`);

  doc.setFontSize(10);
  lines.forEach((l, i) => doc.text(l, 40, 92 + i * 14));
  const yAfter = 92 + lines.length * 14 + 6;

  // Summary box
  const s = result.summary;
  doc.setDrawColor(220);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(40, yAfter, pageWidth - 80, 56, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Tingkat kepatuhan: ${s.pct}%`, 52, yAfter + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Total dosis: ${s.total}    Tepat waktu: ${s.on_time}    Telat: ${s.late}    Lewat: ${s.missed}`,
    52,
    yAfter + 42,
  );

  const tableY = yAfter + 70;

  autoTable(doc, {
    startY: tableY,
    head: [["Tanggal", "Jam", "Obat", "Dosis", "Penyakit", "Status"]],
    body: result.rows.map((r) => [
      r.scheduled_date,
      (r.scheduled_time ?? "").slice(0, 5) || "-",
      r.medications?.name ?? "-",
      r.medications?.dosage ?? "-",
      r.medications?.disease_type ?? "-",
      statusLabel(r.status),
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  // Footer signature
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`Halaman ${i} / ${pageCount}`, pageWidth - 40, ph - 24, { align: "right" });
    doc.text(
      "Dokumen ini dibuat otomatis dari SehatPantau untuk konsultasi dengan tenaga medis.",
      40,
      ph - 24,
    );
    doc.setTextColor(0);
  }

  const fname = `kepatuhan_${result.from}_${result.to}.pdf`;
  doc.save(fname);
}
