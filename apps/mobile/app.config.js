const preview = process.env.APP_VARIANT === "preview";
module.exports = ({ config }) => ({
  ...config,
  name: preview ? "NearHire Preview" : config.name,
  scheme: preview ? "nearhire-preview" : config.scheme,
  android: {
    ...config.android,
    package: preview ? "app.nearhire.mobile.preview" : config.android.package,
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
  },
  extra: {
    ...(config.extra || {}),
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
});
