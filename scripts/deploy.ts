import { ethers } from "hardhat";

async function main() {
  // Check if we have accounts configured
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.error("\n❌ No accounts configured!");
    console.error("\nPlease set up your .env file with a PRIVATE_KEY:");
    console.error("1. Edit .env file");
    console.error("2. Add: PRIVATE_KEY=your_private_key_here");
    console.error("3. Make sure the account has Base Sepolia ETH");
    console.error("\nGet testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    process.exit(1);
  }

  const deployer = signers[0];
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("Deploying FriendRequests contract...");
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("\n❌ Deployer account has no ETH!");
    console.error("Please fund your account with Base Sepolia ETH");
    console.error("Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet");
    process.exit(1);
  }

  const FriendRequests = await ethers.getContractFactory("FriendRequests");
  console.log("\nDeploying contract...");
  const friendRequests = await FriendRequests.deploy();

  await friendRequests.waitForDeployment();

  const address = await friendRequests.getAddress();
  console.log("\n✅ FriendRequests deployed successfully!");
  console.log("Contract address:", address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("\n📝 Update frontend/src/contracts/FriendRequests.ts with this address:");
  console.log(`export const FRIEND_REQUESTS_CONTRACT_ADDRESS = "${address}" as const;`);
  console.log("\n🔍 View on BaseScan:");
  console.log(`https://sepolia.basescan.org/address/${address}`);
  console.log("\n📋 To verify on BaseScan, run:");
  console.log(`npx hardhat verify --network base-sepolia ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

