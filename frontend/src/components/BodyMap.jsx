const points = [
  { id: 'shoulders', label: 'Shoulders', x: 50, y: 22 },
  { id: 'chest', label: 'Chest', x: 50, y: 34 },
  { id: 'biceps', label: 'Biceps', x: 24, y: 41 },
  { id: 'waist', label: 'Waist', x: 50, y: 50 },
  { id: 'hips', label: 'Hips', x: 50, y: 60 },
  { id: 'thigh', label: 'Thigh', x: 39, y: 76 },
  { id: 'calf', label: 'Calf', x: 61, y: 91 },
];

export default function BodyMap({ selected, onSelect, notesByPart = {} }) {
  return (
    <div className="body-map">
      <svg viewBox="0 0 140 220" role="img" aria-label="Body measurement picker" className="body-figure">
        <defs>
          <linearGradient id="bodyFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.24" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="22" r="17" />
        <path d="M50 48 C58 42 82 42 90 48 L98 78 C103 94 102 118 93 136 L88 154 L84 208 H62 L58 154 L47 136 C38 118 37 94 42 78 Z" />
        <path d="M43 62 C28 75 21 95 16 123" />
        <path d="M97 62 C112 75 119 95 124 123" />
        <path d="M59 156 C53 170 49 190 47 213" />
        <path d="M81 156 C87 170 91 190 93 213" />
        <path className="body-line" d="M54 82 C62 88 78 88 86 82" />
        <path className="body-line" d="M52 110 C61 116 79 116 88 110" />
        <path className="body-line" d="M60 145 C66 150 74 150 80 145" />
      </svg>

      {points.map((point) => {
        const noteCount = notesByPart[point.id] || 0;
        return (
          <button
            key={point.id}
            type="button"
            className={selected === point.id ? 'body-point active' : 'body-point'}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            onClick={() => onSelect(point.id)}
            title={point.label}
          >
            <span className="body-dot" />
            <span className="body-label">{point.label}</span>
            {noteCount > 0 && <span className="note-badge">{noteCount}</span>}
          </button>
        );
      })}
    </div>
  );
}
