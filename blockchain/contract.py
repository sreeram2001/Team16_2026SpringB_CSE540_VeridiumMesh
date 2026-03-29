"""
VeridiumAI — Carbon Credit Smart Contract
==========================================
This module implements the smart contract logic for the VeridiumAI platform.
It defines all business rules, validation checks, state transitions, and
endorsement policies that govern the carbon credit lifecycle.

Analogous to chaincode in Hyperledger Fabric or a Solidity contract on the
EVM, this contract enforces:

  1. MintCredit    — Issue a new carbon credit with AI risk score attached.
  2. TransferCredit — Move ownership units between participants.
  3. RetireCredit   — Permanently burn a credit (irreversible).
  4. QueryCredit    — Look up credit metadata and current ownership.
  5. QueryHistory   — Full audit trail of every transaction for a credit.
  6. Endorsement    — Dual-approval policy requiring both a project developer
                      and a government regulator before minting is allowed.

The contract operates on two state stores:
  - credits:   dict mapping credit_id → {tonnes, project_type, vintage_year,
               ai_risk_score, status}
  - ownership: dict mapping (credit_id, owner_id) → units held
"""

from .types import MINT_CREDIT, TRANSFER_CREDIT, RETIRE_CREDIT


class CarbonCreditContract:
    """Smart contract governing the full carbon credit lifecycle."""

    def __init__(self):
        self.credits: dict   = {}   # credit_id -> credit details
        self.ownership: dict = {}   # (credit_id, owner_id) -> units held
        self.endorsement_policy_enabled = True

    # ── Endorsement Policy ───────────────────────────────────────────────
    def check_endorsement(self, developer_id: str | None, regulator_id: str | None):
        """
        Enforce dual-approval endorsement policy.

        Before any credit can be minted, both a project developer and a
        government regulator must provide their identifiers. This prevents
        unilateral issuance and mirrors the endorsement policies used in
        Hyperledger Fabric where multiple organisations must sign off on
        a transaction before it is committed.

        Raises ValueError if either party is missing.
        """
        if not self.endorsement_policy_enabled:
            return
        if not developer_id or not developer_id.strip():
            raise ValueError("Endorsement policy requires a developer_id.")
        if not regulator_id or not regulator_id.strip():
            raise ValueError("Endorsement policy requires a regulator_id (government approval).")

    # ── Transaction Execution ────────────────────────────────────────────
    def execute(self, tx: dict):
        """
        Route a transaction to the appropriate handler based on its type.
        This is the single entry point for all state mutations — equivalent
        to the Invoke() function in Hyperledger Fabric chaincode.
        """
        tx_type = tx["type"]
        if tx_type == MINT_CREDIT:
            self._mint_credit(tx)
        elif tx_type == TRANSFER_CREDIT:
            self._transfer_credit(tx)
        elif tx_type == RETIRE_CREDIT:
            self._retire_credit(tx)
        else:
            raise ValueError(f"Unknown transaction type: {tx_type}")

    # ── MintCredit ───────────────────────────────────────────────────────
    def _mint_credit(self, tx: dict):
        """
        Register a new carbon credit on the ledger.

        Preconditions:
          - Endorsement policy must be satisfied (checked before this call).
          - AI risk score must be present in the transaction.

        State changes:
          - Creates a new entry in self.credits with status 'active'.
          - Assigns all tonnes to the issuing owner in self.ownership.
        """
        credit_id = tx["credit_id"]
        owner_id  = tx["owner_id"]
        tonnes    = tx["tonnes"]
        self.credits[credit_id] = {
            "tonnes":        tonnes,
            "project_type":  tx["project_type"],
            "vintage_year":  tx["vintage_year"],
            "ai_risk_score": tx["ai_risk_score"],
            "status":        "active",
        }
        self.ownership[(credit_id, owner_id)] = tonnes

    # ── TransferCredit ───────────────────────────────────────────────────
    def _transfer_credit(self, tx: dict):
        """
        Move ownership units from one participant to another.

        Preconditions (reverts on failure):
          - Credit must have status 'active' (not retired).
          - Sender must hold >= requested units (prevents double-spending).

        State changes:
          - Decrements sender's balance.
          - Increments receiver's balance.
        """
        credit_id  = tx["credit_id"]
        from_owner = tx["from_owner"]
        to_owner   = tx["to_owner"]
        units      = tx["units"]

        if self.credits[credit_id]["status"] != "active":
            raise ValueError(f"Credit {credit_id} is already retired.")
        if self.ownership.get((credit_id, from_owner), 0) < units:
            raise ValueError(
                f"Insufficient units: {from_owner} does not hold {units} of {credit_id}."
            )

        self.ownership[(credit_id, from_owner)] -= units
        self.ownership[(credit_id, to_owner)] = (
            self.ownership.get((credit_id, to_owner), 0) + units
        )

    # ── RetireCredit ─────────────────────────────────────────────────────
    def _retire_credit(self, tx: dict):
        """
        Permanently retire (burn) a carbon credit.

        Preconditions (reverts on failure):
          - Caller must hold > 0 units of the credit.

        State changes:
          - Sets credit status to 'retired'. This is irreversible.
          - No further transfers are allowed once retired.
        """
        credit_id = tx["credit_id"]
        owner_id  = tx["owner_id"]
        if self.ownership.get((credit_id, owner_id), 0) <= 0:
            raise ValueError(
                f"No units to retire: {owner_id} holds 0 of {credit_id}."
            )
        self.credits[credit_id]["status"] = "retired"

    # ── QueryCredit ──────────────────────────────────────────────────────
    def query_credit(self, credit_id: str) -> dict | None:
        """
        Look up credit metadata by ID.
        Returns the credit details dict or None if not found.
        """
        return self.credits.get(credit_id)

    # ── QueryOwnership ───────────────────────────────────────────────────
    def query_ownership(self, credit_id: str) -> dict[str, int]:
        """
        Return current ownership map for a credit.
        {owner_id: units} for all owners with units > 0.
        """
        return {
            owner_id: units
            for (cid, owner_id), units in self.ownership.items()
            if cid == credit_id and units > 0
        }
