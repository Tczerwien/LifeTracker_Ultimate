import { NavLink } from 'react-router-dom';
import { useUIStore } from '../../stores/ui-store';

interface NavItem {
  readonly label: string;
  readonly to: string;
}

const PRIMARY_NAV: readonly NavItem[] = [
  { label: 'Daily Log', to: '/' },
  { label: 'Journal', to: '/journal' },
  { label: 'Analytics', to: '/analytics' },
];

const SECONDARY_NAV: readonly NavItem[] = [
  { label: 'Study Log', to: '/study' },
  { label: 'App Log', to: '/apps' },
  { label: 'Weekly Review', to: '/review' },
  { label: 'Milestones', to: '/milestones' },
  { label: 'Settings', to: '/settings' },
];

const RECOVERY_NAV: readonly NavItem[] = [
  { label: 'Urge Log', to: '/recovery/urge' },
  { label: 'Relapse Log', to: '/recovery/relapse' },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block px-4 py-2 text-sm rounded-r-md border-l-2 transition-colors';
  if (isActive) {
    return `${base} border-productivity bg-white/10 text-white font-medium`;
  }
  return `${base} border-transparent text-gray-300 hover:bg-white/5 hover:text-white`;
}

function recoveryNavLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block px-4 py-1.5 text-subdued rounded-r-md border-l-2 transition-colors';
  if (isActive) {
    return `${base} border-productivity bg-white/10 text-gray-200`;
  }
  return `${base} border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300`;
}

function Sidebar() {
  const recoveryExpanded = useUIStore((state) => state.recoveryExpanded);
  const toggleRecoveryExpanded = useUIStore((state) => state.toggleRecoveryExpanded);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);

  return (
    <aside className="w-60 bg-surface-dark text-white p-component flex flex-col h-screen shrink-0">
      <div className="flex items-center justify-between mb-section">
        <h1 className="text-lg font-bold">Life Tracker Ultimate</h1>
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={() => setSidebarOpen(false)}
          className="rounded p-1 text-gray-400 hover:text-white"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Primary Nav */}
      <nav className="space-y-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="my-4 border-t border-gray-700" />

      {/* Secondary Nav */}
      <nav className="space-y-1">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Recovery Section — pinned to bottom, subdued */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={toggleRecoveryExpanded}
          className="flex items-center justify-between w-full px-4 py-1.5 text-subdued text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span>Recovery</span>
          <span className={`transition-transform ${recoveryExpanded ? 'rotate-90' : ''}`}>
            &#9656;
          </span>
        </button>
        {recoveryExpanded && (
          <nav className="mt-1 space-y-0.5">
            {RECOVERY_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={recoveryNavLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
