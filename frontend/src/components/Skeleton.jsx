export default function Skeleton({ count = 3 }) {
  return (
    <div className="skeleton-stack" aria-label="Loading">
      {Array.from({ length: count }).map((_, idx) => (
        <div className="skeleton-card" key={idx}>
          <div className="sk-line short" />
          <div className="sk-line" />
          <div className="sk-line tiny" />
        </div>
      ))}
    </div>
  );
}
