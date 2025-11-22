// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FriendRequests
 * @notice Smart contract for managing friend requests on-chain
 */
contract FriendRequests {
    // Struct to represent a friend request
    struct FriendRequest {
        address from;
        uint256 timestamp;
        bool exists;
    }

    // Mapping from user address => array of friend addresses
    mapping(address => address[]) public friends;

    // Mapping from user address => mapping of friend address => isFriend
    mapping(address => mapping(address => bool)) public isFriend;

    // Mapping from recipient => mapping of sender => FriendRequest
    mapping(address => mapping(address => FriendRequest)) public requests;

    // Mapping from recipient => array of senders who have pending requests
    mapping(address => address[]) public pendingRequestSenders;

    // Events
    event FriendRequestSent(address indexed from, address indexed to, uint256 timestamp);
    event FriendRequestApproved(address indexed approver, address indexed friend, uint256 timestamp);
    event FriendRequestRejected(address indexed rejector, address indexed requester, uint256 timestamp);
    event FriendRemoved(address indexed user, address indexed friend, uint256 timestamp);

    /**
     * @notice Send a friend request to another user
     * @param to The address of the user to send the request to
     */
    function sendFriendRequest(address to) external {
        require(to != address(0), "Invalid address");
        require(to != msg.sender, "Cannot send request to yourself");
        require(!isFriend[msg.sender][to], "Already friends");
        require(!requests[to][msg.sender].exists, "Request already sent");

        requests[to][msg.sender] = FriendRequest({
            from: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        // Add to pending requests array
        pendingRequestSenders[to].push(msg.sender);

        emit FriendRequestSent(msg.sender, to, block.timestamp);
    }

    /**
     * @notice Approve a friend request
     * @param requester The address of the user who sent the request
     */
    function approveFriendRequest(address requester) external {
        require(requests[msg.sender][requester].exists, "Request does not exist");
        require(!isFriend[msg.sender][requester], "Already friends");

        // Add to friends list
        friends[msg.sender].push(requester);
        friends[requester].push(msg.sender);
        isFriend[msg.sender][requester] = true;
        isFriend[requester][msg.sender] = true;

        // Remove the request
        delete requests[msg.sender][requester];
        _removeFromArray(pendingRequestSenders[msg.sender], requester);

        emit FriendRequestApproved(msg.sender, requester, block.timestamp);
    }

    /**
     * @notice Reject a friend request
     * @param requester The address of the user who sent the request
     */
    function rejectFriendRequest(address requester) external {
        require(requests[msg.sender][requester].exists, "Request does not exist");

        // Remove the request
        delete requests[msg.sender][requester];
        _removeFromArray(pendingRequestSenders[msg.sender], requester);

        emit FriendRequestRejected(msg.sender, requester, block.timestamp);
    }

    /**
     * @notice Remove a friend
     * @param friend The address of the friend to remove
     */
    function removeFriend(address friend) external {
        require(isFriend[msg.sender][friend], "Not friends");

        // Remove from friends mapping
        isFriend[msg.sender][friend] = false;
        isFriend[friend][msg.sender] = false;

        // Remove from friends array
        _removeFromArray(friends[msg.sender], friend);
        _removeFromArray(friends[friend], msg.sender);

        emit FriendRemoved(msg.sender, friend, block.timestamp);
    }

    /**
     * @notice Get all pending requests for a user
     * @param user The address of the user
     * @return An array of addresses who have sent requests to this user
     */
    function getPendingRequests(address user) external view returns (address[] memory) {
        return pendingRequestSenders[user];
    }

    /**
     * @notice Check if a request exists
     * @param recipient The recipient of the request
     * @param sender The sender of the request
     * @return Whether the request exists
     */
    function hasRequest(address recipient, address sender) external view returns (bool) {
        return requests[recipient][sender].exists;
    }

    /**
     * @notice Get friend count for a user
     * @param user The address of the user
     * @return The number of friends
     */
    function getFriendCount(address user) external view returns (uint256) {
        return friends[user].length;
    }

    /**
     * @notice Get all friends of a user
     * @param user The address of the user
     * @return An array of friend addresses
     */
    function getFriends(address user) external view returns (address[] memory) {
        return friends[user];
    }

    /**
     * @notice Internal function to remove an address from an array
     */
    function _removeFromArray(address[] storage array, address toRemove) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == toRemove) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }
}

