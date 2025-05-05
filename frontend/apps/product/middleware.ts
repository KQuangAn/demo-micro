import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function middleware(req: Request) {
    const c = await cookies()
    const token = c.get("next-auth.session-token")

    if (!token) {
        return NextResponse.redirect(new URL('http://localhost:3000/login', req.url));
    }
    return NextResponse.next();
}