from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=254)]


class LoginRequest(BaseModel):
    email: Email
    password: str = ""


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
