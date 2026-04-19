"use client";

export default function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="shared-modal-overlay" onClick={onClose}>
      <div className="shared-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shared-modal__header">
          <h2 className="shared-modal__title">{title}</h2>
          <button onClick={onClose} className="shared-modal__close">
            ✕
          </button>
        </div>

        <div className="shared-modal__body">{children}</div>
      </div>
    </div>
  );
}