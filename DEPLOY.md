# Deploying FriendRequests Contract to Base Sepolia

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `PRIVATE_KEY`: Your wallet's private key (the account that will deploy)
- `BASE_SEPOLIA_RPC_URL`: Optional, defaults to public RPC
- `BASESCAN_API_KEY`: Optional, for contract verification

## Getting Testnet ETH

You'll need Base Sepolia ETH to deploy. Get it from:
- Base Sepolia Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Or bridge from Ethereum Sepolia

## Deployment Steps

1. Compile the contract:
```bash
npm run compile
```

2. Deploy to Base Sepolia:
```bash
npm run deploy:base-sepolia
```

3. Copy the deployed contract address from the output

4. (Optional) Verify the contract on BaseScan:
```bash
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS>
```

## Updating Frontend

After deployment, update the contract address in:
- `frontend/src/PendingApprovals.tsx`
- `frontend/src/AddFriend.tsx`

Replace the contract address constant with your deployed address.

