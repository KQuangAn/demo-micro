from fastapi import FastAPI, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr, Field
import hashlib
import json
from datetime import datetime, timezone, timedelta

app = FastAPI()


class Item(BaseModel):
    name: str
    email: EmailStr | None = Field(default=None)
    new: bool = True


item: list[Item] = []


async def lifespan(app):
    yield


@app.get("/")
async def read_root():
    return 1


@app.post("/items/", response_model=list[Item])
async def create_item(new: Item) -> Item:
    item.append(new)
    return new


@app.get("/items/{item_id}", response_model=Item)
def read_item(item_id: int, response: Response) -> Item:
    if item_id < len(item):
        response.headers["Cache-Control"] = "max-age=60"
        return item[item_id]
    raise HTTPException(status_code=404, detail="Item not found")


# ── ETag example ──────────────────────────────────────────────────
# ETag = a fingerprint of the response body.
# Browser sends:  If-None-Match: "abc123"
# Server checks:  does current data still hash to "abc123"?
#   YES → return 304 Not Modified (no body, saves bandwidth)
#   NO  → return 200 + new body + new ETag
@app.get("/items/{item_id}/etag")
def read_item_etag(item_id: int, request: Request, response: Response):
    if item_id >= len(item):
        raise HTTPException(status_code=404, detail="Item not found")

    data = item[item_id]
    # Build a stable hash of the data — this IS the ETag
    etag = '"' + hashlib.md5(json.dumps(data.model_dump()).encode()).hexdigest() + '"'

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "max-age=60"

    # Check if browser already has this version
    if request.headers.get("If-None-Match") == etag:
        # Data hasn't changed — tell browser to use its cached copy
        return Response(status_code=304)

    return data


# ── Last-Modified example ─────────────────────────────────────────
# Last-Modified = timestamp of when the data last changed.
# Browser sends:  If-Modified-Since: Wed, 12 Apr 2026 10:00:00 GMT
# Server checks:  was data modified AFTER that timestamp?
#   NO  → return 304 Not Modified
#   YES → return 200 + new body + updated Last-Modified
ITEMS_LAST_MODIFIED = datetime.now(timezone.utc)  # track when list changed

@app.post("/items/", response_model=list[Item])
async def create_item(new: Item) -> Item:
    global ITEMS_LAST_MODIFIED
    ITEMS_LAST_MODIFIED = datetime.now(timezone.utc)  # update on mutation
    item.append(new)
    return new


@app.get("/items/last-modified")
def get_items_last_modified(request: Request, response: Response):
    # HTTP date format required by spec
    http_date = ITEMS_LAST_MODIFIED.strftime("%a, %d %b %Y %H:%M:%S GMT")
    response.headers["Last-Modified"] = http_date
    response.headers["Cache-Control"] = "max-age=30"

    # Check if browser's cached version is still fresh
    if_modified_since = request.headers.get("If-Modified-Since")
    if if_modified_since:
        client_time = datetime.strptime(if_modified_since, "%a, %d %b %Y %H:%M:%S GMT").replace(tzinfo=timezone.utc)
        if ITEMS_LAST_MODIFIED <= client_time:
            # Nothing changed since browser last fetched — use cache
            return Response(status_code=304)

    return {"items": item}


# ── Expires example ───────────────────────────────────────────────
# Expires = absolute datetime after which the response is stale.
# Older than Cache-Control: max-age. If both present, max-age wins.
# Use when: you know exactly when data becomes invalid (e.g. a daily report).
@app.get("/items/expires")
def get_items_expires(response: Response):
    # Tell browser: treat this as fresh until exactly 60s from now
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    response.headers["Expires"] = expires_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
    # Also set Cache-Control — if both present, max-age takes priority
    response.headers["Cache-Control"] = "public, max-age=60"
    return {"items": item}
    if offset < len(item):
        return {"items": item[offset : offset + limit]}
    raise HTTPException(status_code=404, detail="Item not found")


@app.get("/token/")
def get_token(response: Response):
    return response.token()
