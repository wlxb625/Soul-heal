import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://yuge-personality-suite.netlify.app",
  "http://127.0.0.1:3011",
  "http://localhost:3011"
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://yuge-personality-suite.netlify.app",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function response(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function readDefaultKey(legacyName: string, modernName: string) {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get(modernName) || "{}").default || "";
  } catch {
    return "";
  }
}

async function pauseForInvalidLogin() {
  await new Promise((resolve) => setTimeout(resolve, 250));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return response(request, 405, { message: "Method not allowed" });

  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response(request, 403, { message: "Forbidden" });

  let input: { username?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return response(request, 400, { message: "用户名或密码错误" });
  }

  const username = String(input.username || "").trim();
  const password = String(input.password || "");
  if (!/^[\u4e00-\u9fff_a-zA-Z0-9_]{2,20}$/.test(username) || !password || password.length > 64) {
    return response(request, 400, { message: "用户名或密码错误" });
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = readDefaultKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
  const publicKey = readDefaultKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
  if (!url || !serviceKey || !publicKey) {
    console.error("Supabase function credentials are unavailable");
    return response(request, 503, { message: "登录服务暂时不可用，请稍后重试" });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    console.error("Unable to read user directory", usersError.message);
    return response(request, 503, { message: "登录服务暂时不可用，请稍后重试" });
  }

  const matched = users.users.find((user) =>
    String(user.user_metadata?.username || "").trim().toLowerCase() === username.toLowerCase()
  );
  if (!matched?.email) {
    await pauseForInvalidLogin();
    return response(request, 401, { message: "用户名或密码错误" });
  }

  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({
    email: matched.email,
    password
  });
  if (signInError || !signIn.session) {
    return response(request, 401, { message: "用户名或密码错误" });
  }

  return response(request, 200, {
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token
  });
});

