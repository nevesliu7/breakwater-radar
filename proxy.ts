import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const password = process.env.BREAKWATER_BASIC_AUTH_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  const expectedUser = process.env.BREAKWATER_BASIC_AUTH_USER ?? "operator";

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const candidatePassword = decoded.slice(separatorIndex + 1);

    if (user === expectedUser && candidatePassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Breakwater Radar"',
    },
  });
}

export const config = {
  matcher: ["/", "/api/:path*"],
};
