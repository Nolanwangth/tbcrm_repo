import type { ReactNode } from "react";
import { X } from "lucide-react";
interface ModalProps {
    title: string;
    children: ReactNode;
    onClose: () => void;
    footer?: ReactNode;
    wide?: boolean;
    className?: string;
}
export function Modal({ title, children, onClose, footer, wide, className = "" }: ModalProps) {
    return (<div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card ${wide ? "modal-wide" : ""} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="关闭弹窗"><X size={18}/></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>);
}
