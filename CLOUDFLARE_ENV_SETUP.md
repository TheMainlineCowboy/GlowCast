# Cloudflare Pages Environment Variable Setup

## Goal

GlowCast now has a backend endpoint at:

```txt
POST /api/analyze-projection
```

That endpoint expects these Cloudflare environment variables:

```txt
GEOMETRY_API_URL
GEOMETRY_API_KEY
SAM2_API_URL
SAM2_API_KEY
DEPTH_API_URL
DEPTH_API_KEY
```

Without these values, the endpoint will still run, but it will return warnings that the providers are missing.

---

## Where to add them in Cloudflare

1. Open Cloudflare Dashboard.
2. Go to **Workers & Pages**.
3. Click the **GlowCast** Pages project.
4. Go to **Settings**.
5. Open **Environment variables**.
6. Under **Production**, click **Add variable**.
7. Add each variable name and value.
8. Save.
9. Redeploy the latest deployment.

---

## Variables to add

### Geometry provider

Used for wall line detection, vanishing points, and homography warp.

```txt
GEOMETRY_API_URL=your geometry provider endpoint
GEOMETRY_API_KEY=your provider key
```

### SAM 2 provider

Used for polygon/alpha masks around doors, windows, fixtures, vents, glass, etc.

```txt
SAM2_API_URL=your SAM 2 provider endpoint
SAM2_API_KEY=your provider key
```

### Depth provider

Used for monocular depth, wall plane detection, recessed areas, and protruding objects.

```txt
DEPTH_API_URL=your depth provider endpoint
DEPTH_API_KEY=your provider key
```

---

## Important

Do not put real API keys into GitHub files.

The `.env.example` file is only a template. Actual keys belong in Cloudflare environment variables.

---

## Redeploy after saving

After adding variables:

1. Go to **Deployments**.
2. Find the most recent deployment.
3. Click the three-dot menu.
4. Choose **Retry deployment** or **Redeploy**.

The Pages Function will then receive the variables through the `env` object.
