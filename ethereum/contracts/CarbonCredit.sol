// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract CarbonCredit is ERC721 {

    address public admin;
    mapping(address => bool) public isRegistrar;
    mapping(address => bool) public isDeveloper;
    mapping(address => bool) public isRegulator;

    uint256 public constant POW_DIFFICULTY = type(uint256).max >> 8;

    bytes32[] private _leafHashes;
    bytes32 public  merkleRoot;

    uint256 private _nextTokenId;

    struct Credit {
        uint256 tonnes;
        string  developerId;
        string  regulatorId;
        uint256 aiRiskScore;
        address mintedTo;
        bool    isRetired;
    }

    mapping(string  => Credit)  private _credits;
    mapping(string  => bool)    private _exists;
    mapping(string  => uint256) public  creditToTokenId;
    mapping(uint256 => string)  public  tokenToCreditId;

    event CreditIssued(
        string  creditId,
        address indexed owner,
        uint256 tonnes,
        uint256 aiRiskScore,
        string  developerId,
        string  regulatorId,
        uint256 tokenId
    );
    event CreditTransferred(string creditId, address indexed from, address indexed to);
    event CreditRetired(string creditId, address indexed owner);
    event MerkleRootUpdated(bytes32 indexed newRoot, uint256 totalCredits);
    event RegistrarAdded(address indexed addr);
    event RegistrarRemoved(address indexed addr);
    event DeveloperAdded(address indexed addr);
    event RegulatorAdded(address indexed addr);

    constructor() ERC721("CarbonCredit", "CCR") {
        admin = msg.sender;
        isRegistrar[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "CarbonCredit: caller is not the admin");
        _;
    }

    modifier onlyRegistrar() {
        require(isRegistrar[msg.sender], "CarbonCredit: caller is not a registrar");
        _;
    }

    function addRegistrar(address _addr) external onlyAdmin {
        isRegistrar[_addr] = true;
        emit RegistrarAdded(_addr);
    }

    function removeRegistrar(address _addr) external onlyAdmin {
        isRegistrar[_addr] = false;
        emit RegistrarRemoved(_addr);
    }

    function addDeveloper(address _addr) external onlyAdmin {
        isDeveloper[_addr] = true;
        emit DeveloperAdded(_addr);
    }

    function addRegulator(address _addr) external onlyAdmin {
        isRegulator[_addr] = true;
        emit RegulatorAdded(_addr);
    }

    function endorsementHash(
        string  memory _creditId,
        uint256        _tonnes,
        address        _owner
    ) public pure returns (bytes32) {
        bytes32 raw = keccak256(abi.encodePacked(_creditId, _tonnes, _owner));
        return MessageHashUtils.toEthSignedMessageHash(raw);
    }

    function issueCredit(
        string  memory _creditId,
        uint256        _tonnes,
        string  memory _developerId,
        string  memory _regulatorId,
        uint256        _aiRiskScore,
        address        _owner,
        uint256        _nonce,
        bytes   memory _developerSig,
        bytes   memory _regulatorSig
    ) external onlyRegistrar {
        require(
            uint256(keccak256(abi.encodePacked(_creditId, _nonce))) <= POW_DIFFICULTY,
            "CarbonCredit: proof of work not satisfied"
        );

        require(!_exists[_creditId],            "CarbonCredit: creditId already exists");
        require(_tonnes > 0,                    "CarbonCredit: tonnes must be positive");
        require(bytes(_developerId).length > 0, "CarbonCredit: developerId required");
        require(bytes(_regulatorId).length > 0, "CarbonCredit: regulatorId required");
        require(_aiRiskScore < 7000,            "CarbonCredit: risk score too high, credit rejected");
        require(_owner != address(0),           "CarbonCredit: owner cannot be zero address");

        bytes32 hash       = endorsementHash(_creditId, _tonnes, _owner);
        address devSigner  = ECDSA.recover(hash, _developerSig);
        address regSigner  = ECDSA.recover(hash, _regulatorSig);
        require(isDeveloper[devSigner], "CarbonCredit: invalid developer signature");
        require(isRegulator[regSigner], "CarbonCredit: invalid regulator signature");
        require(devSigner != regSigner, "CarbonCredit: developer and regulator must differ");

        _credits[_creditId] = Credit({
            tonnes:      _tonnes,
            developerId: _developerId,
            regulatorId: _regulatorId,
            aiRiskScore: _aiRiskScore,
            mintedTo:    _owner,
            isRetired:   false
        });
        _exists[_creditId] = true;

        uint256 tokenId = _nextTokenId++;
        creditToTokenId[_creditId] = tokenId;
        tokenToCreditId[tokenId]   = _creditId;
        _safeMint(_owner, tokenId);

        bytes32 leaf = keccak256(abi.encodePacked(_creditId, _tonnes, _owner, _aiRiskScore));
        _leafHashes.push(leaf);
        merkleRoot = _computeMerkleRoot();

        emit CreditIssued(_creditId, _owner, _tonnes, _aiRiskScore, _developerId, _regulatorId, tokenId);
        emit MerkleRootUpdated(merkleRoot, _leafHashes.length);
    }

    function transferCredit(string memory _creditId, address _to) external {
        require(_exists[_creditId],                          "CarbonCredit: credit does not exist");
        require(!_credits[_creditId].isRetired,              "CarbonCredit: credit is already retired");
        uint256 tokenId = creditToTokenId[_creditId];
        require(ownerOf(tokenId) == msg.sender,              "CarbonCredit: caller is not the credit owner");
        require(_to != address(0),                           "CarbonCredit: cannot transfer to zero address");
        require(_to != msg.sender,                           "CarbonCredit: cannot transfer to yourself");

        _transfer(msg.sender, _to, tokenId);
        emit CreditTransferred(_creditId, msg.sender, _to);
    }

    function retireCredit(string memory _creditId) external {
        require(_exists[_creditId],             "CarbonCredit: credit does not exist");
        require(!_credits[_creditId].isRetired, "CarbonCredit: credit is already retired");
        uint256 tokenId = creditToTokenId[_creditId];
        require(ownerOf(tokenId) == msg.sender, "CarbonCredit: caller is not the credit owner");

        _burn(tokenId);
        _credits[_creditId].isRetired = true;
        emit CreditRetired(_creditId, msg.sender);
    }

    function transferFrom(address, address, uint256) public pure override {
        revert("CarbonCredit: use transferCredit()");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("CarbonCredit: use transferCredit()");
    }

    function getCredit(string memory _creditId)
        external view
        returns (
            uint256 tonnes,
            string  memory developerId,
            string  memory regulatorId,
            uint256 aiRiskScore,
            address owner,
            bool    isRetired,
            uint256 tokenId
        )
    {
        require(_exists[_creditId], "CarbonCredit: credit does not exist");
        Credit storage c = _credits[_creditId];
        uint256 tid = creditToTokenId[_creditId];
        address cur = c.isRetired ? address(0) : ownerOf(tid);
        return (c.tonnes, c.developerId, c.regulatorId, c.aiRiskScore, cur, c.isRetired, tid);
    }

    function doesCreditExist(string memory _creditId) external view returns (bool) {
        return _exists[_creditId];
    }

    function totalCredits() external view returns (uint256) {
        return _leafHashes.length;
    }

    function getTokenId(string memory _creditId) external view returns (uint256) {
        require(_exists[_creditId], "CarbonCredit: credit does not exist");
        return creditToTokenId[_creditId];
    }

    function getCreditLeafHash(string memory _creditId)
        external view
        returns (bytes32)
    {
        require(_exists[_creditId], "CarbonCredit: credit does not exist");
        Credit storage c = _credits[_creditId];
        return keccak256(abi.encodePacked(_creditId, c.tonnes, c.mintedTo, c.aiRiskScore));
    }

    function verifyCredit(bytes32[] calldata proof, bytes32 leaf)
        external view
        returns (bool)
    {
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    function _computeMerkleRoot() internal view returns (bytes32) {
        uint256 n = _leafHashes.length;
        if (n == 0) return bytes32(0);
        if (n == 1) return _leafHashes[0];

        uint256 size = _nextPowerOf2(n);
        bytes32[] memory nodes = new bytes32[](size);
        for (uint256 i = 0; i < n; i++) nodes[i] = _leafHashes[i];

        while (size > 1) {
            uint256 half = size >> 1;
            for (uint256 i = 0; i < half; i++) {
                bytes32 a = nodes[2 * i];
                bytes32 b = nodes[2 * i + 1];
                nodes[i] = a < b
                    ? keccak256(abi.encodePacked(a, b))
                    : keccak256(abi.encodePacked(b, a));
            }
            size = half;
        }
        return nodes[0];
    }

    function _nextPowerOf2(uint256 n) internal pure returns (uint256) {
        if (n <= 1) return 1;
        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        n |= n >> 8;
        n |= n >> 16;
        n |= n >> 32;
        n |= n >> 64;
        n |= n >> 128;
        return n + 1;
    }
}
