"""
Prototype role handling. There is no login: the frontend's role switcher sends
two headers with every request and the API checks them.

    X-Role: builder | investor | admin | public
    X-User: identity (builder name, investor email, or 'admin')

Swapping this for real JWT auth later only means replacing `current_actor`.
"""
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

ROLES = ("builder", "investor", "owner", "admin", "public")
ALIASES = {"authority": "admin", "buyer": "investor"}


@dataclass
class Actor:
    role: str
    user: str


def current_actor(x_role: str = Header("public"), x_user: str = Header("")) -> Actor:
    role = ALIASES.get(x_role.lower().strip(), x_role.lower().strip())
    if role not in ROLES:
        raise HTTPException(400, f"unknown role {role!r}")
    return Actor(role=role, user=x_user.strip())


def require_role(*roles: str):
    def dep(actor: Actor = Depends(current_actor)) -> Actor:
        if actor.role not in roles:
            raise HTTPException(403, f"This action needs role {' or '.join(roles)}; you are {actor.role}.")
        return actor
    return dep
