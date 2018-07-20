/*
  This file is part of The Colony Network.

  The Colony Network is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  The Colony Network is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with The Colony Network. If not, see <http://www.gnu.org/licenses/>.
*/

pragma solidity ^0.4.23;
pragma experimental "v0.5.0";

import "../lib/dappsys/roles.sol";


contract Authority is DSRoles {
  uint8 ownerRole = 0;
  uint8 adminRole = 1;

  constructor(address colony) public {
    // Set token
    setOwnerRoleCapability(colony, "setToken(address)");
    // Bootstrap colony
    setOwnerRoleCapability(colony, "bootstrapColony(address[],int256[])");
    // Mint tokens
    setOwnerRoleCapability(colony, "mintTokens(uint256)");
    // Add global skill
    setOwnerRoleCapability(colony, "addGlobalSkill(uint256)");
    // Transfer ownership
    setOwnerRoleCapability(colony, "setOwnerRole(address)");
    // Remove admin role
    setOwnerRoleCapability(colony, "removeAdminRole(address)");
    // Upgrade colony
    setOwnerRoleCapability(colony, "upgrade(uint256)");
    // Set token issuance rate
    setOwnerRoleCapability(colony, "setTokenIssuanceRate(uint256,uint256,uint256)");
    // Mint initial tokens
    setOwnerRoleCapability(colony, "mintInitialTokens(uint256)");
    setOwnerRoleCapability(colony, "setTokenSupplyCeiling(uint256)");

    // Allocate funds
    setAdminRoleCapability(colony, "moveFundsBetweenPots(uint256,uint256,uint256,address)");
    setOwnerRoleCapability(colony, "moveFundsBetweenPots(uint256,uint256,uint256,address)");
    // Add domain
    setAdminRoleCapability(colony, "addDomain(uint256)");
    setOwnerRoleCapability(colony, "addDomain(uint256)");
    // Add task
    setAdminRoleCapability(colony, "makeTask(bytes32,uint256)");
    setOwnerRoleCapability(colony, "makeTask(bytes32,uint256)");
    // Start next reward payout
    setAdminRoleCapability(colony, "startNextRewardPayout(address)");
    setOwnerRoleCapability(colony, "startNextRewardPayout(address)");
    // Cancel task
    setAdminRoleCapability(colony, "cancelTask(uint256)");
    setOwnerRoleCapability(colony, "cancelTask(uint256)");
    // Set admin
    setAdminRoleCapability(colony, "setAdminRole(address)");
    setOwnerRoleCapability(colony, "setAdminRole(address)");
  }

  function setOwnerRoleCapability(address colony, bytes sig) private {
    bytes4 functionSig = bytes4(keccak256(sig));
    setRoleCapability(ownerRole, colony, functionSig, true);
  }

  function setAdminRoleCapability(address colony, bytes sig) private {
    bytes4 functionSig = bytes4(keccak256(sig));
    setRoleCapability(adminRole, colony, functionSig, true);
  }
}
