import type { AnizoneSearchItem } from "@streaming/types";
import { Focusable } from "../tv-navigation/Focusable";

type AnizoneResultCardProps = {
  item: AnizoneSearchItem;
  isInLibrary: boolean;
  onClick: () => void;
};

export function AnizoneResultCard({ item, isInLibrary, onClick }: AnizoneResultCardProps) {
  const meta = [item.type, item.startYear].filter(Boolean).join(" · ");

  return (
    <Focusable className="card" onClick={onClick}>
      {item.coverUrl ? (
        <img src={item.coverUrl} alt="" />
      ) : (
        <div style={{ width: "100%", height: 124, background: "#333" }} />
      )}
      <span className="card-title">{item.title}</span>
      {meta && <span className="card-subtitle">{meta}</span>}
      <span className="card-action">{isInLibrary ? "✓ In Library" : "View"}</span>
    </Focusable>
  );
}
