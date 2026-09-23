import type { Metadata } from "next";
import { StudioApp } from "@/components/studio/StudioApp";

export const metadata: Metadata = {
  title: "Estudio · Hypsometra",
};

export default function StudioPage() {
  return <StudioApp />;
}
