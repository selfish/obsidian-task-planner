import { setIcon } from "obsidian";
import * as React from "react";

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs: number;
  isUndone?: boolean;
}

export function UndoToast({ message, onUndo, onDismiss, durationMs, isUndone }: UndoToastProps) {
  const [visible, setVisible] = React.useState(true);
  const [exiting, setExiting] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const startDismissTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 200); // Match animation duration
    }, durationMs);
  }, [durationMs, onDismiss]);

  React.useEffect(() => {
    startDismissTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [startDismissTimer]);

  const handleUndo = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onUndo();
  }, [onUndo]);

  const handleMouseEnter = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseLeave = React.useCallback(() => {
    startDismissTimer();
  }, [startDismissTimer]);

  if (!visible) return null;

  return (
    <div
      className={`th-undo-toast ${exiting ? "th-undo-toast--exiting" : ""} ${isUndone ? "th-undo-toast--undone" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className="th-undo-toast-icon"
        ref={(node) => {
          if (node) {
            node.replaceChildren();
            setIcon(node, isUndone ? "check" : "move");
          }
        }}
      />
      <span className="th-undo-toast-message">{message}</span>
      {!isUndone && (
        <button className="th-undo-toast-button" onClick={handleUndo}>
          Undo
        </button>
      )}
    </div>
  );
}

export interface UndoToastContainerProps {
  toast: { message: string; id: string; isUndone?: boolean } | null;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs: number;
}

export function UndoToastContainer({ toast, onUndo, onDismiss, durationMs }: UndoToastContainerProps) {
  if (!toast) return null;

  return (
    <div className="th-undo-toast-container">
      <UndoToast key={toast.id} message={toast.message} onUndo={onUndo} onDismiss={onDismiss} durationMs={durationMs} isUndone={toast.isUndone} />
    </div>
  );
}
