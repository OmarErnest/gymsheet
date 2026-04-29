import { Globe2, Home, Settings, UserRound } from 'lucide-react';

const items = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'global', label: 'Global', icon: Globe2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav({ active, onChange, labels }) {
  return (
    <nav className="bottom-nav" aria-label="Main tabs">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => onChange(item.id)}
          >
            <Icon size={20} />
            <span>{labels?.[item.id] || item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
