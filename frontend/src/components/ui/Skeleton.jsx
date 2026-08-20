import PropTypes from 'prop-types';

function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

SkeletonLine.propTypes = {
  className: PropTypes.string,
};

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="card space-y-3 p-4">
      <SkeletonLine className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

SkeletonCard.propTypes = {
  rows: PropTypes.number,
};

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      {/* header */}
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="h-3 w-3/4" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

SkeletonTable.propTypes = {
  rows: PropTypes.number,
  cols: PropTypes.number,
};

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

SkeletonText.propTypes = {
  lines: PropTypes.number,
};

export default SkeletonLine;
