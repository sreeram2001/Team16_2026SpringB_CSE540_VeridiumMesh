import hashlib
import json
import time


class Block:
    def __init__(self, index: int, transactions: list, previous_hash: str, nonce: int = 0):
        self.index         = index
        self.transactions  = transactions
        self.previous_hash = previous_hash
        self.nonce         = nonce
        self.timestamp     = time.time()
        self.merkle_root   = self.calculate_merkle_root()
        self.hash          = self.calculate_hash()

    def calculate_merkle_root(self) -> str:
        if not self.transactions:
            return hashlib.sha256(b"").hexdigest()
        tx_string = json.dumps(self.transactions, sort_keys=True)
        return hashlib.sha256(tx_string.encode()).hexdigest()

    def calculate_hash(self) -> str:
        block_string = f"{self.index}{self.timestamp}{self.merkle_root}{self.previous_hash}{self.nonce}"
        return hashlib.sha256(block_string.encode()).hexdigest()

    def mine_block(self, difficulty: int):
        target = "0" * difficulty
        while not self.hash.startswith(target):
            self.nonce += 1
            self.hash = self.calculate_hash()

    # ── Serialisation helpers ────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "index":         self.index,
            "transactions":  self.transactions,
            "previous_hash": self.previous_hash,
            "nonce":         self.nonce,
            "timestamp":     self.timestamp,
            "merkle_root":   self.merkle_root,
            "hash":          self.hash,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Block":
        block = cls.__new__(cls)
        block.index         = data["index"]
        block.transactions  = data["transactions"]
        block.previous_hash = data["previous_hash"]
        block.nonce         = data["nonce"]
        block.timestamp     = data["timestamp"]
        block.merkle_root   = data["merkle_root"]
        block.hash          = data["hash"]
        return block
