from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field
app = FastAPI()

class Item(BaseModel):
    name: str
    email: EmailStr| None = Field(default=None)
    new : bool = True

item :list[Item]= []
 
async def lifespan(app):
    yield


@app.get("/")
async def read_root():
    return 1


@app.post("/items/", response_model=list[Item])
async def create_item(new : Item) -> Item:
    item.append(new)
    return new

@app.get("/items/{item_id}" , response_model=Item)
def read_item(item_id: int) -> Item:
    if item_id < len(item):
        return item[item_id]
    raise HTTPException(status_code=404, detail="Item not found")

@app.get("/items/")
def get_all_items(limit: int = 10, offset: int = 0):
    if offset < len(item):
        return {"items": item[offset : offset + limit]}
    raise HTTPException(status_code=404, detail="Item not found")