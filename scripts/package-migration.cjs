const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const files = [
  "001_propiedades.sql",
  "002_ubicaciones.sql",
  "003_identidades.sql",
];
const sql = files
  .map((file) => fs.readFileSync(path.join(root, "database", file), "utf8"))
  .join("\n");
fs.writeFileSync(path.join(root, "database/ACTUALIZAR_PROPIEDADES.sql"), sql);
fs.writeFileSync(path.join(root, "backend/scripts/estate-schema.sql"), sql);
console.log("SQL de entrega y migración empaquetada sincronizados.");
