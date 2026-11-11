const fs = require("node:fs");
const path = require("node:path");

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
          color: "#0866f5",
          icon: "./assets/notification-icon.png",
        },
      ],
    ],
  };
};
