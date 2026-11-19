"use client";

/** Save button for a gift row that warns when the admin unticked an option value employees may have chosen. */
export function OptionsSaveButton({ chosenCounts }: { chosenCounts: Record<string, number> }) {
  return (
    <button
      className="btn-ghost btn-sm"
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        let affected = 0;
        const removed: string[] = [];
        form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-initial="1"]').forEach((box) => {
          if (!box.checked) {
            removed.push(box.value);
            affected += chosenCounts[`${box.name}:${box.value}`] ?? 0;
          }
        });
        if (removed.length > 0 && affected > 0) {
          if (!window.confirm(`${affected} employee(s) chose ${removed.join(", ")} and have not been ordered yet. They will be asked to pick again. Continue?`)) e.preventDefault();
        }
      }}
    >
      Save
    </button>
  );
}
