"""Unit tests for the FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from api.app import app, bc


@pytest.fixture(autouse=True)
def reset_blockchain():
    """Reset blockchain state before each test."""
    bc.chain.clear()
    bc.credits.clear()
    bc.ownership.clear()
    bc.pending_transactions.clear()
    bc.create_genesis_block()
    yield


client = TestClient(app)

VALID_MINT = {
    "project_id": "VCS-001",
    "project_type": "Cookstoves",
    "tonnes": 5000,
    "vintage_year": 2020,
    "owner_id": "Dev-Corp",
    "developer_id": "Dev-Corp",
    "regulator_id": "GOV-EPA",
}


class TestMintEndpoint:
    def test_mint_success(self):
        res = client.post("/credits/issue", json=VALID_MINT)
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "minted"
        assert "credit_id" in data
        assert 0 <= data["ai_risk_score"] <= 1

    def test_mint_negative_tonnes(self):
        payload = {**VALID_MINT, "tonnes": -100}
        res = client.post("/credits/issue", json=payload)
        assert res.status_code == 422

    def test_mint_blank_project_id(self):
        payload = {**VALID_MINT, "project_id": "  "}
        res = client.post("/credits/issue", json=payload)
        assert res.status_code == 422

    def test_mint_bad_vintage(self):
        payload = {**VALID_MINT, "vintage_year": 1800}
        res = client.post("/credits/issue", json=payload)
        assert res.status_code == 422

    def test_mint_missing_endorsement(self):
        payload = {**VALID_MINT}
        del payload["developer_id"]
        del payload["regulator_id"]
        res = client.post("/credits/issue", json=payload)
        assert res.status_code == 403


class TestTransferEndpoint:
    def _mint_first(self):
        res = client.post("/credits/issue", json=VALID_MINT)
        return res.json()

    def test_transfer_success(self):
        mint = self._mint_first()
        res = client.post("/credits/transfer", json={
            "credit_id": mint["credit_id"],
            "from_owner": "Dev-Corp",
            "to_owner": "Buyer-A",
            "units": 100,
        })
        assert res.status_code == 200
        assert res.json()["status"] == "transferred"

    def test_transfer_zero_units(self):
        res = client.post("/credits/transfer", json={
            "credit_id": "CRED-X",
            "from_owner": "A",
            "to_owner": "B",
            "units": 0,
        })
        assert res.status_code == 422

    def test_transfer_blank_owner(self):
        res = client.post("/credits/transfer", json={
            "credit_id": "CRED-X",
            "from_owner": "",
            "to_owner": "B",
            "units": 10,
        })
        assert res.status_code == 422


class TestRetireEndpoint:
    def _mint_first(self):
        res = client.post("/credits/issue", json=VALID_MINT)
        return res.json()

    def test_retire_success(self):
        mint = self._mint_first()
        res = client.post("/credits/retire", json={
            "credit_id": mint["credit_id"],
            "owner_id": "Dev-Corp",
        })
        assert res.status_code == 200
        assert res.json()["status"] == "retired"


class TestQueryEndpoints:
    def _mint_first(self):
        res = client.post("/credits/issue", json=VALID_MINT)
        return res.json()

    def test_get_credit(self):
        mint = self._mint_first()
        res = client.get(f"/credits/{mint['credit_id']}")
        assert res.status_code == 200
        assert res.json()["details"]["status"] == "active"

    def test_get_credit_not_found(self):
        res = client.get("/credits/CRED-NONEXIST")
        assert res.status_code == 404

    def test_credit_history(self):
        mint = self._mint_first()
        res = client.get(f"/credits/{mint['credit_id']}/history")
        assert res.status_code == 200
        assert len(res.json()["history"]) == 1

    def test_chain_stats(self):
        self._mint_first()
        res = client.get("/chain/stats")
        assert res.status_code == 200
        data = res.json()
        assert data["total_credits"] == 1

    def test_chain_validate(self):
        res = client.get("/chain/validate")
        assert res.status_code == 200
        assert res.json()["is_valid"] is True

    def test_get_chain(self):
        res = client.get("/chain")
        assert res.status_code == 200
        assert res.json()["length"] >= 1
