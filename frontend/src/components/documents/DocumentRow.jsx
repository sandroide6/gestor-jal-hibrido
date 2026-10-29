import PropTypes from 'prop-types';
import Radicado from '../ui/Radicado';
import Spinner from '../ui/Spinner';
import { DocumentStatus } from '../ui/StatusBadge';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Fecha como en un libro de registro: día grande, mes debajo.
export function LedgerDate({ iso }) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return <span className="w-12 text-ink-muted">—</span>;
  return (
    <time dateTime={iso} className="flex w-12 shrink-0 flex-col items-center leading-none" title={d.toLocaleDateString('es-CO', { dateStyle: 'long' })}>
      <span className="font-serif text-2xl font-semibold text-brand">{d.getDate()}</span>
      <span className="mt-1 text-eyebrow uppercase text-ink-muted">{MONTHS[d.getMonth()]}</span>
      <span className="sr-only">{d.getFullYear()}</span>
    </time>
  );
}
LedgerDate.propTypes = { iso: PropTypes.string };

/**
 * Fila del registro de documentos: fecha, tipo y persona, radicado, estado y descargas.
 * En pantallas angostas los bloques se apilan; las descargas siguen a la vista.
 */
export default function DocumentRow({ doc, downloading, onDownload, showStatus = false, children }) {
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line py-4">
      <LedgerDate iso={doc.created_at} />
      <div className="min-w-[12rem] flex-1">
        <p className="title-card">{doc.doc_type_name}</p>
        <p className="text-ink-muted">
          {doc.beneficiary_name}{doc.beneficiary_id ? ` · C.C. ${doc.beneficiary_id}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Radicado value={doc.numero_radicado} />
        {showStatus && <DocumentStatus syncStatus={doc.sync_status} reviewed={doc.reviewed} />}
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        {['pdf', 'docx'].map((fmt) => {
          const busy = downloading === `${doc.id}-${fmt}`;
          return (
            <button
              key={fmt}
              type="button"
              className="btn-secondary btn-sm flex-1 sm:flex-none"
              disabled={!!downloading}
              aria-busy={busy || undefined}
              onClick={() => onDownload(doc, fmt)}
              aria-label={`Descargar ${fmt === 'pdf' ? 'PDF' : 'Word'} de ${doc.doc_type_name}, ${doc.beneficiary_name}`}
            >
              {busy && <Spinner />}
              {busy ? 'Descargando…' : fmt === 'pdf' ? 'PDF' : 'Word'}
            </button>
          );
        })}
        {children}
      </div>
    </li>
  );
}

DocumentRow.propTypes = {
  doc: PropTypes.shape({
    id: PropTypes.string.isRequired,
    doc_type_name: PropTypes.string,
    beneficiary_name: PropTypes.string,
    beneficiary_id: PropTypes.string,
    numero_radicado: PropTypes.string,
    created_at: PropTypes.string,
    sync_status: PropTypes.string,
    reviewed: PropTypes.bool,
  }).isRequired,
  downloading: PropTypes.string,
  onDownload: PropTypes.func.isRequired,
  showStatus: PropTypes.bool,
  children: PropTypes.node,
};
