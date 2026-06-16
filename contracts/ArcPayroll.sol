// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ArcPayroll {
    struct Run { address owner; string name; uint256 totalAmt; bool paid; uint256 at; }
    Run[] public runs;
    mapping(uint256 => address[]) public recips;
    mapping(uint256 => uint256[]) public amts;
    mapping(address => uint256[]) private ownerMap;
    event RunCreated(uint256 indexed id, address indexed owner);
    event PaidOut(uint256 indexed id, uint256 totalAmt);
    function createRun(string calldata name) external returns (uint256 id) {
        id = runs.length; runs.push(Run(msg.sender, name, 0, false, block.timestamp));
        ownerMap[msg.sender].push(id); emit RunCreated(id, msg.sender);
    }
    function addRecipient(uint256 id, address to, uint256 amount) external {
        Run storage r = runs[id]; require(msg.sender == r.owner && !r.paid && to != address(0) && amount > 0, "no");
        recips[id].push(to); amts[id].push(amount); r.totalAmt += amount;
    }
    function fundAndPay(uint256 id) external payable {
        Run storage r = runs[id]; require(msg.sender == r.owner && !r.paid, "no");
        require(msg.value == r.totalAmt && r.totalAmt > 0, "wrong total"); r.paid = true;
        address[] storage rs = recips[id]; uint256[] storage am = amts[id];
        for (uint256 i = 0; i < rs.length; i++) { (bool ok,) = payable(rs[i]).call{value: am[i]}(""); require(ok, "fail"); }
        emit PaidOut(id, msg.value);
    }
    function get(uint256 id) external view returns (Run memory) { return runs[id]; }
    function count(uint256 id) external view returns (uint256) { return recips[id].length; }
    function recipientAt(uint256 id, uint256 i) external view returns (address, uint256) { return (recips[id][i], amts[id][i]); }
    function getOwner(address u) external view returns (uint256[] memory) { return ownerMap[u]; }
    function total() external view returns (uint256) { return runs.length; }
}
