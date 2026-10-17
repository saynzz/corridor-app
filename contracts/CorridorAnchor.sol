// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.6.10 <0.8.20;

contract CorridorAnchor {
    event Anchored(bytes32 indexed root, uint256 count, string reason, address indexed by, uint256 at);

    mapping(bytes32 => uint256) public anchoredAt;

    function anchor(bytes32 root, uint256 count, string memory reason) public {
        require(anchoredAt[root] == 0, "already anchored");
        anchoredAt[root] = block.timestamp;
        emit Anchored(root, count, reason, msg.sender, block.timestamp);
    }
}
