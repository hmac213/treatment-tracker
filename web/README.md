# Treatment Tracker Web

This frontend is now a static React SPA built with Vite.

## Build

```bash
npm install
npm run build:s3
```

Build artifacts are written to `dist/`.

## Deploy

Upload the contents of `dist/` to your S3 bucket.

The app uses hash-based client routing (`/#/...`) so it works on plain S3 hosting without rewrite rules.

## Environment

Create a `.env` file with:

```bash
VITE_LAMBDA_DATA_API_URL=https://vkeubxaqbwf5dz5azlcrlrhy3i0yhcfd.lambda-url.us-west-2.on.aws/
```

Your Lambda endpoint must allow browser CORS requests from the S3 site origin.

For static deployments, you can also override the endpoint at runtime by editing `dist/runtime-config.js`
without rebuilding the app.
