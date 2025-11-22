export type TabType = "home" | "expense" | "friends" | "profile";

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

/**
 * Bottom navigation component for mobile-app style navigation
 */
function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-item ${activeTab === "home" ? "active" : ""}`}
        onClick={() => onTabChange("home")}
        aria-label="Home"
      >
        <span className="nav-icon">🏠</span>
        <span className="nav-label">Home</span>
      </button>
      
      <button
        className={`bottom-nav-item ${activeTab === "expense" ? "active" : ""}`}
        onClick={() => onTabChange("expense")}
        aria-label="Add Expense"
      >
        <span className="nav-icon">➕</span>
        <span className="nav-label">Expense</span>
      </button>
      
      <button
        className={`bottom-nav-item ${activeTab === "friends" ? "active" : ""}`}
        onClick={() => onTabChange("friends")}
        aria-label="Friends"
      >
        <span className="nav-icon">👥</span>
        <span className="nav-label">Friends</span>
      </button>
      
      <button
        className={`bottom-nav-item ${activeTab === "profile" ? "active" : ""}`}
        onClick={() => onTabChange("profile")}
        aria-label="Profile"
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </button>
    </nav>
  );
}

export default BottomNav;
