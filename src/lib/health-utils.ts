export type StatusLevel = "normal" | "waspada" | "bahaya";

export interface StatusInfo {
  level: StatusLevel;
  label: string;
  colorClass: string;
  bgClass: string;
}

const map: Record<StatusLevel, StatusInfo> = {
  normal: {
    level: "normal",
    label: "Normal",
    colorClass: "text-success-foreground",
    bgClass: "bg-success",
  },
  waspada: {
    level: "waspada",
    label: "Waspada",
    colorClass: "text-warning-foreground",
    bgClass: "bg-warning",
  },
  bahaya: {
    level: "bahaya",
    label: "Bahaya",
    colorClass: "text-danger-foreground",
    bgClass: "bg-danger",
  },
};

export function hipertensiStatus(sistolik?: number | null, diastolik?: number | null): StatusInfo {
  if (sistolik == null || diastolik == null) return map.normal;
  if (sistolik >= 140 || diastolik >= 90) return map.bahaya;
  if (sistolik >= 130 || diastolik >= 80) return map.waspada;
  return map.normal;
}

export function gulaDarahStatus(puasa?: number | null, pp?: number | null): StatusInfo {
  const p = puasa ?? 0;
  const q = pp ?? 0;
  if (p >= 126 || q >= 200) return map.bahaya;
  if (p >= 100 || q >= 140) return map.waspada;
  return map.normal;
}

export function asamUratStatus(
  value?: number | null,
  gender?: "male" | "female" | null,
): StatusInfo {
  if (value == null) return map.normal;
  const isMale = gender === "male";
  const danger = isMale ? 8.0 : 7.0;
  const warn = isMale ? 7.0 : 6.0;
  if (value > danger) return map.bahaya;
  if (value >= warn) return map.waspada;
  return map.normal;
}

export function adherenceCategory(percent: number): StatusInfo {
  if (percent >= 90) return { ...map.normal, label: "Sangat Baik" };
  if (percent >= 70) return { ...map.waspada, label: "Cukup" };
  return { ...map.bahaya, label: "Kurang" };
}

export const DISCLAIMER =
  "Aplikasi ini hanya alat bantu pencatatan dan pengingat, bukan alat diagnosis medis. Selalu konsultasikan hasil kepada dokter. Untuk gawat darurat hubungi 118/119.";
