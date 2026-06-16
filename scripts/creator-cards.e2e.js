/* eslint-disable no-console */
/**
 * End-to-end smoke test for the Creator Card API.
 *
 * Pure HTTP — no database access and non-destructive: every card it creates is
 * namespaced with a unique per-run id, so it never collides with or deletes
 * other data. Safe to run against the live deployment.
 *
 * Usage:
 *   E2E_BASE=https://node-template-a2f0.onrender.com node scripts/creator-cards.e2e.js
 *   node scripts/creator-cards.e2e.js            # defaults to http://localhost:8811
 */
const BASE = process.env.E2E_BASE || 'http://localhost:8811';
const RUN = `e2e-${Date.now().toString(36)}`;
const REF = 'crt_e2e0000000000001'; // exactly 20 chars

let pass = 0;
let fail = 0;

function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}  -> ${detail}`);
  }
}

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

(async () => {
  console.log(`Base URL: ${BASE}`);
  console.log(`Run namespace: ${RUN}\n`);

  const pubSlug = `pub-${RUN}`;
  const privSlug = `priv-${RUN}`;
  const draftSlug = `draft-${RUN}`;

  console.log('== Health ==');
  let r = await req('GET', '/');
  check(
    'GET / -> 200 healthy',
    r.status === 200 && r.json?.data?.status === 'ok',
    JSON.stringify(r.json)
  );

  console.log('\n== Create ==');
  r = await req('POST', '/creator-cards', {
    title: 'E2E Public Card',
    description: 'created by the e2e smoke test',
    slug: pubSlug,
    creator_reference: REF,
    links: [{ title: 'Site', url: 'https://example.com' }],
    service_rates: {
      currency: 'NGN',
      rates: [{ name: 'Shoutout', description: 'one post', amount: 5000 }],
    },
    status: 'published',
  });
  check('create public -> 200', r.status === 200, r.status);
  check('exposes id, not _id', !!r.json?.data?.id && r.json?.data?._id === undefined, 'keys');
  check(
    'access_type defaults/echoes public',
    r.json?.data?.access_type === 'public',
    r.json?.data?.access_type
  );
  check(
    'access_code present as null',
    r.json?.data?.access_code === null,
    JSON.stringify(r.json?.data?.access_code)
  );

  r = await req('POST', '/creator-cards', {
    title: `Auto ${RUN}`,
    creator_reference: REF,
    status: 'published',
  });
  check('auto-slug create -> 200', r.status === 200, r.status);
  check(
    'auto-slug matches slugified title',
    r.json?.data?.slug === `auto-${RUN}`,
    r.json?.data?.slug
  );

  r = await req('POST', '/creator-cards', {
    title: 'E2E Private Card',
    slug: privSlug,
    creator_reference: REF,
    status: 'published',
    access_type: 'private',
    access_code: 'A1B2C3',
  });
  check('private create -> 200', r.status === 200, r.status);
  check(
    'access_code returned on create',
    r.json?.data?.access_code === 'A1B2C3',
    JSON.stringify(r.json?.data?.access_code)
  );

  r = await req('POST', '/creator-cards', {
    title: 'E2E Draft',
    slug: draftSlug,
    creator_reference: REF,
    status: 'draft',
  });
  check('draft create -> 200', r.status === 200, r.status);

  console.log('\n== Retrieve ==');
  r = await req('GET', `/creator-cards/${pubSlug}`);
  check('public retrieve -> 200', r.status === 200, r.status);
  check('retrieve omits access_code', r.json?.data && !('access_code' in r.json.data), 'keys');

  r = await req('GET', `/creator-cards/${privSlug}?access_code=A1B2C3`);
  check('private retrieve w/ pin -> 200', r.status === 200, r.status);
  check(
    'private retrieve omits access_code',
    r.json?.data && !('access_code' in r.json.data),
    'keys'
  );

  r = await req('GET', `/creator-cards/${privSlug}`);
  check(
    'private no pin -> 403 AC03',
    r.status === 403 && r.json?.code === 'AC03',
    JSON.stringify(r.json)
  );

  r = await req('GET', `/creator-cards/${privSlug}?access_code=WRONG1`);
  check(
    'private wrong pin -> 403 AC04',
    r.status === 403 && r.json?.code === 'AC04',
    JSON.stringify(r.json)
  );

  r = await req('GET', `/creator-cards/${draftSlug}`);
  check(
    'draft retrieve -> 404 NF02',
    r.status === 404 && r.json?.code === 'NF02',
    JSON.stringify(r.json)
  );

  r = await req('GET', `/creator-cards/missing-${RUN}`);
  check(
    'missing retrieve -> 404 NF01',
    r.status === 404 && r.json?.code === 'NF01',
    JSON.stringify(r.json)
  );

  console.log('\n== Validation & business rules ==');
  r = await req('POST', '/creator-cards', {
    title: 'Dup',
    slug: pubSlug,
    creator_reference: REF,
    status: 'published',
  });
  check(
    'duplicate slug -> 400 SL02',
    r.status === 400 && r.json?.code === 'SL02',
    JSON.stringify(r.json)
  );

  r = await req('POST', '/creator-cards', {
    title: 'No Pin',
    creator_reference: REF,
    status: 'published',
    access_type: 'private',
  });
  check(
    'private missing access_code -> 400 AC01',
    r.status === 400 && r.json?.code === 'AC01',
    JSON.stringify(r.json)
  );

  r = await req('POST', '/creator-cards', {
    title: 'Pub Pin',
    creator_reference: REF,
    status: 'published',
    access_type: 'public',
    access_code: 'A1B2C3',
  });
  check(
    'access_code on public -> 400 AC05',
    r.status === 400 && r.json?.code === 'AC05',
    JSON.stringify(r.json)
  );

  r = await req('POST', '/creator-cards', {
    title: 'Bad Status',
    creator_reference: REF,
    status: 'archived',
  });
  check('invalid status -> 400', r.status === 400, r.status);

  r = await req('POST', '/creator-cards', '{bad json');
  check('malformed JSON -> 400', r.status === 400, r.status);

  r = await req('POST', '/creator-cards', {
    title: 'Bad Amount',
    creator_reference: REF,
    status: 'published',
    service_rates: { currency: 'USD', rates: [{ name: 'Svc', amount: 1.5 }] },
  });
  check('non-integer amount -> 400', r.status === 400, r.status);

  r = await req('POST', '/creator-cards', {
    title: 'Bad Url',
    creator_reference: REF,
    status: 'published',
    links: [{ title: 'X', url: 'ftp://x.com' }],
  });
  check('bad url scheme -> 400', r.status === 400, r.status);

  console.log('\n== Delete ==');
  r = await req('DELETE', `/creator-cards/${pubSlug}`, { creator_reference: REF });
  check('delete -> 200', r.status === 200, r.status);
  check(
    'delete sets deleted timestamp',
    typeof r.json?.data?.deleted === 'number',
    JSON.stringify(r.json?.data?.deleted)
  );
  check(
    'delete returns create-format (has access_code)',
    r.json?.data && 'access_code' in r.json.data,
    'keys'
  );

  r = await req('GET', `/creator-cards/${pubSlug}`);
  check(
    'retrieve deleted -> 404 NF01',
    r.status === 404 && r.json?.code === 'NF01',
    JSON.stringify(r.json)
  );

  r = await req('DELETE', `/creator-cards/missing-${RUN}`, { creator_reference: REF });
  check(
    'delete missing -> 404 NF01',
    r.status === 404 && r.json?.code === 'NF01',
    JSON.stringify(r.json)
  );

  // Best-effort cleanup of the remaining cards this run created.
  await req('DELETE', `/creator-cards/${privSlug}`, { creator_reference: REF });
  await req('DELETE', `/creator-cards/${draftSlug}`, { creator_reference: REF });
  await req('DELETE', `/creator-cards/auto-${RUN}`, { creator_reference: REF });

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('E2E HARNESS ERROR', e);
  process.exit(2);
});
