"""Base dos contratos: Pydantic é a fonte única dos formatos (desenho §7.1).

JSON em camelCase (igual ao frontend), Python em snake_case. Campo desconhecido é erro.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ModeloApi(BaseModel):
    model_config = ConfigDict(
        extra="forbid", alias_generator=to_camel, populate_by_name=True, str_strip_whitespace=True
    )
