from fastapi import APIRouter

router = APIRouter(tags=["home"])

# Mock data -- replace with real backend calls.
MOCK_HOME = {
    "user": "Johanna",
    "recent_activities": [],
    "favorites": [],
}


@router.get("/home", summary="Mock homepage data (welcome name, recent activity, favorites)")
def get_home():
    return MOCK_HOME
