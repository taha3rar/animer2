import { Focusable } from "../tv-navigation/Focusable";

type ContentCardProps = {
  title: string;
  imageUrl?: string | null;
  progressRatio?: number;
  onClick: () => void;
};

export function ContentCard({ title, imageUrl, progressRatio, onClick }: ContentCardProps) {
  return (
    <Focusable className="card" onClick={onClick}>
      {imageUrl ? (
        <img src={imageUrl} alt="" />
      ) : (
        <div style={{ width: "100%", height: 124, background: "#333" }} />
      )}
      {typeof progressRatio === "number" && (
        <div className="card-progress">
          <div
            className="card-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progressRatio * 100))}%` }}
          />
        </div>
      )}
      <span className="card-title">{title}</span>
    </Focusable>
  );
}
