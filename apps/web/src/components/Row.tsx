import type { ReactNode } from "react";

export function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="row">
      <h2>{title}</h2>
      <div className="row-track">{children}</div>
    </div>
  );
}
