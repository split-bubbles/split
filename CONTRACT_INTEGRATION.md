# Frontend Integration with FriendRequests Contract

## After Deployment

1. Update the contract address in `frontend/src/contracts/FriendRequests.ts`:
   ```typescript
   export const FRIEND_REQUESTS_CONTRACT_ADDRESS = "YOUR_DEPLOYED_ADDRESS" as const;
   ```

2. The frontend components (`PendingApprovals.tsx` and `AddFriend.tsx`) will need to be updated to use the contract instead of localStorage.

## Contract Functions

- `sendFriendRequest(address to)` - Send a friend request
- `approveFriendRequest(address requester)` - Approve a pending request
- `rejectFriendRequest(address requester)` - Reject a pending request
- `removeFriend(address friend)` - Remove an existing friend
- `getPendingRequests(address user)` - Get all pending requests for a user
- `getFriends(address user)` - Get all friends of a user
- `hasRequest(address recipient, address sender)` - Check if a request exists
- `isFriend(address user, address friend)` - Check if two users are friends

## Events

- `FriendRequestSent(address indexed from, address indexed to, uint256 timestamp)`
- `FriendRequestApproved(address indexed approver, address indexed friend, uint256 timestamp)`
- `FriendRequestRejected(address indexed rejector, address indexed requester, uint256 timestamp)`

