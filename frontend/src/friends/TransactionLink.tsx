import { type Address } from "viem";

const BASESCAN_BASE_URL = "https://sepolia.basescan.org";

interface TransactionLinkProps {
  hash: `0x${string}`;
  label?: string;
}

/**
 * Component to display a link to BaseScan transaction
 */
export function TransactionLink({ hash, label = "View Transaction" }: TransactionLinkProps) {
  const url = `${BASESCAN_BASE_URL}/tx/${hash}`;
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "#0066cc",
        textDecoration: "none",
        fontSize: "0.875rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
    >
      {label}
      <span style={{ fontSize: "0.75rem" }}>↗</span>
    </a>
  );
}

interface AddressLinkProps {
  address: Address | string;
  label?: string;
}

/**
 * Component to display a link to BaseScan address
 */
export function AddressLink({ address, label }: AddressLinkProps) {
  const url = `${BASESCAN_BASE_URL}/address/${address}`;
  const displayText = label || `${address.slice(0, 6)}...${address.slice(-4)}`;
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "#0066cc",
        textDecoration: "none",
        fontSize: "0.875rem",
      }}
    >
      {displayText}
    </a>
  );
}

