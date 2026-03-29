import json
import os

from .block import Block
from .types import MINT_CREDIT, TRANSFER_CREDIT, RETIRE_CREDIT

_DEFAULT_DATA_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "data", "chain.json"
)


class Blockchain:
    def __init__(self, difficulty: int = 2, data_file: str | None = _DEFAULT_DATA_FILE):
        self.difficulty           = difficulty
        self.chain: list[Block]   = []
        self.pending_transactions: list[dict] = []
        self.credits: dict        = {}   # credit_id -> credit details dict
        self.ownership: dict      = {}   # (credit_id, owner_id) -> units held
        self._data_file           = data_file

        # Endorsement policy: require both developer and regulator approval
        self.endorsement_policy_enabled = True

        if not self._load():
            self.create_genesis_block()

    # ── Genesis ──────────────────────────────────────────────────────────
    def create_genesis_block(self):
        genesis = Block(index=0, transactions=[], previous_hash="0")
        genesis.mine_block(self.difficulty)
        self.chain.append(genesis)

    def get_latest_block(self) -> Block:
        return self.chain[-1]

    # ── Transactions ─────────────────────────────────────────────────────
    def add_transaction(self, tx: dict):
        self.pending_transactions.append(tx)

    def apply_transaction(self, tx: dict):
        tx_type = tx["type"]

        if tx_type == MINT_CREDIT:
            credit_id    = tx["credit_id"]
            owner_id     = tx["owner_id"]
            tonnes       = tx["tonnes"]
            self.credits[credit_id] = {
                "tonnes":        tonnes,
                "project_type":  tx["project_type"],
                "vintage_year":  tx["vintage_year"],
                "ai_risk_score": tx["ai_risk_score"],
                "status":        "active",
            }
            self.ownership[(credit_id, owner_id)] = tonnes

        elif tx_type == TRANSFER_CREDIT:
            credit_id  = tx["credit_id"]
            from_owner = tx["from_owner"]
            to_owner   = tx["to_owner"]
            units      = tx["units"]
            if self.credits[credit_id]["status"] != "active":
                raise ValueError(f"Credit {credit_id} is already retired.")
            if self.ownership.get((credit_id, from_owner), 0) < units:
                raise ValueError(f"Insufficient units: {from_owner} does not hold {units} of {credit_id}.")
            self.ownership[(credit_id, from_owner)] -= units
            self.ownership[(credit_id, to_owner)]    = self.ownership.get((credit_id, to_owner), 0) + units

        elif tx_type == RETIRE_CREDIT:
            credit_id = tx["credit_id"]
            owner_id  = tx["owner_id"]
            if self.ownership.get((credit_id, owner_id), 0) <= 0:
                raise ValueError(f"No units to retire: {owner_id} holds 0 of {credit_id}.")
            self.credits[credit_id]["status"] = "retired"

    def mine_pending_transactions(self):
        if not self.pending_transactions:
            return None
        new_block = Block(
            index=len(self.chain),
            transactions=self.pending_transactions.copy(),
            previous_hash=self.get_latest_block().hash,
        )
        new_block.mine_block(self.difficulty)
        self.chain.append(new_block)
        for tx in new_block.transactions:
            self.apply_transaction(tx)
        self.pending_transactions = []
        self._save()
        return new_block

    def is_chain_valid(self) -> bool:
        for i in range(1, len(self.chain)):
            current  = self.chain[i]
            previous = self.chain[i - 1]
            # Verify merkle root matches actual transactions
            if current.merkle_root != current.calculate_merkle_root():
                return False
            if current.hash != current.calculate_hash():
                return False
            if current.previous_hash != previous.hash:
                return False
        return True

    # ── Query History (audit trail) ──────────────────────────────────────
    def get_credit_history(self, credit_id: str) -> list[dict]:
        """Walk the entire chain and return every transaction for a credit."""
        history = []
        for block in self.chain:
            for tx in block.transactions:
                if tx.get("credit_id") == credit_id:
                    history.append({
                        **tx,
                        "block_index": block.index,
                        "block_hash":  block.hash,
                    })
        return history

    # ── Chain stats ──────────────────────────────────────────────────────
    def get_stats(self) -> dict:
        total_credits = len(self.credits)
        active   = sum(1 for c in self.credits.values() if c["status"] == "active")
        retired  = sum(1 for c in self.credits.values() if c["status"] == "retired")
        flagged  = sum(1 for c in self.credits.values() if c["ai_risk_score"] >= 0.8)
        total_tx = sum(len(b.transactions) for b in self.chain)
        return {
            "total_credits":  total_credits,
            "active_credits": active,
            "retired_credits": retired,
            "flagged_high_risk": flagged,
            "total_transactions": total_tx,
            "chain_length": len(self.chain),
        }

    # ── Endorsement policy check ─────────────────────────────────────────
    def check_endorsement(self, developer_id: str | None, regulator_id: str | None):
        """Raise if endorsement policy is enabled but signatures are missing."""
        if not self.endorsement_policy_enabled:
            return
        if not developer_id or not developer_id.strip():
            raise ValueError("Endorsement policy requires a developer_id.")
        if not regulator_id or not regulator_id.strip():
            raise ValueError("Endorsement policy requires a regulator_id (government approval).")

    # ── Persistence ──────────────────────────────────────────────────────
    def _save(self):
        if not self._data_file:
            return
        payload = {
            "difficulty": self.difficulty,
            "chain": [b.to_dict() for b in self.chain],
        }
        os.makedirs(os.path.dirname(self._data_file), exist_ok=True)
        with open(self._data_file, "w") as f:
            json.dump(payload, f)

    def _load(self) -> bool:
        if not self._data_file or not os.path.exists(self._data_file):
            return False
        try:
            with open(self._data_file, "r") as f:
                payload = json.load(f)
            self.difficulty = payload.get("difficulty", self.difficulty)
            self.chain = [Block.from_dict(bd) for bd in payload["chain"]]
            # Replay all transactions to rebuild state
            for block in self.chain:
                for tx in block.transactions:
                    self.apply_transaction(tx)
            return True
        except (json.JSONDecodeError, KeyError):
            return False
