import { Globe2, Home, Settings, UserRound, Shield } from 'lucide-react';

const items = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'global', label: 'Global', icon: Globe2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function BottomNav({ active, onChange, labels, isStaff }) {
  const filteredItems = isStaff ? [...items, { id: 'admin', label: 'Admin', icon: Shield }] : items;

  return (
    <nav className="bottom-nav" aria-label="Main tabs">
      {filteredItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={active === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              onChange(item.id);
              window.dispatchEvent(new CustomEvent('change-app-tab', { detail: item.id }));
            }}
          >
            <Icon size={20} />
            <span>{labels?.[item.id] || item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
