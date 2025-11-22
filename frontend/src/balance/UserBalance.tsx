import { LoadingSkeleton } from "@coinbase/cdp-react/components/ui/LoadingSkeleton";

interface Props {
  balance?: string;
}

/**
 * A component that displays the user's balance.
 *
 * @param {Props} props - The props for the UserBalance component.
 * @param {string} [props.balance] - The user's balance.
 * @returns A component that displays the user's balance.
 */
function UserBalance(props: Props) {
  const { balance } = props;

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)",
      borderRadius: "1rem",
      padding: "1.5rem",
      margin: "-0.5rem",
    }}>
      <h2 className="card-title" style={{ marginBottom: "1rem" }}>💰 Your Balance</h2>
      <div className="user-balance flex-col-container flex-grow" style={{ gap: "0.5rem" }}>
        {balance === undefined && <LoadingSkeleton as="span" className="loading--balance" />}
        {balance !== undefined && (
          <>
            <div className="flex-row-container" style={{ 
              fontSize: "2.75rem", 
              fontWeight: "700",
              background: "linear-gradient(135deg, #0052FF 0%, #3b82f6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              <img src="/usdc.svg" alt="USDC" className="balance-icon" style={{ width: "2.75rem", height: "2.75rem" }} />
              <span>{balance}</span>
              <span style={{ fontSize: "1.5rem", opacity: 0.7, marginLeft: "0.5rem" }}>USDC</span>
            </div>
            <span className="sr-only">USDC Balance</span>
          </>
        )}
      </div>
      <p style={{ 
        fontSize: "0.875rem", 
        color: "var(--cdp-example-text-secondary-color)",
        margin: "1rem 0 0 0",
        textAlign: "center"
      }}>
        💧 Need testnet tokens?{" "}
        <a
          href="https://portal.cdp.coinbase.com/products/faucet"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: "500", color: "var(--cdp-example-accent-color)" }}
        >
          Get from faucet
        </a>
      </p>
    </div>
  );
}

export default UserBalance;
