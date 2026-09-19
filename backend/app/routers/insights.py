"""
Area Insights: a neutral, read-only list of verifiable facts about a locality.

Rules this module must keep:
  * no prediction, score, rating, ranking or label about how desirable an area is - ever;
  * every fact carries its source; a gap is reported as "not publicly available", never estimated;
  * nothing here reads or writes parcels, units, ULPINs, ownership or disputes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AreaInfrastructure, MarketContextProject

router = APIRouter(prefix="/api/area-insights", tags=["area-insights"])

DISCLAIMER = "Informational only, based on public data as noted. Not investment advice."
NOT_AVAILABLE = "not publicly available"


def _cities(value: str) -> list[str]:
    return [c.strip() for c in value.split("/") if c.strip()]


def _infra(r: AreaInfrastructure) -> dict:
    return {"name": r.name, "locality": r.locality, "city": r.city, "project_type": r.project_type, "description": r.description,
            "announced_status": r.announced_status, "expected_completion": r.expected_completion,
            "data_source": r.data_source, "data_date": r.data_date}


@router.get("")
def area_insights(city: str = "", locality: str = "", db: Session = Depends(get_db)):
    projects = db.query(MarketContextProject).all()
    infra = db.query(AreaInfrastructure).order_by(AreaInfrastructure.name).all()

    if not city:   # index: which areas can be asked about
        areas: dict[tuple[str, str], int] = {}
        for p in projects:
            areas[(p.city, p.locality)] = areas.get((p.city, p.locality), 0) + 1
        for r in infra:
            for c in _cities(r.city):
                areas.setdefault((c, ""), 0)
        listed = [{"city": c, "locality": l, "known_projects": n} for (c, l), n in sorted(areas.items()) if l]
        cities_only = [{"city": c, "locality": "", "known_projects": 0} for (c, l) in sorted(areas) if not l and not any(a["city"] == c for a in listed)]
        return {"areas": listed + cities_only, "disclaimer": DISCLAIMER}

    here = [p for p in projects if p.city == city and (not locality or p.locality == locality)]
    with_units = [p for p in here if p.total_units.isdigit()]
    sources = sorted({f"{p.data_source} ({p.confidence.replace('_', '-')}, {p.data_date})" for p in here})
    return {
        "city": city, "locality": locality,
        # 1. price: the market-context dataset records no prices, so there is nothing truthful to show
        "price_per_sqft": {"value": None, "text": NOT_AVAILABLE,
                           "note": "The project dataset behind this layer records no prices. Nothing is estimated."},
        # 2. inventory: only what the dataset really holds
        "inventory": {
            "known_projects": len(here),
            "known_units": sum(int(p.total_units) for p in with_units) if with_units else None,
            "projects_with_unit_count": len(with_units),
            "unsold_units": {"value": None, "text": NOT_AVAILABLE},
            "projects": [{"project_name": p.project_name, "builder_name": p.builder_name, "total_units": p.total_units, "status": p.status, "confidence": p.confidence} for p in here],
            "sources": sources,
        },
        # 3. announced infrastructure in the same city (listed, never weighed or ranked)
        "infrastructure": [_infra(r) for r in infra if city in _cities(r.city)],
        "disclaimer": DISCLAIMER,
    }
