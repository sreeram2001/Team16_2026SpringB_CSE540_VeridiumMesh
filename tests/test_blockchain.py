"""Unit tests for the blockchain layer."""

import pytest
from blockchain.blockchain import Blockchain
from blockchain.types import MINT_CREDIT, TRANSFER_CREDIT, RETIRE_CREDIT


def _make_chain() -> Blockchain:
    return Blockchain(difficulty=1, data_file=None)


def _mint_tx(credit_id="CRED-001", tonnes=1000, owner="Dev-Org",
             risk=0.3, project_type="Cookstoves", vintage=2024):
    return {
        "type": MINT_CREDIT,
        "credit_id": credit_id,
        "project_id": "P-001",
        "project_type": project_type,
        "tonnes": tonnes,
        "vintage_year": vintage,
        "ai_risk_score": risk,
        "owner_id": owner,
        "developer_id": "dev-1",
        "regulator_id": "reg-1",
        "computed_features": {},
        "timestamp": 1.0,
    }


class TestMinting:
    def test_mint_creates_credit(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        assert "CRED-001" in bc.credits
        assert bc.credits["CRED-001"]["status"] == "active"
        assert bc.ownership[("CRED-001", "Dev-Org")] == 1000

    def test_chain_grows(self):
        bc = _make_chain()
        assert len(bc.chain) == 1  # genesis
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        assert len(bc.chain) == 2


class TestTransfer:
    def test_transfer_moves_units(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": TRANSFER_CREDIT,
            "credit_id": "CRED-001",
            "from_owner": "Dev-Org",
            "to_owner": "Buyer-A",
            "units": 400,
            "timestamp": 2.0,
        })
        bc.mine_pending_transactions()
        assert bc.ownership[("CRED-001", "Dev-Org")] == 600
        assert bc.ownership[("CRED-001", "Buyer-A")] == 400

    def test_transfer_insufficient_units(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx(tonnes=100))
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": TRANSFER_CREDIT,
            "credit_id": "CRED-001",
            "from_owner": "Dev-Org",
            "to_owner": "Buyer-A",
            "units": 500,
            "timestamp": 2.0,
        })
        with pytest.raises(ValueError, match="Insufficient units"):
            bc.mine_pending_transactions()

    def test_transfer_retired_credit_fails(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": RETIRE_CREDIT,
            "credit_id": "CRED-001",
            "owner_id": "Dev-Org",
            "timestamp": 2.0,
        })
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": TRANSFER_CREDIT,
            "credit_id": "CRED-001",
            "from_owner": "Dev-Org",
            "to_owner": "Buyer-A",
            "units": 100,
            "timestamp": 3.0,
        })
        with pytest.raises(ValueError, match="already retired"):
            bc.mine_pending_transactions()


class TestRetire:
    def test_retire_marks_status(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": RETIRE_CREDIT,
            "credit_id": "CRED-001",
            "owner_id": "Dev-Org",
            "timestamp": 2.0,
        })
        bc.mine_pending_transactions()
        assert bc.credits["CRED-001"]["status"] == "retired"

    def test_retire_zero_units_fails(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": RETIRE_CREDIT,
            "credit_id": "CRED-001",
            "owner_id": "Nobody",
            "timestamp": 2.0,
        })
        with pytest.raises(ValueError, match="No units to retire"):
            bc.mine_pending_transactions()


class TestChainValidity:
    def test_valid_chain(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        assert bc.is_chain_valid()

    def test_tampered_chain(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        bc.chain[1].transactions = [{"type": "FAKE"}]
        assert not bc.is_chain_valid()


class TestHistory:
    def test_credit_history(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.mine_pending_transactions()
        bc.add_transaction({
            "type": TRANSFER_CREDIT,
            "credit_id": "CRED-001",
            "from_owner": "Dev-Org",
            "to_owner": "Buyer-A",
            "units": 200,
            "timestamp": 2.0,
        })
        bc.mine_pending_transactions()
        history = bc.get_credit_history("CRED-001")
        assert len(history) == 2
        assert history[0]["type"] == MINT_CREDIT
        assert history[1]["type"] == TRANSFER_CREDIT


class TestStats:
    def test_stats(self):
        bc = _make_chain()
        bc.add_transaction(_mint_tx())
        bc.add_transaction(_mint_tx(credit_id="CRED-002", risk=0.9))
        bc.mine_pending_transactions()
        stats = bc.get_stats()
        assert stats["total_credits"] == 2
        assert stats["flagged_high_risk"] == 1
        assert stats["active_credits"] == 2


class TestEndorsement:
    def test_endorsement_requires_both(self):
        bc = _make_chain()
        with pytest.raises(ValueError, match="developer_id"):
            bc.check_endorsement(None, "GOV-001")
        with pytest.raises(ValueError, match="regulator_id"):
            bc.check_endorsement("DEV-001", None)

    def test_endorsement_passes(self):
        bc = _make_chain()
        bc.check_endorsement("DEV-001", "GOV-001")  # should not raise

    def test_endorsement_disabled(self):
        bc = _make_chain()
        bc.endorsement_policy_enabled = False
        bc.check_endorsement(None, None)  # should not raise
