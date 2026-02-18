function App() {
  return (
    <div className="flex h-screen">
      {/* Sidebar placeholder */}
      <aside className="w-60 bg-surface-dark text-white p-component flex flex-col">
        <h1 className="text-lg font-bold mb-section">Life Tracker Ultimate</h1>
        <nav className="space-y-2">
          <div className="text-sm text-gray-300">Daily Log</div>
          <div className="text-sm text-gray-300">Journal</div>
          <div className="text-sm text-gray-300">Analytics</div>
        </nav>
      </aside>

      {/* Content area placeholder */}
      <main className="flex-1 bg-white p-section">
        <h2 className="text-xl font-semibold text-surface-dark">
          Welcome to Life Tracker Ultimate
        </h2>
        <p className="mt-4 text-gray-600">
          Phase 1 scaffold complete. Ready for Phase 2: Types & Constants.
        </p>
      </main>
    </div>
  );
}

export default App;
