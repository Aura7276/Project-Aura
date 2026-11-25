import "./visual-slot.css";
import { Aperture, Scan, Camera } from "lucide-react";
export function VisualSlot({
  asset,
  label,
  caption = "Studio portrait",
}: {
  asset: string;
  label: string;
  caption?: string;
}) {
  return (
    <figure className="visual-slot" data-asset={asset} aria-label={label}>
      <div className="viewfinder" aria-hidden="true">
        <Scan />
        <Aperture />
      </div>
      <figcaption>
        <Camera size={16} /> {caption} · Image placeholder
      </figcaption>
    </figure>
  );
}
