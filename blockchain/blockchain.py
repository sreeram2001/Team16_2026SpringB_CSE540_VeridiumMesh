import json
import os

from .block import Block
from .contract import CarbonCreditContract
from .types import MINT_CREDIT, TRANSFER_CREDIT, RETIRE_CREDIT
from .wallet import verify_signature

_DEFAULT_DATA_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "data", "chain.json"
)


class Blockchain:
    """
    Blockchain infrastructure layer.

    Manages the append-only chain of blocks, Proof-of-Work mining, and
    persistence. All business logic (credit lifecycle, validation rules,
    endorsement policy) is delegated to the CarbonCreditContract.
    """

    def __init__(self, difficulty: int = 2, data_file: str | None = _DEFAULT_DATA_FILE):
        self.difficulty           = difficulty
        self.chain: list[Block]   = []
        self.pending_transactions: list[dict] = []
        self._data_file           = data_file

        # Smart contract instance — owns all credit state and business rules
        self.contract = CarbonCreditContract()

        if not self._load():
            self.create_genesis_block()

    # ── Convenience accessors (delegate to contract) ─────────────────────
    @property
    def credits(self) -> dict:
        return self.contract.credits

    @property
    def ownership(self) -> dict:
        return self.contract.ownership

    @property
    def endorsement_policy_enabled(self) -> bool:
        return self.contract.endorsement_policy_enabled

    @endorsement_policy_enabled.setter
    def endorsement_policy_enabled(self, value: bool):
        self.contract.endorsement_policy_enabled = value

    # ── Genesis ──────────────────────────────────────────────────────────
    def create_genesis_block(self):
        genesis = Block(index=0, transactions=[], previous_hash="0")
        genesis.mine_block(self.difficulty)
        self.chain.append(genesis)

    def get_latest_block(self) -> Block:
        return self.chain[-1]

    # ── Transactions ─────────────────────────────────────────────────────
    def add_transaction(self, tx: dict):
        """
        Add a transaction to the pending pool.
        TRANSFER_CREDIT and RETIRE_CREDIT transactions MUST include:
            "signature":  <hex ECDSA signature over the tx body>
            "public_key": <hex verifying key of the signer>
        """
        signed_types = (TRANSFER_CREDIT, RETIRE_CREDIT)
        if tx.get("type") in signed_types:
            signature  = tx.get("signature")
            public_key = tx.get("public_key")
            if not signature or not public_key:
                raise ValueError("Transaction missing required 'signature' and 'public_key' fields.")
            tx_body = {k: v for k, v in tx.items() if k not in ("signature", "public_key")}
            if not verify_signature(tx_body, signature, public_key):
                raise ValueError("Invalid transaction signature — authorization denied.")
        self.pending_transactions.append(tx)

    def apply_transaction(self, tx: dict):
        """Delegate all business logic to the smart contract."""
        self.contract.execute(tx)

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
        """Delegate endorsement check to the smart contract."""
        self.contract.check_endorsement(developer_id, regulator_id)

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
