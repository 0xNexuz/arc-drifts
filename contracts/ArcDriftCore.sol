// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ArcDriftCore {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public nextDriftId;

    enum RuleType {
        STREAMING,
        DELAYED,
        CANCELABLE,
        RECURRING
    }

    struct DriftRule {
        address sender;
        address recipient;
        uint256 amount;
        uint256 withdrawn;
        uint256 startTime;
        uint256 endTime;
        uint256 interval;
        RuleType ruleType;
        bool active;
    }

    mapping(uint256 => DriftRule) public drifts;

    event DriftCreated(
        uint256 indexed driftId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 interval,
        RuleType ruleType
    );
    event DriftExecuted(uint256 indexed driftId, address indexed recipient, uint256 amount);
    event DriftCanceled(uint256 indexed driftId, uint256 refundedAmount);

    constructor(address _usdcAddress) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }

    function createDrift(
        address _recipient,
        uint256 _amount,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _interval,
        RuleType _ruleType
    ) external returns (uint256) {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Must send money");
        require(_endTime > _startTime, "Invalid timeframe");

        if (_ruleType == RuleType.RECURRING) {
            require(_interval > 0, "Interval required");
            require(_interval <= _endTime - _startTime, "Interval too long");
        } else {
            require(_interval == 0, "Interval only for recurring");
        }

        uint256 id = nextDriftId++;
        drifts[id] = DriftRule({
            sender: msg.sender,
            recipient: _recipient,
            amount: _amount,
            withdrawn: 0,
            startTime: _startTime,
            endTime: _endTime,
            interval: _interval,
            ruleType: _ruleType,
            active: true
        });

        usdc.safeTransferFrom(msg.sender, address(this), _amount);
        emit DriftCreated(id, msg.sender, _recipient, _amount, _startTime, _endTime, _interval, _ruleType);
        return id;
    }

    function executeDrift(uint256 _id) external {
        DriftRule storage drift = drifts[_id];
        require(drift.active, "Stream closed");
        require(block.timestamp >= drift.startTime, "Hasn't started");

        uint256 amountToSend = releasable(_id);
        require(amountToSend > 0, "No new money unlocked");

        drift.withdrawn += amountToSend;

        if (drift.withdrawn == drift.amount) {
            drift.active = false;
        }

        usdc.safeTransfer(drift.recipient, amountToSend);
        emit DriftExecuted(_id, drift.recipient, amountToSend);
    }

    function cancelDrift(uint256 _id) external {
        DriftRule storage drift = drifts[_id];
        require(drift.active, "Stream closed");
        require(drift.ruleType == RuleType.CANCELABLE, "Not cancelable");
        require(msg.sender == drift.sender, "Only sender");

        uint256 refundAmount = drift.amount - drift.withdrawn;
        drift.active = false;

        if (refundAmount > 0) {
            usdc.safeTransfer(drift.sender, refundAmount);
        }

        emit DriftCanceled(_id, refundAmount);
    }

    function releasable(uint256 _id) public view returns (uint256) {
        DriftRule storage drift = drifts[_id];

        if (!drift.active || block.timestamp < drift.startTime || drift.withdrawn >= drift.amount) {
            return 0;
        }

        uint256 unlocked;

        if (drift.ruleType == RuleType.STREAMING) {
            if (block.timestamp >= drift.endTime) {
                unlocked = drift.amount;
            } else {
                uint256 elapsed = block.timestamp - drift.startTime;
                uint256 duration = drift.endTime - drift.startTime;
                unlocked = (drift.amount * elapsed) / duration;
            }
        } else if (drift.ruleType == RuleType.DELAYED || drift.ruleType == RuleType.CANCELABLE) {
            unlocked = block.timestamp >= drift.endTime ? drift.amount : 0;
        } else if (drift.ruleType == RuleType.RECURRING) {
            unlocked = _recurringUnlocked(drift);
        }

        if (unlocked <= drift.withdrawn) {
            return 0;
        }

        return unlocked - drift.withdrawn;
    }

    function _recurringUnlocked(DriftRule storage drift) private view returns (uint256) {
        if (block.timestamp >= drift.endTime) {
            return drift.amount;
        }

        uint256 elapsed = block.timestamp - drift.startTime;
        uint256 elapsedPeriods = elapsed / drift.interval;

        if (elapsedPeriods == 0) {
            return 0;
        }

        uint256 duration = drift.endTime - drift.startTime;
        uint256 totalPeriods = (duration + drift.interval - 1) / drift.interval;

        return (drift.amount * elapsedPeriods) / totalPeriods;
    }
}
