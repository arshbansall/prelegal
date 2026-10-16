"""The Mutual NDA's part of the drafting conversation: its fields and reply schema.

The NDA fills in Common Paper's own cover page, so its fields are defined here
(and in frontend/src/lib/nda.ts) rather than in documents.json. The backend
has no copy of the templates, so the prompt describes the cover page fields.
"""

from app.schemas import NdaUpdates, NdaValues, Turn, is_valid_years

# The cover page's default purpose, pre-filled when the NDA is chosen.
DEFAULT_PURPOSE = "Evaluating whether to enter into a business relationship with the other party."


class NdaChatTurn(Turn):
    updates: NdaUpdates
    reply: str


def missing_fields(values: NdaValues) -> list[str]:
    """Descriptions of the required fields that are still blank.

    Party titles and modifications are optional, and the terms always have a value.
    """
    required = [
        ("purpose", values.purpose),
        ("effective date", values.effective_date),
        ("governing law", values.governing_law),
        ("jurisdiction", values.jurisdiction),
    ]
    for label, party in (("Party 1", values.party1), ("Party 2", values.party2)):
        required += [
            (f"{label} signer's name", party.name),
            (f"{label} company", party.company),
            (f"{label} notice address", party.notice_address),
        ]

    missing = [description for description, value in required if not value.strip()]
    if values.mnda_term_type == "expires" and not is_valid_years(values.mnda_term_years):
        missing.append("MNDA term length in years")
    if values.confidentiality_type == "years" and not is_valid_years(values.confidentiality_years):
        missing.append("confidentiality term length in years")
    return missing


FIELDS = f"""\
This is the cover page of a Common Paper Mutual Non-Disclosure Agreement (MNDA, \
version 1.0).

### Cover page fields
- purpose: how Confidential Information may be used. It starts with a sensible \
default ("{DEFAULT_PURPOSE}"); ask the user to confirm or change it.
- effectiveDate: yyyy-mm-dd. It defaults to today. Convert relative dates \
("next Monday") using today's date.
- mndaTermType: "expires" (the MNDA expires after mndaTermYears years) or \
"untilTerminated" (continues until terminated under the MNDA). Default: expires after 1 year.
- confidentialityType: "years" (Confidential Information is protected for \
confidentialityYears years; trade secrets stay protected while they remain trade \
secrets) or "perpetual". Default: 1 year.
- governingLaw: the US state whose law governs, e.g. "Delaware".
- jurisdiction: the courts for disputes, written as "courts located in <city or \
county>, <state abbreviation>", e.g. "courts located in New Castle, DE".
- modifications: optional changes to the Standard Terms. Blank means none.
- party1 and party2, each with: name (the person signing), title (their job \
title), company, and noticeAddress (an email or postal address for legal notices). \
Party 1 is the first party the user names (usually the user's own company) and \
Party 2 the other; as soon as the user names the companies, fill in both \
party1.company and party2.company.

A good order to ask in: the parties and why they are sharing information, then \
the terms, then governing law and jurisdiction, then each party's signer details."""
