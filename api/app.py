"""
VeridiumAI — FastAPI Application
Connects the AI risk-scoring model with the carbon credit blockchain.
"""

import uuid
import time
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from blockchain.blockchain import Blockchain
from blockchain.types import MINT_CREDIT, TRANSFER_CREDIT, RETIRE_CREDIT
from ml.model import score_project

app = FastAPI(
    title="VeridiumAI API",
    version="1.0.0",
    description="AI-powered carbon credit fraud detection on a blockchain.",
)
bc = Blockchain(difficulty=2)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic request schemas with input validation
# ---------------------------------------------------------------------------

class MintRequest(BaseModel):
    project_id: str
    project_type: str
    tonnes: int
    vintage_year: int
    owner_id: str
    # Endorsement policy fields
    developer_id: Optional[str] = None
    regulator_id: Optional[str] = None
    # Optional — if omitted the backend auto-computes them
    r_ratio: Optional[float] = None
    m_flag:  Optional[int]   = None
    t_flag:  Optional[int]   = None

    @field_validator("project_id", "project_type", "owner_id")
    @classmethod
    def not_blank(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} must not be blank.")
        return v.strip()

    @field_validator("tonnes")
    @classmethod
    def positive_tonnes(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("tonnes must be a positive integer.")
        return v

    @field_validator("vintage_year")
    @classmethod
    def valid_vintage(cls, v: int) -> int:
        if v < 1990 or v > 2026:
            raise ValueError("vintage_year must be between 1990 and 2026.")
        return v


class TransferRequest(BaseModel):
    credit_id:  str
    from_owner: str
    to_owner:   str
    units:      int

    @field_validator("credit_id", "from_owner", "to_owner")
    @classmethod
    def not_blank(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} must not be blank.")
        return v.strip()

    @field_validator("units")
    @classmethod
    def positive_units(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("units must be a positive integer.")
        return v


class RetireRequest(BaseModel):
    credit_id: str
    owner_id:  str

    @field_validator("credit_id", "owner_id")
    @classmethod
    def not_blank(cls, v: str, info) -> str:
        if not v or not v.strip():
            raise ValueError(f"{info.field_name} must not be blank.")
        return v.strip()


# ---------------------------------------------------------------------------
# Feature auto-computation
# ---------------------------------------------------------------------------

_HIGH_RISK_TYPES = {
    "Renewable Energy", "Hydro", "Hydropower", "Wind", "Biomass",
    "Fossil fuel replacement", "Solar", "Landfill Gas", "REDD+",
}
_PEER_AVERAGE_TONNES = 50_000


def auto_compute_features(
    project_type: str,
    tonnes: int,
) -> tuple[float, int, int]:
    """Simulate feature engineering without a live database."""
    m_flag  = 1 if project_type in _HIGH_RISK_TYPES else 0
    r_ratio = round(max(0.1, tonnes / _PEER_AVERAGE_TONNES), 4)
    t_flag  = 1 if r_ratio > 3.0 else 0
    return r_ratio, m_flag, t_flag


# ---------------------------------------------------------------------------
# POST /credits/issue — Mint (endorsement + auto-scores + mines)
# ---------------------------------------------------------------------------

@app.post("/credits/issue", status_code=201)
def issue_credit(req: MintRequest):
    # Endorsement policy: require both developer and regulator approval
    try:
        bc.check_endorsement(req.developer_id, req.regulator_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    vintage_age = 2026 - req.vintage_year

    if req.r_ratio is None or req.m_flag is None or req.t_flag is None:
        r_ratio, m_flag, t_flag = auto_compute_features(req.project_type, req.tonnes)
    else:
        r_ratio = req.r_ratio
        m_flag  = req.m_flag
        t_flag  = req.t_flag

    computed_features = {
        "R_ratio":     r_ratio,
        "Vintage_Age": vintage_age,
        "M_flag":      m_flag,
        "T_flag":      t_flag,
    }

    risk_score = score_project(computed_features)
    credit_id  = f"CRED-{uuid.uuid4().hex[:8].upper()}"

    tx = {
        "type":              MINT_CREDIT,
        "credit_id":         credit_id,
        "project_id":        req.project_id,
        "project_type":      req.project_type,
        "tonnes":            req.tonnes,
        "vintage_year":      req.vintage_year,
        "ai_risk_score":     risk_score,
        "owner_id":          req.owner_id,
        "developer_id":      req.developer_id,
        "regulator_id":      req.regulator_id,
        "computed_features": computed_features,
        "timestamp":         time.time(),
    }

    bc.add_transaction(tx)
    block = bc.mine_pending_transactions()

    return {
        "credit_id":         credit_id,
        "ai_risk_score":     risk_score,
        "computed_features": computed_features,
        "owner_id":          req.owner_id,
        "tonnes":            req.tonnes,
        "block_index":       block.index,
        "block_hash":        block.hash,
        "status":            "minted",
    }


# ---------------------------------------------------------------------------
# POST /credits/transfer
# ---------------------------------------------------------------------------

@app.post("/credits/transfer")
def transfer_credit(req: TransferRequest):
    tx = {
        "type":       TRANSFER_CREDIT,
        "credit_id":  req.credit_id,
        "from_owner": req.from_owner,
        "to_owner":   req.to_owner,
        "units":      req.units,
        "timestamp":  time.time(),
    }
    try:
        bc.add_transaction(tx)
        block = bc.mine_pending_transactions()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "credit_id":   req.credit_id,
        "from_owner":  req.from_owner,
        "to_owner":    req.to_owner,
        "units":       req.units,
        "block_index": block.index,
        "block_hash":  block.hash,
        "status":      "transferred",
    }


# ---------------------------------------------------------------------------
# POST /credits/retire
# ---------------------------------------------------------------------------

@app.post("/credits/retire")
def retire_credit(req: RetireRequest):
    tx = {
        "type":      RETIRE_CREDIT,
        "credit_id": req.credit_id,
        "owner_id":  req.owner_id,
        "timestamp": time.time(),
    }
    try:
        bc.add_transaction(tx)
        block = bc.mine_pending_transactions()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "credit_id":   req.credit_id,
        "owner_id":    req.owner_id,
        "block_index": block.index,
        "block_hash":  block.hash,
        "status":      "retired",
    }


# ---------------------------------------------------------------------------
# GET /credits/{credit_id}
# ---------------------------------------------------------------------------

@app.get("/credits/{credit_id}")
def get_credit(credit_id: str):
    if credit_id not in bc.credits:
        raise HTTPException(status_code=404, detail=f"Credit '{credit_id}' not found.")

    ownership = {
        owner_id: units
        for (cid, owner_id), units in bc.ownership.items()
        if cid == credit_id and units > 0
    }

    return {
        "credit_id": credit_id,
        "details":   bc.credits[credit_id],
        "ownership": ownership,
    }


# ---------------------------------------------------------------------------
# GET /credits/{credit_id}/history — Audit trail
# ---------------------------------------------------------------------------

@app.get("/credits/{credit_id}/history")
def get_credit_history(credit_id: str):
    if credit_id not in bc.credits:
        raise HTTPException(status_code=404, detail=f"Credit '{credit_id}' not found.")
    return {
        "credit_id": credit_id,
        "history":   bc.get_credit_history(credit_id),
    }


# ---------------------------------------------------------------------------
# GET /chain/stats — Live statistics
# ---------------------------------------------------------------------------

@app.get("/chain/stats")
def get_chain_stats():
    return bc.get_stats()


# ---------------------------------------------------------------------------
# GET /chain/validate
# ---------------------------------------------------------------------------

@app.get("/chain/validate")
def validate_chain():
    return {
        "chain_length": len(bc.chain),
        "is_valid":     bc.is_chain_valid(),
    }


# ---------------------------------------------------------------------------
# GET /chain
# ---------------------------------------------------------------------------

@app.get("/chain")
def get_chain():
    return {
        "length": len(bc.chain),
        "chain": [
            {
                "index":          block.index,
                "hash":           block.hash,
                "previous_hash":  block.previous_hash,
                "tx_count":       len(block.transactions),
                "timestamp":      block.timestamp,
            }
            for block in bc.chain
        ],
    }
