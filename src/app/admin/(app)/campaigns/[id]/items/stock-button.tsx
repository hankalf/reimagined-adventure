"use client";

export function OutOfStockButton({ outOfStock, affected }: { outOfStock: boolean; affected: number }) {
  return (
    <button
      className={`btn-sm ${outOfStock ? "btn-secondary" : "btn-ghost text-amber-800"}`}
      onClick={(e) => {
        if (outOfStock) return;
        const msg =
          affected > 0
            ? `Mark this gift out of stock? ${affected} employee(s) who chose it (not yet ordered) will be asked to pick a different gift the next time they open the portal.`
            : "Mark this gift out of stock? Employees will no longer be able to choose it.";
        if (!window.confirm(msg)) e.preventDefault();
      }}
    >
      {outOfStock ? "Back in stock" : "Out of stock"}
    </button>
  );
}
