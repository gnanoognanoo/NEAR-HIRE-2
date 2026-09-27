const base = require("./app.json");
const preview = process.env.APP_VARIANT === "preview";
module.exports = () => ({
  ...base.expo,
  name: preview ? "NearHire Preview" : base.expo.name,
  scheme: preview ? "nearhire-preview" : base.expo.scheme,
  android: {
    ...base.expo.android,
    package: preview ? "app.nearhire.mobile.preview" : base.expo.android.package,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  extra: {
    ...(base.expo.extra || {}),
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
});
