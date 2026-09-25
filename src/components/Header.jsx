export default function Header({ onLogoClick, onHistoryClick, onSettingsClick }) {
  return (
    <header className="app-header">
      <button className="app-logo" onClick={onLogoClick} aria-label="Go to home">
        FocusLoop
      </button>
      <div className="header-actions">
        <button
          className="icon-btn"
          onClick={onHistoryClick}
          aria-label="Session history"
          title="Session history"
        >
          📋
        </button>
        <button
          className="icon-btn"
          onClick={onSettingsClick}
          aria-label="Settings"
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
