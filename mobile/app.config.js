const fs = require("node:fs");
const path = require("node:path");
const brandColors = require("./brand-colors.json");

module.exports = ({ config }) => {
  const file =
    process.env.GOOGLE_SERVICES_JSON ||
    path.join(__dirname, "google-services.json");
  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(file) ? { googleServicesFile: file } : {}),
      softwareKeyboardLayoutMode: "resize",
    },
    plugins: [
      ...(config.plugins || []),
      [
        "expo-notifications",
        {
          defaultChannel: "messages",
          color: brandColors.secondary,
          icon: "./assets/notification-icon.png",
        },
      ],
    ],
  };
};
