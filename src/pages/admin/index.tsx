shipments.map((s) => (
  <div key={s.id} className="shipRow">
    {/* Enlace al Embarque */}
    <Link href={`/admin/shipments/${s.id}`} legacyBehavior>
      <a className="cell pointer-area">
        <div className="main code">{s.code}</div>
        <div className="sub">{fmtDate(s.created_at)}</div>
      </a>
    </Link>

    {/* Enlace al Cliente (Corregido) */}
    <div className="cell">
      {/* Si s.client_id no existe, mandamos a la lista de usuarios con filtro de búsqueda */}
      <Link href={s.client_id ? `/admin/clients/${s.client_id}` : `/admin/users?q=${encodeURIComponent(s.client_name || '')}`} legacyBehavior>
        <a className="client-link-dashboard">
          <div className="main client">
            {s.client_name || "—"} 
            <ExternalLink size={10} style={{ marginLeft: 6, opacity: 0.4, display: 'inline' }} />
          </div>
        </a>
      </Link>
      <div className="sub">{productInline(s)}</div>
    </div>

    <div className="cell dest">
      <div className="main">{(s.destination || "").toUpperCase()}</div>
      <div className="sub">&nbsp;</div>
    </div>

    <div className="cell milestone">
      <MiniMilestone status={s.status} />
    </div>
  </div>
))