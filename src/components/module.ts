import { BookOpenCheck, FileSearch, ShieldCheck, type LucideIcon } from "lucide-react";

/** Die drei Prüfmodule, wie sie im Dashboard erscheinen. */
export const MODULE: { href: string; name: string; icon: LucideIcon; text: string; schritte: string[]; norm: string }[] = [
  {
    href: "/einzelfall",
    name: "Einzelfallprüfung",
    icon: FileSearch,
    text: "Aussagebezogene Prüfungshandlungen aus dem Katalog wählen und eine Stichprobe ziehen.",
    schritte: ["Katalog", "Abstimmung", "Umfang", "Stichprobe", "Auswertung"],
    norm: "HWP OR Teil III.4.9, III.4.5",
  },
  {
    href: "/kontrolle",
    name: "Kontrollprüfung",
    icon: ShieldCheck,
    text: "IKS-Matrix in einen Prüfplan überführen oder eine Kontrolle mit den Vorgangsdaten prüfen.",
    schritte: ["IKS-Matrix", "Prüfplan", "Datenprüfung", "Stichprobe"],
    norm: "HWP OR Teil III.4.2",
  },
  {
    href: "/journal",
    name: "Journalprüfung",
    icon: BookOpenCheck,
    text: "Journalbuchungen nach Merkmalen erhöhten Risikos bewerten und risikobasiert auswählen.",
    schritte: ["Journal", "Schwellen", "Risikomerkmale", "Auswahl"],
    norm: "ISA-CH 240, HWP OR Rz. 374–377",
  },
];
