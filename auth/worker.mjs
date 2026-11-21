const cookieName = '__Host-b127-oauth';
const cookieOptions = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const cookieExpired = `${cookieName}=; ${cookieOptions}; Max-Age=0`;
const handshake = 'authorizing:github';

function response(message, status = 200, headers = {}) {
    return new Response(message, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            ...headers,
        },
    });
}

function base64url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)))
        .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomString() {
    return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function startLogin(url, env, callback) {
    const editor = new URL(env.CMS_ORIGIN);
    if (url.searchParams.get('provider') !== 'github' ||
        url.searchParams.get('site_id') !== editor.hostname) {
        return response('B-127 관리자 화면에서 로그인을 시작해 주세요.', 400);
    }

    const state = randomString();
    const verifier = randomString();
    const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const authorize = new URL('https://github.com/login/oauth/authorize');
    authorize.search = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: callback,
        scope: 'public_repo',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
    });

    return response(null, 302, {
        Location: authorize.href,
        'Set-Cookie': `${cookieName}=${state}.${verifier}; ${cookieOptions}; Max-Age=600`,
    });
}

function finishLogin(origin, token) {
    const payload = 'authorization:github:success:' + JSON.stringify({ token, provider: 'github' });
    const asScriptValue = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
    const nonce = randomString();
    return response(`<!doctype html>
<html lang="ko"><meta charset="utf-8"><title>B-127 관리자 로그인</title>
<p>관리자 화면에 연결하는 중입니다.</p>
<script nonce="${nonce}">
const origin = ${asScriptValue(origin)};
const opener = window.opener;
if (opener) {
    window.addEventListener('message', (event) => {
        if (event.source !== opener || event.origin !== origin || event.data !== '${handshake}') return;
        opener.postMessage(${asScriptValue(payload)}, origin);
        window.close();
    });
    opener.postMessage('${handshake}', origin);
}
</script></html>`, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
        'Set-Cookie': cookieExpired,
    });
}

async function callbackLogin(request, url, env, callback) {
    const session = (request.headers.get('Cookie') ?? '').split(/;\s*/)
        .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const [state, verifier] = session?.split('.') ?? [];
    const code = url.searchParams.get('code');
    if (!code || !state || !verifier || url.searchParams.get('state') !== state) {
        return response('로그인이 만료되었거나 취소됐어요. 관리자 화면에서 다시 시도해 주세요.', 400, {
            'Set-Cookie': cookieExpired,
        });
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            code_verifier: verifier,
            redirect_uri: callback,
        }),
    });
    const { access_token: token } = tokenResponse.ok ? await tokenResponse.json() : {};
    if (!token) return response('GitHub 로그인을 완료하지 못했어요. 다시 시도해 주세요.', 502);

    const repoResponse = await fetch(`https://api.github.com/repos/${env.CMS_REPOSITORY}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'B-127 CMS' },
    });
    const { permissions } = repoResponse.ok ? await repoResponse.json() : {};
    if (!permissions?.push) {
        return response('이 GitHub 계정에는 B-127 작품 편집 권한이 없어요.', 403, {
            'Set-Cookie': cookieExpired,
        });
    }
    return finishLogin(env.CMS_ORIGIN, token);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method !== 'GET') return response('Method not allowed', 405, { Allow: 'GET' });
        if (url.pathname === '/') return response('B-127 관리자 로그인 서비스');
        if (url.pathname !== '/auth' && url.pathname !== '/callback') return response('Not found', 404);
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
            return response('B-127 관리자 로그인 설정을 완료해 주세요.', 503);
        }

        const callback = `${url.origin}/callback`;
        try {
            if (url.pathname === '/auth') return await startLogin(url, env, callback);
            return await callbackLogin(request, url, env, callback);
        } catch {
            return response('GitHub 로그인에 실패했어요. 관리자 화면에서 다시 시도해 주세요.', 502);
        }
    },
};
