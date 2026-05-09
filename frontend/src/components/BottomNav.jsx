import { Globe2, Home, Settings, UserRound, Shield } from 'lucide-react';

const items = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'global', label: 'Global', icon: Globe2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav({ active, onChange, labels, isStaff }) {
  const filteredItems = isStaff ? [...items, { id: 'admin', label: 'Admin', icon: Shield }] : items;
  const isCompact = filteredItems.length > 4;

  return (
    <nav 
      className="bottom-nav" 
      style={{ 
        gridTemplateColumns: `repeat(${filteredItems.length}, 1fr)`,
        gap: isCompact ? '0.15rem' : '0.35rem',
        padding: isCompact ? '0.35rem' : '0.45rem'
      }} 
      aria-label="Main tabs"
    >
      {filteredItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? 'nav-item active' : 'nav-item'}
            style={isCompact ? { fontSize: '0.65rem' } : {}}
            onClick={() => {
              onChange(item.id);
              window.dispatchEvent(new CustomEvent('change-app-tab', { detail: item.id }));
            }}
          >
            <Icon size={isCompact ? 18 : 20} />
            <span>{labels?.[item.id] || item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
