// src/components/CompactRow.tsx
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ExternalLink } from "lucide-react";

type Props = {
  href: string;

  // izquierda
  title: React.ReactNode;
  subtitle?: React.ReactNode;

  // derecha
  status?: React.ReactNode; // pill, badge, etc.
  actionLabel?: string;     // default: "Abrir"
  actionIcon?: React.ReactNode; // default: <ExternalLink />
  actionHref?: string;      // si quieres que el botón vaya a otra ruta (por defecto href)

  // opcional
  onOpen?: () => void;      // si quieres interceptar click
};

export function CompactRow({
  href,
  title,
  subtitle,
  status,
  actionLabel = "Abrir",
  actionIcon,
  actionHref,
  onOpen,
}: Props) {
  const router = useRouter();
  const finalActionHref = actionHref || href;

  function open() {
    if (onOpen) return onOpen();
    router.push(href);
  }

  return (
    <div className="cr-rowItem">
      {/* Zona clickable (no Link para evitar links anidados) */}
      <div
        className="cr-rowMain"
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") open();
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="cr-rowTitle">{title}</div>
          {subtitle ? <div className="cr-rowSub">{subtitle}</div> : null}
        </div>
      </div>

      {/* status */}
      {status ? <div className="cr-rowStatus">{status}</div> : <div />}

      {/* acción */}
      <div className="cr-rowActions">
        <Link className="cr-actionBtn" href={finalActionHref} title={actionLabel}>
          {actionIcon ?? <ExternalLink size={16} />}
          {actionLabel}
        </Link>
      </div>

      <style jsx>{`
        .cr-rowItem {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: center;
          padding: 10px 10px;
          border: 1px solid var(--ff-border);
          background: var(--ff-surface);
          border-radius: var(--ff-radius);
        }

        .cr-rowMain {
          min-width: 0;
          cursor: pointer;
          border-radius: calc(var(--ff-radius) - 2px);
          padding: 2px 4px;
        }
        .cr-rowMain:hover {
          background: rgba(15, 23, 42, 0.02);
        }
        .cr-rowMain:focus {
          outline: none;
          box-shadow: 0 0 0 4px rgba(31, 122, 58, 0.12);
        }

        .cr-rowTitle {
          font-weight: 900;
          font-size: 13px;
          line-height: 18px;
          display: flex;
          gap: 8px;
          min-width: 0;
          align-items: baseline;
          flex-wrap: wrap;
        }

        .cr-rowSub {
          margin-top: 2px;
          color: var(--ff-muted);
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cr-rowStatus {
          display: flex;
          justify-content: flex-end;
        }

        .cr-rowActions {
          display: flex;
          justify-content: flex-end;
        }

        .cr-actionBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 34px;
          padding: 0 10px;
          border-radius: var(--ff-radius);
          border: 1px solid var(--ff-border);
          background: #fff;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          color: var(--ff-text);
          text-decoration: none;
          white-space: nowrap;
        }
        .cr-actionBtn:hover {
          background: rgba(15, 23, 42, 0.03);
        }

        @media (max-width: 680px) {
          .cr-rowItem {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .cr-rowStatus,
          .cr-rowActions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}