// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ArcDriftCore {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    uint256 public nextDriftId;

    enum RuleType { STREAMING, DELAYED, CANCELABLE }

    struct DriftRule {
        address sender;
        address recipient;
        uint256 amount;
        uint256 withdrawn;
        uint256 startTime;
        uint256 endTime;
        RuleType ruleType;
        bool active;
    }

    mapping(uint256 => DriftRule) public drifts;

    constructor(address _usdcAddress) {
        usdc = IERC20(_usdcAddress);
    }

    function createDrift(address _recipient, uint256 _amount, uint256 _startTime, uint256 _endTime, RuleType _ruleType) external returns (uint256) {
        require(_amount > 0, "Must send money");
        require(_endTime > _startTime, "Invalid timeframe");

        uint256 id = nextDriftId++;
        drifts[id] = DriftRule(msg.sender, _recipient, _amount, 0, _startTime, _endTime, _ruleType, true);
        
        usdc.safeTransferFrom(msg.sender, address(this), _amount);
        return id;
    }

    function executeDrift(uint256 _id) external {
        DriftRule storage drift = drifts[_id];
        require(drift.active == true, "Stream closed");
        require(block.timestamp >= drift.startTime, "Hasn't started");

        uint256 amountToSend = 0;

        if (drift.ruleType == RuleType.STREAMING) {
            uint256 elapsed = block.timestamp - drift.startTime;
            uint256 duration = drift.endTime - drift.startTime;
            uint256 totalUnlocked = (drift.amount * elapsed) / duration;
            
            amountToSend = totalUnlocked - drift.withdrawn;

            if (block.timestamp >= drift.endTime) {
                drift.active = false; 
            }
        } else if (drift.ruleType == RuleType.DELAYED || drift.ruleType == RuleType.CANCELABLE) {
            require(block.timestamp >= drift.endTime, "Deadline not met");
            amountToSend = drift.amount;
            drift.active = false;
        }

        require(amountToSend > 0, "No new money unlocked");
        
        drift.withdrawn += amountToSend;
        usdc.safeTransfer(drift.recipient, amountToSend);
    }
}